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
    title: {
      type: String,
      trim: true,
      default: "",
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
    isConverted: {
      type: Boolean,
      default: false,
      index: true,
    },
    convertedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    convertedProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    convertedTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    isWorkspaceTaskDeleted: {
      type: Boolean,
      default: false,
    },
    updateCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const ActionItem = mongoose.model("ActionItem", actionItemSchema);

module.exports = ActionItem;
