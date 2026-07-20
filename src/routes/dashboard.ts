import { Router } from "express";
import { User } from "../models/User.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { generateText } from "../services/aiService.js";
import mongoose from "mongoose";

const router = Router();

// ─── GET /api/dashboard?userId=xxx ──────────────────────────────────────────
// Returns: enrolled courses with progress, monthly chart data, AI recommendations
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    // ── 1. Enrolled courses with progress ────────────────────────────────
    const enrollments = await Enrollment.find({ student: userId } as any)
      .sort({ enrolledAt: -1 })
      .populate({
        path: "course",
        populate: { path: "creator", select: "name image avatarBgColor" },
      })
      .lean();

    // ── 2. Monthly chart data — enrollments per month (last 6 months) ────
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRaw = await Enrollment.aggregate([
      {
        $match: {
          student: new mongoose.Types.ObjectId(userId as string),
          enrolledAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$enrolledAt" },
            month: { $month: "$enrolledAt" },
          },
          count: { $sum: 1 },
          completed: { $sum: { $cond: ["$completed", 1, 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Build a full 6-month series (fill gaps with 0)
    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const found = monthlyRaw.find((r) => r._id.year === year && r._id.month === month);
      chartData.push({
        month: MONTH_NAMES[month - 1],
        enrolled: found?.count || 0,
        completed: found?.completed || 0,
      });
    }

    // ── 3. Overall stats ─────────────────────────────────────────────────
    const totalEnrolled = enrollments.length;
    const totalCompleted = enrollments.filter((e) => e.completed).length;
    const avgProgress = totalEnrolled
      ? Math.round(enrollments.reduce((s, e) => s + e.progress, 0) / totalEnrolled)
      : 0;

    res.json({
      user: {
        _id: (user as any)._id,
        name: user.name,
        email: user.email,
        image: user.image,
        avatarBgColor: user.avatarBgColor,
        role: user.role,
        bio: user.bio,
        learningGoals: user.learningGoals,
      },
      enrollments,
      chartData,
      stats: { totalEnrolled, totalCompleted, avgProgress },
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /api/dashboard/recommendations ────────────────────────────────────
// AI Feature B: recommendation engine
// Uses: user's learningGoals + enrolled categories to score unenrolled courses
router.post("/recommendations", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    // Get all courses the user is already enrolled in (populate category for AI context)
    const userEnrollments = await Enrollment.find({ student: userId } as any)
      .populate("course", "category")
      .lean();
    const enrolledCourseIds = userEnrollments.map((e: any) => String(e.course?._id || e.course));

    // Fetch all published courses NOT already enrolled in
    const availableCourses = await Course.find({
      status: "published",
      _id: { $nin: enrolledCourseIds
        .filter((id) => id.length === 24) // only valid ObjectId strings
        .map((id) => new mongoose.Types.ObjectId(id)) },
    } as any)
      .populate("creator", "name image avatarBgColor")
      .lean();

    if (availableCourses.length === 0) {
      res.json({ recommendations: [] });
      return;
    }

    // Build AI prompt context
    const goals = user.learningGoals?.join(", ") || "general learning";
    const enrolledCategories = [
      ...new Set(
        userEnrollments
          .map((e: any) => e.course?.category)
          .filter(Boolean)
      ),
    ].join(", ") || "none yet";

    const courseList = availableCourses.slice(0, 20).map((c, i) => ({
      index: i,
      id: String((c as any)._id),
      title: c.title,
      category: c.category,
      tags: c.tags?.slice(0, 5).join(", "),
      rating: c.averageRating,
    }));

    const prompt = `You are an intelligent course recommendation engine for StudySprint, a learning marketplace.

Student profile:
- Learning goals: ${goals}
- Categories already studying: ${enrolledCategories}

Available courses (choose the top 4 most relevant to this student's goals):
${courseList.map((c) => `[${c.index}] "${c.title}" (${c.category}) | tags: ${c.tags} | rating: ${c.rating}`).join("\n")}

Return ONLY a JSON array of up to 4 course indexes in order of relevance, e.g.: [2, 7, 0, 14]
No explanation, no markdown — only the raw JSON array.`;

    const rawResponse = await generateText(prompt, {
      systemPrompt: "You are a course recommendation engine. Respond with only a JSON array of indexes.",
      temperature: 0.3,
    });

    // Parse AI response
    let recommendedIndexes: number[] = [];
    try {
      const cleaned = rawResponse.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        recommendedIndexes = parsed.filter((i) => typeof i === "number" && i < courseList.length).slice(0, 4);
      }
    } catch {
      // Fallback: top-rated courses if AI parse fails
      recommendedIndexes = courseList
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 4)
        .map((c) => c.index);
    }

    const recommendations = recommendedIndexes.map((idx) => availableCourses[idx]).filter(Boolean);

    res.json({ recommendations });
  } catch (error: any) {
    console.error("Error generating recommendations:", error);
    // Graceful fallback: return top-rated available courses
    try {
      const userId = req.body.userId;
      const userEnrollments = await Enrollment.find({ student: userId } as any).lean();
      const enrolledCourseIds = userEnrollments.map((e) => String(e.course));
      const fallbackCourses = await Course.find({
        status: "published",
        _id: { $nin: enrolledCourseIds.map((id) => new mongoose.Types.ObjectId(id)) },
      } as any)
        .sort({ averageRating: -1 })
        .limit(4)
        .populate("creator", "name image avatarBgColor")
        .lean();
      res.json({ recommendations: fallbackCourses, fallback: true });
    } catch {
      res.json({ recommendations: [] });
    }
  }
});

export default router;
