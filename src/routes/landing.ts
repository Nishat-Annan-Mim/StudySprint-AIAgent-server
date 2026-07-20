import { Router } from "express";
import { Course } from "../models/Course.js";
import { User } from "../models/User.js";
import { Review } from "../models/Review.js";

const router = Router();

// GET /api/landing/simulation-users - Get seeded users for simulation
router.get("/simulation-users", async (req, res) => {
  try {
    const student = await User.findOne({ role: "student" });
    const creator = await User.findOne({ role: "creator" });
    res.json({ student, creator });
  } catch (error) {
    console.error("Error fetching simulation users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 1. GET /api/landing/stats - Dynamic platform stats
router.get("/stats", async (req, res) => {
  try {
    const totalCourses = await Course.countDocuments({ status: "published" });
    const totalStudents = await User.countDocuments({ role: "student" });
    
    // Aggregate review averages
    const reviewsAggregate = await Review.aggregate([
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" }
        }
      }
    ]);
    
    const averageRating = reviewsAggregate.length > 0 
      ? Math.round(reviewsAggregate[0].avgRating * 10) / 10 
      : 4.8; // default fallback if no reviews yet

    res.json({
      coursesCount: totalCourses,
      studentsCount: totalStudents,
      avgRating: averageRating
    });
  } catch (error) {
    console.error("Error retrieving landing stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. GET /api/landing/featured-courses - Top 4 courses by rating
router.get("/featured-courses", async (req, res) => {
  try {
    const courses = await Course.find({ status: "published" })
      .sort({ averageRating: -1 })
      .limit(4)
      .populate("creator", "name image avatarBgColor bio");

    res.json(courses);
  } catch (error) {
    console.error("Error retrieving featured courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. GET /api/landing/categories - Course counts by category
router.get("/categories", async (req, res) => {
  try {
    const categoriesAggregate = await Course.aggregate([
      { $match: { status: "published" } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      }
    ]);

    const countsMap = categoriesAggregate.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {} as Record<string, number>);

    // Return defined categories with counts (real count + UI config parameters)
    const categoriesList = [
      { id: "programming", name: "Programming", count: countsMap["Programming"] || 0, icon: "code" },
      { id: "design", name: "Design", count: countsMap["Design"] || 0, icon: "palette" },
      { id: "business", name: "Business", count: countsMap["Business"] || 0, icon: "briefcase" },
      { id: "languages", name: "Languages", count: countsMap["Languages"] || 0, icon: "globe" }
    ];

    res.json(categoriesList);
  } catch (error) {
    console.error("Error retrieving category counts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
