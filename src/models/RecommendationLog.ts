// import mongoose, { Schema, Document, Types } from "mongoose";

// export interface IRecommendationLog extends Document {
//   user: Types.ObjectId;
//   course: Types.ObjectId;
//   action: "clicked" | "dismissed" | "enrolled";
//   timestamp: Date;
// }

// const RecommendationLogSchema: Schema = new Schema(
//   {
//     user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
//     course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
//     action: { 
//       type: String, 
//       enum: ["clicked", "dismissed", "enrolled"], 
//       required: true 
//     },
//     timestamp: { type: Date, default: Date.now },
//   },
//   { 
//     collection: "recommendationlogs"
//   }
// );

// export const RecommendationLog = mongoose.model<IRecommendationLog>(
//   "RecommendationLog",
//   RecommendationLogSchema
// );
