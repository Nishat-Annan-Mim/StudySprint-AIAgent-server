import { Router } from "express";
import { Course } from "../models/Course.js";
import { User } from "../models/User.js";
import { Enrollment } from "../models/Enrollment.js";
import { Review } from "../models/Review.js";
import { generateText } from "../services/aiService.js";
import mongoose from "mongoose";

const router = Router();

// ─── GET /api/courses ────────────────────────────────────────────────────────
// Public: query and filter published courses
router.get("/", async (req, res) => {
  try {
    const {
      search, category, minPrice, maxPrice,
      minRating, location, sort, page = "1", limit = "8",
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const filterQuery: any = { status: "published" };

    if (search) {
      filterQuery.$or = [
        { title: { $regex: search as string, $options: "i" } },
        { tags: { $regex: search as string, $options: "i" } },
      ];
    }
    if (category && category !== "All") filterQuery.category = category;
    if (minPrice || maxPrice) {
      filterQuery.price = {};
      if (minPrice) filterQuery.price.$gte = parseFloat(minPrice as string);
      if (maxPrice) filterQuery.price.$lte = parseFloat(maxPrice as string);
    }
    if (minRating) filterQuery.averageRating = { $gte: parseFloat(minRating as string) };
    if (location && location !== "All") filterQuery.location = location;

    let sortOption: any = {};
    if (sort === "newest") sortOption = { createdAt: -1 };
    else if (sort === "price-low-high") sortOption = { price: 1 };
    else if (sort === "price-high-low") sortOption = { price: -1 };
    else if (sort === "rating-high") sortOption = { averageRating: -1 };
    else sortOption = { createdAt: -1 };

    const totalCount = await Course.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalCount / limitNum);
    const courses = await Course.find(filterQuery)
      .sort(sortOption)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate("creator", "name image avatarBgColor");

    res.json({ courses, totalCount, totalPages, currentPage: pageNum });
  } catch (error) {
    console.error("Error querying courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /api/courses/manage?userId=xxx ─────────────────────────────────────
// Dual-mode:
//   creator/admin → returns all their own courses with per-course enrollment counts
//   student       → returns all their enrolled courses with progress data
router.get("/manage", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
      res.status(400).json({ error: "Valid userId query param is required." });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    if (user.role === "creator" || user.role === "admin") {
      // CREATOR MODE — own courses with enrollment counts
      const courses = await Course.find({ creator: userId } as any)
        .sort({ createdAt: -1 })
        .lean();

      const courseIds = courses.map((c) => c._id);
      const enrollmentCounts = await Enrollment.aggregate([
        { $match: { course: { $in: courseIds } } },
        { $group: { _id: "$course", count: { $sum: 1 } } },
      ]);
      const countMap: Record<string, number> = {};
      enrollmentCounts.forEach((e) => { countMap[String(e._id)] = e.count; });

      const result = courses.map((course) => ({
        ...course,
        enrollmentCount: countMap[String(course._id)] || 0,
      }));

      res.json({ mode: "creator", courses: result, user: { name: user.name, role: user.role } });
    } else {
      // STUDENT MODE — enrolled courses with progress
      const enrollments = await Enrollment.find({ student: userId } as any)
        .sort({ enrolledAt: -1 })
        .populate({
          path: "course",
          populate: { path: "creator", select: "name image avatarBgColor" },
        })
        .lean();

      res.json({ mode: "student", enrollments, user: { name: user.name, role: user.role } });
    }
  } catch (error) {
    console.error("Error fetching manage data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /api/courses ───────────────────────────────────────────────────────
// Create a new course; auto-promotes student → creator
router.post("/", async (req, res) => {
  try {
    const {
      userId, title, shortDescription, fullDescription,
      category, price, startDate, format, location,
      coverImageUrl, tags, syllabus, status,
    } = req.body;

    if (!userId) {
      res.status(401).json({ error: "User ID is required. Please log in." });
      return;
    }
    if (!title || !shortDescription || !fullDescription || !category) {
      res.status(400).json({ error: "Title, descriptions, and category are required." });
      return;
    }

    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: "User not found." }); return; }

    // Auto-promote student → creator on first course creation
    if (user.role === "student") await User.findByIdAndUpdate(userId, { role: "creator" });

    const parsedTags: string[] = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
      ? tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : [];

    const course = await Course.create({
      title: title.trim(),
      shortDescription: shortDescription.trim(),
      fullDescription: fullDescription.trim(),
      creator: userId,
      category,
      price: parseFloat(price) || 0,
      startDate: startDate ? new Date(startDate) : undefined,
      format: format || "online",
      location: format === "in-person" ? (location || "TBD") : "Online",
      coverImageUrl: coverImageUrl?.trim() || "",
      tags: parsedTags,
      syllabus: Array.isArray(syllabus) ? syllabus : [],
      status: status === "published" ? "published" : "draft",
    });

    const populated = await Course.findById(course._id)
      .populate("creator", "name image avatarBgColor bio");
    res.status(201).json({ message: "Course created successfully", course: populated });
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /api/courses/generate-description ──────────────────────────────────
// AI-powered course description generator via OpenRouter
router.post("/generate-description", async (req, res) => {
  try {
    const { title, category, keywords } = req.body;

    if (!title || !category) {
      res.status(400).json({ error: "Title and category are required to generate a description." });
      return;
    }

    const keywordsText = keywords ? ` Keywords/topics: ${keywords}.` : "";
    const systemPrompt = `You are an expert course copywriter for an online learning marketplace called StudySprint.
Your task is to write compelling, clear, and professional course descriptions that convert visitors to enrollments.
Always return a JSON object with exactly two keys: "shortDescription" (1-2 sentences, max 200 characters) and "fullDescription" (3-5 paragraphs, markdown-free plain text).
Do not include any markdown, headers, or bullet points — plain paragraphs only.`;

    const userPrompt = `Write course descriptions for a course titled "${title}" in the "${category}" category.${keywordsText}
Return ONLY a valid JSON object in this exact format:
{"shortDescription": "...", "fullDescription": "..."}`;

    const rawResponse = await generateText(userPrompt, { systemPrompt, temperature: 0.7 });

    let parsed: { shortDescription: string; fullDescription: string };
    try {
      const cleaned = rawResponse.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const shortMatch = rawResponse.match(/"shortDescription"\s*:\s*"([^"]+)"/);
      const fullMatch = rawResponse.match(/"fullDescription"\s*:\s*"([\s\S]+?)(?:"\s*}|",)/);
      parsed = {
        shortDescription: shortMatch?.[1] || "A comprehensive course designed to help you master key skills.",
        fullDescription: fullMatch?.[1] || rawResponse.slice(0, 600),
      };
    }

    res.json({
      shortDescription: parsed.shortDescription || "",
      fullDescription: parsed.fullDescription || "",
    });
  } catch (error: any) {
    console.error("Error generating description:", error);
    if (error?.status === 401 || String(error?.message).includes("key")) {
      res.status(503).json({
        error: "AI service is not configured. Please set OPENROUTER_API_KEY in server/.env.",
        fallback: true,
      });
      return;
    }
    res.status(500).json({ error: "Failed to generate description. Please try again." });
  }
});

// ─── DELETE /api/courses/:id ─────────────────────────────────────────────────
// Delete a course; cascade-deletes its enrollments and reviews
// Only the creator or an admin may delete
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid course ID." });
      return;
    }
    if (!userId) {
      res.status(401).json({ error: "userId is required." });
      return;
    }

    const course = await Course.findById(id);
    if (!course) { res.status(404).json({ error: "Course not found." }); return; }

    const user = await User.findById(userId);
    const isCreator = String(course.creator) === String(userId);
    const isAdmin = user?.role === "admin";
    if (!isCreator && !isAdmin) {
      res.status(403).json({ error: "You are not authorised to delete this course." });
      return;
    }

    // Cascade delete
    await Enrollment.deleteMany({ course: id });
    await Review.deleteMany({ course: id });
    await Course.findByIdAndDelete(id);

    res.json({ message: "Course deleted successfully." });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
