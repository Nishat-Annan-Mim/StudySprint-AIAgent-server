import mongoose, { Schema, Document, Types } from "mongoose";

export interface IEnrollment extends Document {
  student: Types.ObjectId;
  course: Types.ObjectId;
  enrolledAt: Date;
  progress: number; // percentage (0 to 100)
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema: Schema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    enrolledAt: { type: Date, default: Date.now },
    progress: { type: Number, required: true, default: 0, min: 0, max: 100 },
    completed: { type: Boolean, required: true, default: false },
  },
  { 
    timestamps: true,
    collection: "enrollments"
  }
);

// Unique compound index so a student cannot enroll in the same course multiple times
EnrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

export const Enrollment = mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema);
