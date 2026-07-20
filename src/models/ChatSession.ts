import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface IChatSession extends Document {
  user: Types.ObjectId;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema({
  role: { type: String, enum: ["user", "assistant", "system"], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ChatSessionSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messages: { type: [MessageSchema], default: [] },
  },
  { 
    timestamps: true,
    collection: "chatsessions"
  }
);

export const ChatSession = mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);
