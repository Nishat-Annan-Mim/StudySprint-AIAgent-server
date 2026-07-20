import mongoose, { Schema, Document, Types } from "mongoose";

export interface IReview extends Document {
  course: Types.ObjectId;
  student: Types.ObjectId;
  rating: number; // 1 to 5
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema: Schema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
  },
  { 
    timestamps: true,
    collection: "reviews"
  }
);

// Ensure one review per student per course
ReviewSchema.index({ course: 1, student: 1 }, { unique: true });

export const Review = mongoose.model<IReview>("Review", ReviewSchema);
