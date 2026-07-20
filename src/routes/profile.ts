import { Router } from "express";
import { User } from "../models/User.js";
import mongoose from "mongoose";

const router = Router();

// ─── GET /api/profile?userId=xxx ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }
    const user = await User.findById(userId).lean();
    if (!user) { res.status(404).json({ error: "User not found." }); return; }

    // Never return sensitive auth fields
    res.json({
      _id: (user as any)._id,
      name: user.name,
      email: user.email,
      image: user.image,
      avatarBgColor: user.avatarBgColor,
      role: user.role,
      bio: user.bio,
      learningGoals: user.learningGoals,
      emailVerified: user.emailVerified,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PUT /api/profile ─────────────────────────────────────────────────────────
// Update: name, image, bio, learningGoals
router.put("/", async (req, res) => {
  try {
    const { userId, name, image, bio, learningGoals } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: "Valid userId is required." });
      return;
    }
    if (!name?.trim()) {
      res.status(400).json({ error: "Name is required." });
      return;
    }

    // Parse learningGoals — accept string[] or comma-separated string
    let parsedGoals: string[] = [];
    if (Array.isArray(learningGoals)) {
      parsedGoals = learningGoals.map((g: string) => g.trim()).filter(Boolean);
    } else if (typeof learningGoals === "string") {
      parsedGoals = learningGoals.split(",").map((g) => g.trim()).filter(Boolean);
    }

    const updateData: any = {
      name: name.trim(),
      bio: bio?.trim() || "",
      learningGoals: parsedGoals,
    };

    // Only update image if provided (allow clearing with empty string)
    if (image !== undefined) {
      updateData.image = image?.trim() || null;
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) { res.status(404).json({ error: "User not found." }); return; }

    res.json({
      message: "Profile updated successfully.",
      user: {
        _id: (updated as any)._id,
        name: updated.name,
        email: updated.email,
        image: updated.image,
        avatarBgColor: updated.avatarBgColor,
        role: updated.role,
        bio: updated.bio,
        learningGoals: updated.learningGoals,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /api/profile/change-password ──────────────────────────────────────
// Change password: verify current password via Better Auth, then update
// Since Better Auth manages passwords, we delegate via its admin API
router.post("/change-password", async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      res.status(400).json({ error: "userId, currentPassword, and newPassword are required." });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters." });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ error: "New password must be different from current password." });
      return;
    }

    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: "User not found." }); return; }

    // Better Auth handles password hashing — we call its internal API
    // Since we can't call it directly here without the auth session, 
    // we return a 200 and instruct client to call Better Auth's changePassword
    res.json({
      message: "Use the Better Auth client changePassword API to update your password.",
      useClient: true,
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
