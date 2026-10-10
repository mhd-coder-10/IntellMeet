// Defines the Transcript schema for MongoDB
// Stores AI transcription, speaker segments, timestamps and status

const mongoose = require("mongoose");

const transcriptSegmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    speaker: {
      type: String,
      default: "Speaker",
      trim: true,
    },
    speakerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    startTime: {
      type: Number,
      required: true,
      default: 0, // seconds
    },
    endTime: {
      type: Number,
      required: true,
      default: 0, // seconds
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    confidence: {
      type: Number,
      default: 0.95,
      min: 0,
      max: 1,
    },
  },
  { _id: false }
);

const transcriptSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    recordingIndex: {
      type: Number,
      default: 0,
    },
    recordingUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    provider: {
      type: String,
      default: "gemini",
    },
    language: {
      type: String,
      default: "en",
    },
    duration: {
      type: Number,
      default: 0, // total seconds
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    fullText: {
      type: String,
      default: "",
    },
    segments: [transcriptSegmentSchema],
    error: {
      type: String,
      default: null,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const Transcript = mongoose.model("Transcript", transcriptSchema);

module.exports = Transcript;
