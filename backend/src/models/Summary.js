// Defines the Summary schema for MongoDB
// Stores AI-generated executive meeting summary, key discussion points, and decisions

const mongoose = require("mongoose");

const summarySchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    overview: {
      type: String,
      required: true,
      trim: true,
      default: "",
    },
    keyPoints: [
      {
        type: String,
        trim: true,
      },
    ],
    decisions: [
      {
        type: String,
        trim: true,
      },
    ],
    sentiment: {
      type: String,
      enum: ["productive", "positive", "neutral", "constructive", "urgent"],
      default: "productive",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "completed",
      index: true,
    },
    provider: {
      type: String,
      default: "ai-intelligence",
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    sourceTextLength: {
      type: Number,
      default: 0,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const Summary = mongoose.model("Summary", summarySchema);

module.exports = Summary;
