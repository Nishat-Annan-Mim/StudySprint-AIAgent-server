import { User } from "../models/User.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Review } from "../models/Review.js";
import { getAuth } from "../lib/auth.js";
import mongoose from "mongoose";

export async function seedDatabase() {
  try {
    const courseCount = await Course.countDocuments();
    if (courseCount > 0) {
      console.log("[seed]: Database already has courses. Skipping seeding.");
      return;
    }

    console.log("[seed]: Starting database seeding with high-quality mock data...");

    // 1. Create Creators & Students
    const creator1 = await User.create({
      name: "Dr. Sarah Jenkins",
      email: "sarah.jenkins@studysprint.edu",
      role: "creator",
      bio: "Professor of Computer Science with 12+ years of teaching full-stack engineering and distributed systems.",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
      avatarBgColor: "#4f46e5",
      learningGoals: ["Advanced AI Research"]
    });

    const creator2 = await User.create({
      name: "Alex Rivera",
      email: "alex.design@studysprint.io",
      role: "creator",
      bio: "Product designer and design systems lead at Google. Specializes in accessible UX design and Figma pipelines.",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
      avatarBgColor: "#06b6d4",
      learningGoals: ["React Native Frameworks"]
    });

    const creator3 = await User.create({
      name: "Sophia Martinez",
      email: "sophia.lang@studysprint.org",
      role: "creator",
      bio: "Polyglot and professional language coach speaking 6 languages. Focuses on rapid immersion learning.",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
      avatarBgColor: "#f59e0b",
      learningGoals: ["Public Speaking", "Instructional Design"]
    });

    const student1 = await User.create({
      name: "Emma Watson",
      email: "emma@student.studysprint.com",
      role: "student",
      bio: "Aspiring front-end developer transitioning from a hospitality background.",
      avatarBgColor: "#ec4899",
      learningGoals: ["React", "CSS Grid", "JavaScript Fundamentals"]
    });

    const student2 = await User.create({
      name: "John Doe",
      email: "john.doe@student.studysprint.com",
      role: "student",
      bio: "Business administration student keen on learning tech integrations.",
      avatarBgColor: "#8b5cf6",
      learningGoals: ["Product Management", "AI Workflows"]
    });

    // ─── Create Better Auth credential accounts for seeded users ───────────
    // Better Auth stores passwords in a separate "accounts" collection.
    // Without these records, the demo login will ALWAYS fail — Better Auth
    // will have no credential linked to these email addresses.
    try {
      const auth = getAuth();
      const ctx = await (auth as any).$context;
      const hashedPassword = await ctx.password.hash("password123");

      const accountsCollection = mongoose.connection.collection("accounts");

      const seedUsers = [
        { user: creator1, email: creator1.email },
        { user: creator2, email: creator2.email },
        { user: creator3, email: creator3.email },
        { user: student1, email: student1.email },
        { user: student2, email: student2.email },
      ];

      for (const { user, email } of seedUsers) {
        // Check if account already exists
        const existingAccount = await accountsCollection.findOne({
          userId: String((user as any)._id),
          providerId: "credential",
        });

        if (!existingAccount) {
          await accountsCollection.insertOne({
            id: new mongoose.Types.ObjectId().toHexString(),
            userId: String((user as any)._id),
            providerId: "credential",
            accountId: email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      console.log("[seed]: Better Auth credential accounts created for all seeded users.");
    } catch (authErr) {
      console.warn("[seed]: Could not create Better Auth accounts (non-fatal):", authErr);
    }

    // 2. Create Courses
    const c1 = await Course.create({
      title: "Full-Stack Web Development Bootcamp",
      shortDescription: "Master React, Node.js, Express, and MongoDB from scratch with production projects.",
      fullDescription: "A comprehensive program designed to take you from a absolute coding beginner to a confident full-stack software engineer. This bootcamp is heavily focused on modern software design patterns, Clean Code principles, and build pipelines. You will build and deploy five real-world web apps.",
      creator: creator1._id,
      category: "Programming",
      price: 99.99,
      format: "online",
      location: "Online",
      coverImageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      reviewCount: 2,
      tags: ["React", "Node.js", "MongoDB", "Express", "TypeScript"],
      syllabus: [
        { title: "HTML5, CSS3, & Modern Styling", content: "Learn semantic layout design, flexbox, grid, and responsiveness." },
        { title: "Advanced Javascript & ES6+", content: "Deep dive into promises, scopes, closures, async/await, and fetch." },
        { title: "React Frontend Systems", content: "Component architecture, hooks, state management with Zustand, and routes." },
        { title: "Express RESTful APIs", content: "Router creation, server security, database persistence, and middleware." }
      ],
      status: "published"
    });

    const c2 = await Course.create({
      title: "Mastering Figma & UI Design Systems",
      shortDescription: "Build scalable design systems, master auto-layout, components, and variables in Figma.",
      fullDescription: "Learn to design premium, state-of-the-art web interfaces using Figma. We will dive deep into component variants, advanced variables, auto-layout 5.0, library sharing, and design handoffs that developers will love.",
      creator: creator2._id,
      category: "Design",
      price: 49.99,
      format: "online",
      location: "Online",
      coverImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.9,
      reviewCount: 1,
      tags: ["Figma", "UI/UX Design", "Design Systems", "Web Design"],
      syllabus: [
        { title: "Foundational UX and Spacing Scales", content: "Understand user psychology, typography grids, and standard 8px padding scaling." },
        { title: "Auto-Layout Mastery", content: "Learn dynamic sizing, min/max dimensions, and wrapping mechanics." },
        { title: "Component Systems and Props", content: "Build variants, booleans, instances, and interactive components." },
        { title: "Token Variables for Light/Dark Mode", content: "Create variables for spacing, color tokens, and quick theme swapping." }
      ],
      status: "published"
    });

    const c3 = await Course.create({
      title: "AI-Powered Business Automation",
      shortDescription: "Leverage Large Language Models and workflow tools to automate repetitive admin work.",
      fullDescription: "Discover how to integrate AI tools like OpenRouter, OpenAI, Make.com, and Notion to build automatic email sorters, auto-updating customer CRM sheets, and custom LLM chatbots that understand your company docs.",
      creator: creator1._id,
      category: "Business",
      price: 0, // Free course
      format: "online",
      location: "Online",
      coverImageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      reviewCount: 1,
      tags: ["AI", "Automation", "ChatGPT", "CRM Automation"],
      syllabus: [
        { title: "Prompt Engineering Essentials", content: "Learn structured templates, zero-shot/few-shot prompts, and constraints." },
        { title: "Connecting OpenRouter APIs", content: "Configure credentials, make server-side curl operations, and stream completions." },
        { title: "Low-code Workflow Builders", content: "Link data schemas across sheets, Notion pages, and AI nodes." }
      ],
      status: "published"
    });

    const c4 = await Course.create({
      title: "Conversational Spanish: Zero to Fluent",
      shortDescription: "Acquire Spanish speaking confidence through contextual immersion and vocabulary tricks.",
      fullDescription: "Ditch boring grammar drills. In this workshop, you will learn to speak immediately using simple semantic frameworks, active conversational scripts, and memory cues designed by polyglots.",
      creator: creator3._id,
      category: "Languages",
      price: 29.99,
      format: "online",
      location: "Online",
      coverImageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      reviewCount: 1,
      tags: ["Spanish", "Language Learning", "Conversational Skills"],
      syllabus: [
        { title: "The 300 Core Vocabulary Words", content: "Understand 80% of everyday speaking using the Pareto Principle." },
        { title: "Subject-Verb Frameworks", content: "Master past, present, and future verbs without memorization tables." },
        { title: "Real-world Situational immersion", content: "Practice roleplay sessions for shopping, ordering, and asking directions." }
      ],
      status: "published"
    });

    // 3. Create Enrollments
    await Enrollment.create({
      student: student1._id,
      course: c1._id,
      progress: 45,
      completed: false
    });

    await Enrollment.create({
      student: student2._id,
      course: c1._id,
      progress: 100,
      completed: true
    });

    await Enrollment.create({
      student: student1._id,
      course: c2._id,
      progress: 15,
      completed: false
    });

    await Enrollment.create({
      student: student2._id,
      course: c3._id,
      progress: 80,
      completed: false
    });

    // 4. Create Reviews
    await Review.create({
      course: c1._id,
      student: student1._id,
      rating: 5,
      comment: "Incredible bootcamp. The projects are actually valuable to show to employers, and explanations are clear."
    });

    await Review.create({
      course: c1._id,
      student: student2._id,
      rating: 4,
      comment: "Highly structured. Learned modern TS patterns which were missing in other React courses."
    });

    await Review.create({
      course: c2._id,
      student: student1._id,
      rating: 5,
      comment: "Perfect Figma course. Learnt Design Tokens and Advanced variables which helped land my first UX job!"
    });

    await Review.create({
      course: c3._id,
      student: student2._id,
      rating: 5,
      comment: "A practical guide to LLM automations. The instructions are detailed and templates are easy to customize."
    });

    await Review.create({
      course: c4._id,
      student: student1._id,
      rating: 4,
      comment: "Great conversational practice. Highly recommended if you want to speak Spanish confidently."
    });

    console.log("[seed]: Database seeding finished successfully!");
  } catch (error) {
    console.error("[seed]: Error during database seeding:", error);
  }
}
