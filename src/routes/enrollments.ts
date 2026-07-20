import { Router } from "express";
import { Enrollment } from "../models/Enrollment.js";
import { Course } from "../models/Course.js";
import { User } from "../models/User.js";
import mongoose from "mongoose";

const router = Router();

// ─── GET /api/enrollments?userId=xxx ─────────────────────────────────────────
// Get all enrollments for a user (with populated course data)
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }

    const enrollments = await Enrollment.find({ student: userId } as any)
      .sort({ enrolledAt: -1 })
      .populate({
        path: "course",
        populate: { path: "creator", select: "name image avatarBgColor" },
      })
      .lean();

    res.json({ enrollments });
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /api/enrollments ────────────────────────────────────────────────────
// Enroll a student in a course
router.post("/", async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ error: "Valid courseId is required." });
      return;
    }

    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: "User not found." }); return; }

    const course = await Course.findById(courseId);
    if (!course) { res.status(404).json({ error: "Course not found." }); return; }
    if (course.status !== "published") {
      res.status(400).json({ error: "Cannot enroll in an unpublished course." });
      return;
    }

    // Cannot enroll in your own course
    if (String(course.creator) === String(userId)) {
      res.status(400).json({ error: "Creators cannot enroll in their own courses." });
      return;
    }

    // Idempotent: already enrolled?
    const existing = await Enrollment.findOne({ student: userId, course: courseId } as any);
    if (existing) {
      res.status(200).json({ message: "Already enrolled.", enrollment: existing });
      return;
    }

    const enrollment = await Enrollment.create({
      student: userId,
      course: courseId,
      progress: 0,
      completed: false,
    });

    res.status(201).json({ message: "Enrolled successfully.", enrollment });
  } catch (error) {
    console.error("Error enrolling:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PATCH /api/enrollments/:id/progress ─────────────────────────────────────
// Update progress (0–100) and auto-complete at 100
router.patch("/:id/progress", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, progress } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid enrollment ID." });
      return;
    }

    const progressNum = parseInt(progress, 10);
    if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
      res.status(400).json({ error: "Progress must be 0–100." });
      return;
    }

    const enrollment = await Enrollment.findById(id);
    if (!enrollment) { res.status(404).json({ error: "Enrollment not found." }); return; }

    // Ownership check
    if (String(enrollment.student) !== String(userId)) {
      res.status(403).json({ error: "Not authorized to update this enrollment." });
      return;
    }

    enrollment.progress = progressNum;
    enrollment.completed = progressNum === 100;
    await enrollment.save();

    res.json({ message: "Progress updated.", enrollment });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /api/enrollments/check?userId=xxx&courseId=xxx ──────────────────────
// Quick check: is this user enrolled in this course?
router.get("/check", async (req, res) => {
  try {
    const { userId, courseId } = req.query;
    if (!userId || !courseId) {
      res.status(400).json({ error: "userId and courseId are required." });
      return;
    }

    const enrollment = await Enrollment.findOne({
      student: userId,
      course: courseId,
    } as any).lean();

    res.json({ enrolled: !!enrollment, enrollment: enrollment || null });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
