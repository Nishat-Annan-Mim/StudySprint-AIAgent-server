import { Router } from "express";
import { Review } from "../models/Review.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import mongoose from "mongoose";

const router = Router();

// ─── GET /api/reviews?courseId=xxx ───────────────────────────────────────────
// Get all reviews for a course
router.get("/", async (req, res) => {
  try {
    const { courseId } = req.query;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId as string)) {
      res.status(400).json({ error: "Valid courseId is required." });
      return;
    }

    const reviews = await Review.find({ course: courseId } as any)
      .populate("student", "name image avatarBgColor")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /api/reviews ────────────────────────────────────────────────────────
// Submit a review (enrolled students only, one per course)
router.post("/", async (req, res) => {
  try {
    const { userId, courseId, rating, comment } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ error: "Valid courseId is required." });
      return;
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: "Rating must be 1–5." });
      return;
    }

    const course = await Course.findById(courseId);
    if (!course) { res.status(404).json({ error: "Course not found." }); return; }

    // Must be enrolled to review
    const enrollment = await Enrollment.findOne({ student: userId, course: courseId } as any);
    if (!enrollment) {
      res.status(403).json({ error: "You must be enrolled in this course to leave a review." });
      return;
    }

    // One review per student per course
    const existing = await Review.findOne({ course: courseId, student: userId } as any);
    if (existing) {
      res.status(409).json({ error: "You have already reviewed this course." });
      return;
    }

    const review = await Review.create({
      course: courseId,
      student: userId,
      rating: ratingNum,
      comment: comment?.trim() || "",
    });

    // Recalculate course averageRating + reviewCount atomically
    const allReviews = await Review.find({ course: courseId } as any);
    const avgRating = Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length) * 10) / 10;
    await Course.findByIdAndUpdate(courseId, { averageRating: avgRating, reviewCount: allReviews.length });

    const populated = await Review.findById(review._id).populate("student", "name image avatarBgColor");
    res.status(201).json({ message: "Review submitted successfully.", review: populated });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── DELETE /api/reviews/:id ──────────────────────────────────────────────────
// Delete own review and recalculate course rating
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid review ID." });
      return;
    }

    const review = await Review.findById(id);
    if (!review) { res.status(404).json({ error: "Review not found." }); return; }
    if (String(review.student) !== String(userId)) {
      res.status(403).json({ error: "Not authorized to delete this review." });
      return;
    }

    const courseId = review.course;
    await Review.findByIdAndDelete(id);

    // Recalculate rating
    const remaining = await Review.find({ course: courseId } as any);
    const avgRating = remaining.length
      ? Math.round((remaining.reduce((s, r) => s + r.rating, 0) / remaining.length) * 10) / 10
      : 0;
    await Course.findByIdAndUpdate(courseId, { averageRating: avgRating, reviewCount: remaining.length });

    res.json({ message: "Review deleted." });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
