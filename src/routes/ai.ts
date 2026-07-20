import { Router, Request, Response } from "express";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { ChatSession } from "../models/ChatSession.js";
import { RecommendationLog } from "../models/RecommendationLog.js";
import { User } from "../models/User.js";
import { generateText, generateStream } from "../services/aiService.js";
import mongoose from "mongoose";

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
//  FEATURE A — /api/ai/generate-content
//  AI Course Description Generator
//  Inputs: title, category, keywords, tone, length, previousVersions (for regen)
//  Returns: shortDescription + fullDescription (one coherent call)
// ══════════════════════════════════════════════════════════════════════════════
router.post("/generate-content", async (req, res) => {
  try {
    const { title, category, keywords, tone = "professional", length = "medium", previousVersions } = req.body;

    if (!title || !category) {
      res.status(400).json({ error: "title and category are required." });
      return;
    }

    const keywordsText = keywords ? ` Topics/keywords: ${keywords}.` : "";
    const toneInstr = tone === "casual" ? "Use a warm, conversational tone."
      : tone === "inspiring" ? "Use an inspiring, motivational tone."
      : "Use a clear, professional tone.";
    const lengthInstr = length === "short"
      ? "Keep the full description to 2 concise paragraphs."
      : length === "long"
      ? "Write the full description in 5–6 detailed paragraphs."
      : "Write the full description in 3–4 balanced paragraphs.";

    // If previous versions provided, instruct AI to vary from them
    let regen = "";
    if (Array.isArray(previousVersions) && previousVersions.length > 0) {
      const summaries = previousVersions
        .slice(0, 3)
        .map((v: any, i: number) => `Version ${i + 1}: "${v.shortDescription?.slice(0, 60)}..."`)
        .join("\n");
      regen = `\n\nPrevious generated versions (create a meaningfully different variation):\n${summaries}`;
    }

    const systemPrompt = `You are an expert course copywriter for StudySprint, an online learning marketplace.
${toneInstr} ${lengthInstr}
Always return ONLY a valid JSON object with keys "shortDescription" (1–2 sentences, max 200 chars) and "fullDescription" (plain text paragraphs, no markdown).`;

    const userPrompt = `Write course descriptions for: "${title}" in the "${category}" category.${keywordsText}${regen}
Return ONLY: {"shortDescription":"...","fullDescription":"..."}`;

    const raw = await generateText(userPrompt, { systemPrompt, temperature: regen ? 0.9 : 0.7 });

    let parsed: { shortDescription: string; fullDescription: string };
    try {
      parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      const sm = raw.match(/"shortDescription"\s*:\s*"([^"]+)"/);
      const fm = raw.match(/"fullDescription"\s*:\s*"([\s\S]+?)(?:"\s*}|",)/);
      parsed = {
        shortDescription: sm?.[1] || "A comprehensive course to master key skills.",
        fullDescription: fm?.[1] || raw.slice(0, 600),
      };
    }

    res.json({
      shortDescription: parsed.shortDescription || "",
      fullDescription: parsed.fullDescription || "",
    });
  } catch (error: any) {
    console.error("AI content gen error:", error);
    if (error?.status === 401 || String(error?.message).includes("key")) {
      res.status(503).json({ error: "AI not configured. Set OPENROUTER_API_KEY.", fallback: true });
      return;
    }
    res.status(500).json({ error: "Failed to generate content." });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  FEATURE B — /api/ai/recommendations
//  Smart Recommendation Engine with RecommendationLog
//  GET  : fetch current recommendations
//  POST : log an interaction (clicked / dismissed)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/ai/recommendations?userId=xxx
router.get("/recommendations", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }

    const user = await User.findById(userId).lean();
    if (!user) { res.status(404).json({ error: "User not found." }); return; }

    // Enrolled courses — skip these (populate category for AI context)
    const enrollments = await Enrollment.find({ student: userId } as any)
      .populate("course", "category")
      .lean();
    const enrolledIds = enrollments.map((e: any) => String(e.course?._id || e.course));

    // Recent dismissals (last 30 days) — don't show these
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dismissed = await RecommendationLog.find({
      user: userId,
      action: "dismissed",
      timestamp: { $gte: thirtyDaysAgo },
    } as any).lean();
    const dismissedIds = dismissed.map((d) => String(d.course));

    // Recent clicks — boost these categories
    const clicked = await RecommendationLog.find({
      user: userId,
      action: "clicked",
      timestamp: { $gte: thirtyDaysAgo },
    } as any).populate("course", "category").lean();
    const clickedCategories = [...new Set(clicked.map((c: any) => c.course?.category).filter(Boolean))];

    // Exclude enrolled + dismissed
    const excludeIds = [...new Set([...enrolledIds, ...dismissedIds])]
      .filter((id) => id.length === 24)
      .map((id) => new mongoose.Types.ObjectId(id));

    const availableCourses = await Course.find({
      status: "published",
      _id: { $nin: excludeIds },
    } as any)
      .populate("creator", "name image avatarBgColor")
      .lean();

    if (availableCourses.length === 0) {
      res.json({ recommendations: [], fallback: false });
      return;
    }

    // Build rich context for the LLM
    const goals = user.learningGoals?.join(", ") || "general learning";
    const enrolledCategories = [...new Set(enrollments.map((e: any) => e.course?.category).filter(Boolean))].join(", ") || "none";

    const courseList = availableCourses.slice(0, 25).map((c, i) => ({
      index: i,
      id: String((c as any)._id),
      title: c.title,
      category: c.category,
      tags: (c.tags || []).slice(0, 5).join(", "),
      rating: c.averageRating,
    }));

    const clickBoost = clickedCategories.length
      ? `\nUser recently clicked courses in: ${clickedCategories.join(", ")} — give these a boost.`
      : "";

    const prompt = `You are an adaptive course recommendation engine for StudySprint.

Student context:
- Learning goals: ${goals}
- Already studying: ${enrolledCategories}${clickBoost}

Available courses (choose the top 6 most relevant):
${courseList.map((c) => `[${c.index}] "${c.title}" (${c.category}) | tags: ${c.tags} | ⭐${c.rating}`).join("\n")}

Return ONLY a JSON array of up to 6 course indexes in descending relevance, e.g.: [2, 7, 0, 14, 3, 9]`;

    const raw = await generateText(prompt, {
      systemPrompt: "You are a course recommendation engine. Respond with ONLY a JSON array of indexes.",
      temperature: 0.3,
    });

    let indexes: number[] = [];
    try {
      const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
      if (Array.isArray(parsed)) {
        indexes = parsed.filter((i) => typeof i === "number" && i < courseList.length).slice(0, 6);
      }
    } catch {
      // Fallback: top-rated
      indexes = courseList.sort((a, b) => b.rating - a.rating).slice(0, 6).map((c) => c.index);
    }

    const recommendations = indexes.map((i) => availableCourses[i]).filter(Boolean);
    res.json({ recommendations, fallback: false });
  } catch (error: any) {
    console.error("Recommendation error:", error);
    // Graceful fallback
    try {
      const userId = req.query.userId as string;
      const enrollments = await Enrollment.find({ student: userId } as any).lean();
      const enrolledIds = enrollments.map((e) => String(e.course));
      const fallback = await Course.find({
        status: "published",
        _id: { $nin: enrolledIds.map((id) => new mongoose.Types.ObjectId(id)) },
      } as any)
        .sort({ averageRating: -1 })
        .limit(6)
        .populate("creator", "name image avatarBgColor")
        .lean();
      res.json({ recommendations: fallback, fallback: true });
    } catch {
      res.json({ recommendations: [], fallback: true });
    }
  }
});

// POST /api/ai/recommendations/log — log a user interaction
router.post("/recommendations/log", async (req, res) => {
  try {
    const { userId, courseId, action } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ error: "Valid courseId is required." });
      return;
    }
    if (!["clicked", "dismissed", "enrolled"].includes(action)) {
      res.status(400).json({ error: "action must be: clicked | dismissed | enrolled" });
      return;
    }

    await RecommendationLog.create({ user: userId, course: courseId, action, timestamp: new Date() });
    res.json({ message: "Interaction logged." });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  FEATURE C — /api/ai/chat
//  Agentic Study Advisor with streaming, tool use, ChatSession memory
// ══════════════════════════════════════════════════════════════════════════════

// ── Internal tool functions (agentic "tool calls") ───────────────────────────

async function getMyEnrollments(userId: string) {
  const enrollments = await Enrollment.find({ student: userId } as any)
    .populate("course", "title category progress")
    .lean();
  return enrollments.map((e: any) => ({
    title: e.course?.title || "Unknown",
    category: e.course?.category || "Unknown",
    progress: e.progress,
    completed: e.completed,
  }));
}

async function getCourseById(courseId: string) {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  const course = await Course.findById(courseId)
    .populate("creator", "name")
    .lean();
  if (!course) return null;
  return {
    title: course.title,
    shortDescription: course.shortDescription,
    category: course.category,
    price: course.price,
    format: course.format,
    averageRating: course.averageRating,
    creator: (course as any).creator?.name,
  };
}

async function searchCourses(query: string, category?: string) {
  const filter: any = { status: "published" };
  if (query) filter.$or = [
    { title: { $regex: query, $options: "i" } },
    { tags: { $regex: query, $options: "i" } },
  ];
  if (category) filter.category = category;
  const results = await Course.find(filter).limit(5).select("title category price averageRating").lean();
  return results.map((c) => ({ title: c.title, category: c.category, price: c.price, rating: c.averageRating }));
}

// Resolve tool calls from the AI response
async function resolveTools(userId: string, message: string): Promise<string | null> {
  const lower = message.toLowerCase();

  // Tool: getMyEnrollments
  if (lower.includes("enrolled") || lower.includes("my courses") || lower.includes("taking") || lower.includes("studying")) {
    const data = await getMyEnrollments(userId);
    if (data.length === 0) return "The student has no current enrollments.";
    return `Student's enrollments: ${JSON.stringify(data)}`;
  }

  // Tool: searchCourses  
  if (lower.includes("find course") || lower.includes("search for") || lower.includes("show me courses") || lower.includes("courses about")) {
    const match = lower.match(/(?:about|for|on|in)\s+([a-z\s]+?)(?:\?|$|,)/);
    const query = match?.[1]?.trim() || "";
    if (query) {
      const results = await searchCourses(query);
      return results.length
        ? `Available courses matching "${query}": ${JSON.stringify(results)}`
        : `No courses found matching "${query}".`;
    }
  }

  return null; // No tool triggered
}

// POST /api/ai/chat — main chat endpoint with streaming
router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { userId, message, context } = req.body;
    // context: { type: 'course' | 'dashboard' | 'general', courseId?: string }

    if (!userId || !message?.trim()) {
      res.status(400).json({ error: "userId and message are required." });
      return;
    }

    // ── Load or create ChatSession ────────────────────────────────────────
    let session = await ChatSession.findOne({ user: userId } as any);
    if (!session) {
      session = await ChatSession.create({ user: userId, messages: [] });
    }

    // ── Agentic: check if user message triggers a tool call ───────────────
    let toolResult: string | null = null;
    try {
      toolResult = await resolveTools(userId, message.trim());
    } catch {
      // Non-fatal — continue without tool data
    }

    // ── Build context injection ───────────────────────────────────────────
    let contextBlock = "";
    if (context?.type === "course" && context.courseId) {
      const courseData = await getCourseById(context.courseId);
      if (courseData) {
        contextBlock = `\n\n[Page context: User is viewing course "${courseData.title}" (${courseData.category}, ${courseData.format}, ⭐${courseData.averageRating}, $${courseData.price})]`;
      }
    } else if (context?.type === "dashboard") {
      const enrollments = await getMyEnrollments(userId);
      contextBlock = `\n\n[Page context: User is on their dashboard. Current enrollments: ${JSON.stringify(enrollments)}]`;
    }

    // ── System prompt ─────────────────────────────────────────────────────
    const systemPrompt = `You are StudySprint's AI Study Advisor — a helpful, knowledgeable, and friendly learning coach.
Your role: help students choose courses, understand their learning journey, plan study schedules, and motivate them.
Be concise and actionable. Use friendly, encouraging language. Format with short paragraphs.
If you have course/enrollment data from tool calls, use it to give specific, personalised answers — never guess.
Never make up course names or prices; only reference data you've been given.${contextBlock}`;

    // ── Conversation history (last 10 messages for context window) ────────
    const historyMessages = session.messages
      .slice(-10)
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Add tool result as extra context in the user message if available
    const enrichedUserMessage = toolResult
      ? `${message.trim()}\n\n[Tool data: ${toolResult}]`
      : message.trim();

    // ── Stream response ───────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const allMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
      ...historyMessages,
      { role: "user", content: enrichedUserMessage },
    ];

    const stream = await generateStream(allMessages, { systemPrompt, temperature: 0.7 });

    let fullResponse = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
      }
    }

    // ── Persist to ChatSession ────────────────────────────────────────────
    session.messages.push(
      { role: "user", content: message.trim(), timestamp: new Date() },
      { role: "assistant", content: fullResponse, timestamp: new Date() }
    );
    // Keep last 50 messages to avoid unbounded growth
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }
    await session.save();

    // ── Generate follow-up suggestions ────────────────────────────────────
    const followUps = generateFollowUps(message, context?.type);
    res.write(`data: ${JSON.stringify({ type: "done", followUps })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Chat error:", error);
    if (!res.headersSent) {
      if (error?.status === 401 || String(error?.message).includes("key")) {
        res.status(503).json({ error: "AI not configured. Set OPENROUTER_API_KEY." });
      } else {
        res.status(500).json({ error: "Chat failed. Please try again." });
      }
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", content: "Something went wrong. Please try again." })}\n\n`);
      res.end();
    }
  }
});

// GET /api/ai/chat/history?userId=xxx — load chat history
router.get("/chat/history", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }

    const session = await ChatSession.findOne({ user: userId } as any).lean();
    const messages = session?.messages || [];

    res.json({ messages: messages.filter((m) => m.role !== "system") });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/ai/chat/history?userId=xxx — clear chat history
router.delete("/chat/history", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) { res.status(400).json({ error: "userId is required." }); return; }

    await ChatSession.findOneAndUpdate(
      { user: userId } as any,
      { $set: { messages: [] } }
    );
    res.json({ message: "Chat history cleared." });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── Helper: generate contextual follow-up suggestions ────────────────────────
function generateFollowUps(lastMessage: string, contextType?: string): string[] {
  const lower = lastMessage.toLowerCase();

  if (lower.includes("recommend") || lower.includes("suggest")) {
    return ["Show me beginner courses", "What's popular in Programming?", "Help me build a learning plan"];
  }
  if (lower.includes("enroll") || lower.includes("course")) {
    return ["What are the prerequisites?", "How long will it take?", "Are there free options?"];
  }
  if (contextType === "dashboard") {
    return ["How do I improve my progress?", "What should I study next?", "Create a weekly study plan"];
  }
  if (contextType === "course") {
    return ["Is this course right for me?", "What will I be able to do after?", "Compare with similar courses"];
  }
  return ["What courses do you recommend?", "How do I get started?", "Show my enrolled courses"];
}

export default router;
