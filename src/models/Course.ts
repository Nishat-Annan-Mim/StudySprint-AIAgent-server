import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISyllabusSection {
  title: string;
  content: string;
}

export interface ICourse extends Document {
  title: string;
  shortDescription: string;
  fullDescription: string;
  creator: Types.ObjectId;
  category: string;
  price: number;
  startDate?: Date;
  format: "online" | "in-person";
  location: string;
  coverImageUrl?: string;
  galleryImages: string[];
  averageRating: number;
  reviewCount: number;
  tags: string[];
  syllabus: ISyllabusSection[];
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
}

const SyllabusSectionSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const CourseSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    shortDescription: { type: String, required: true },
    fullDescription: { type: String, required: true },
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true, default: 0 },
    startDate: { type: Date },
    format: { type: String, enum: ["online", "in-person"], default: "online" },
    location: { type: String, default: "Online" },
    coverImageUrl: { type: String, default: "" },
    galleryImages: { type: [String], default: [] },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    syllabus: { type: [SyllabusSectionSchema], default: [] },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  },
  { 
    timestamps: true,
    collection: "courses"
  }
);

export const Course = mongoose.model<ICourse>("Course", CourseSchema);
