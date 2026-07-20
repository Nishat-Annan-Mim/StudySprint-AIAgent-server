import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string;
  avatarBgColor?: string;
  role: "student" | "creator" | "admin";
  bio?: string;
  learningGoals: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    avatarBgColor: { type: String },
    role: { 
      type: String, 
      enum: ["student", "creator", "admin"], 
      default: "student" 
    },
    bio: { type: String, default: "" },
    learningGoals: { type: [String], default: [] },
  },
  { 
    timestamps: true,
    collection: "users" // Map to Better Auth's users collection
  }
);

UserSchema.pre("save", async function(this: any) {
  if (!this.avatarBgColor) {
    let hash = 0;
    const str = this.email || this.name || "";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6", "#14b8a6", "#ef4444"];
    const index = Math.abs(hash) % colors.length;
    this.avatarBgColor = colors[index];
  }
});

export const User = mongoose.model<IUser>("User", UserSchema);
