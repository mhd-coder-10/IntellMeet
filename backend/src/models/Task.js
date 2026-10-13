// Task Model (Kanban Cards)
// Represents actionable tasks on a project Kanban board, with assignees, priorities, and meeting ties

const mongoose = require("mongoose");

const taskCommentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    columnId: {
      type: String,
      default: "col-todo",
      index: true,
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "done"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
      index: true,
    },
    actionItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActionItem",
      default: null,
    },
    comments: [taskCommentSchema],
    updateCount: {
      type: Number,
      default: 0,
    },
    lastDueReminderSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ project: 1, columnId: 1, order: 1 });
taskSchema.index({ team: 1, assignee: 1 });

module.exports = mongoose.model("Task", taskSchema);
