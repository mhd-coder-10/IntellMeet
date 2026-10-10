// Defines the ActionItem schema for MongoDB
// Stores AI-extracted and manually added action items for meetings

const mongoose = require("mongoose");

const actionItemSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    summary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Summary",
      default: null,
    },
    task: {
      type: String,
      required: [true, "Action item task description is required"],
      trim: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assigneeName: {
      type: String,
      trim: true,
      default: "Unassigned",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    dueDateText: {
      type: String,
      trim: true,
      default: "",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isAiGenerated: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const ActionItem = mongoose.model("ActionItem", actionItemSchema);

module.exports = ActionItem;
