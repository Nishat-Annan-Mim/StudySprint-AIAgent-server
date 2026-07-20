// ⚠️  dotenv MUST be loaded before any module that reads process.env at init-time
// (e.g. aiService.ts creates the OpenAI client on import)
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { connectDB } from "./config/db.js";
import { getAuth } from "./lib/auth.js";
import landingRoutes from "./routes/landing.js";
import coursesRoutes from "./routes/courses.js";
import courseDetailsRoutes from "./routes/courseDetails.js";
import enrollmentsRoutes from "./routes/enrollments.js";
import reviewsRoutes from "./routes/reviews.js";
import dashboardRoutes from "./routes/dashboard.js";
import profileRoutes from "./routes/profile.js";
import aiRoutes from "./routes/ai.js";
import { seedDatabase } from "./config/seed.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with credentials for Better Auth session cookies
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

// ─── Better Auth handler ─────────────────────────────────────────────────────
// Express 5 requires named wildcards — "/api/auth/*" crashes; use "{*path}" instead
app.all("/api/auth/{*path}", (req, res) => {
  try {
    const auth = getAuth();
    return toNodeHandler(auth)(req, res);
  } catch (error) {
    console.error("Auth handler error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/landing",      landingRoutes);       // landing page data
app.use("/api/courses",      coursesRoutes);       // GET list, GET/manage, POST create, DELETE
app.use("/api/courses",      courseDetailsRoutes); // GET/:id, POST/:id/enroll, POST/:id/reviews, GET/:id/related
app.use("/api/enrollments",  enrollmentsRoutes);   // GET, POST, PATCH progress, GET /check
app.use("/api/reviews",      reviewsRoutes);       // GET, POST, DELETE
app.use("/api/dashboard",    dashboardRoutes);     // GET dashboard data, POST recommendations
app.use("/api/profile",      profileRoutes);       // GET, PUT, POST change-password
app.use("/api/ai",           aiRoutes);            // Feature A: generate-content, B: recommendations+log, C: chat

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "StudySprint API is running",
    version: "1.0.0",
    features: ["auth", "courses", "enrollments", "reviews", "dashboard", "profile", "ai-content", "ai-recommendations", "ai-chat"],
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await connectDB();
    await seedDatabase();
    app.listen(PORT, () => {
      console.log(`[server]: StudySprint API running at http://localhost:${PORT}`);
      console.log(`[server]: AI features: Content Generator ✓ | Recommendations ✓ | Chat Advisor ✓`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
