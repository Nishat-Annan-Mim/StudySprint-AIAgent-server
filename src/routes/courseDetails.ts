import { Router } from "express";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";
import mongoose from "mongoose";

const router = Router();

// 1. GET /api/courses/:id - Get detailed course information
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.query; // optional, to check enrollment state

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid Course ID" });
      return;
    }

    const course = await Course.findById(id).populate("creator", "name image avatarBgColor bio");
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    // Fetch reviews for this course
    const reviews = await Review.find({ course: id })
      .populate("student", "name image avatarBgColor")
      .sort({ createdAt: -1 });

    // Check if the given student is enrolled
    let isEnrolled = false;
    let studentProgress = 0;
    if (studentId && mongoose.Types.ObjectId.isValid(studentId as string)) {
      const enrollment = await Enrollment.findOne({
        student: studentId,
        course: id
      } as any);
      if (enrollment) {
        isEnrolled = true;
        studentProgress = enrollment.progress;
      }
    }

    res.json({
      course,
      reviews,
      isEnrolled,
      progress: studentProgress
    });
  } catch (error) {
    console.error("Error fetching course details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. POST /api/courses/:id/enroll - Enroll a student in the course
router.post("/:id/enroll", async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body; // Can be passed in body for mock simulation

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid Course ID" });
      return;
    }

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      res.status(400).json({ error: "Invalid or missing Student ID" });
      return;
    }

    // Ensure course exists
    const course = await Course.findById(id);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: studentId,
      course: id
    });

    if (existingEnrollment) {
      res.status(400).json({ error: "Student is already enrolled in this course" });
      return;
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      student: studentId,
      course: id,
      progress: 0,
      completed: false
    });

    res.status(201).json({
      message: "Successfully enrolled in course",
      enrollment
    });
  } catch (error) {
    console.error("Error enrolling student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. POST /api/courses/:id/reviews - Submit a review for the course
router.post("/:id/reviews", async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid Course ID" });
      return;
    }

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      res.status(400).json({ error: "Invalid or missing Student ID" });
      return;
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: "Rating must be a number between 1 and 5" });
      return;
    }

    // Verify student is enrolled before allowing a review
    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: id
    });

    if (!enrollment) {
      res.status(403).json({ error: "Only enrolled students can review this course" });
      return;
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      course: id,
      student: studentId
    });

    if (existingReview) {
      res.status(400).json({ error: "You have already reviewed this course" });
      return;
    }

    // Create review
    const newReview = await Review.create({
      course: id,
      student: studentId,
      rating: ratingNum,
      comment: comment || ""
    });

    // Recalculate average rating & count
    const reviews = await Review.find({ course: id });
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = Math.round((totalRating / reviews.length) * 10) / 10;

    await Course.findByIdAndUpdate(id, {
      averageRating,
      reviewCount: reviews.length
    });

    // Fetch user details for populated response
    const populatedReview = await Review.findById(newReview._id).populate("student", "name image avatarBgColor");

    res.status(201).json({
      message: "Review submitted successfully",
      review: populatedReview
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 4. GET /api/courses/:id/related - Get 4 related courses
router.get("/:id/related", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid Course ID" });
      return;
    }

    const course = await Course.findById(id);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    // Related courses: same category, excluding current course, limit 4
    const related = await Course.find({
      category: course.category,
      _id: { $ne: id },
      status: "published"
    })
      .limit(4)
      .populate("creator", "name image avatarBgColor");

    res.json(related);
  } catch (error) {
    console.error("Error fetching related courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
