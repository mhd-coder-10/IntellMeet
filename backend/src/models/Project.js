// Project Board Model
// Represents project boards within a team workspace, configuring columns and metadata

const mongoose = require("mongoose");

const columnSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    color: {
      type: String,
      default: "slate",
    },
  },
  { _id: false }
);

const defaultColumns = [
  { id: "col-todo", title: "To Do", order: 0, color: "slate" },
  { id: "col-in-progress", title: "In Progress", order: 1, color: "blue" },
  { id: "col-review", title: "In Review", order: 2, color: "amber" },
  { id: "col-done", title: "Done", order: 3, color: "emerald" },
];

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 600,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
      index: true,
    },
    color: {
      type: String,
      default: "blue",
    },
    columns: {
      type: [columnSchema],
      default: defaultColumns,
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ team: 1, status: 1 });

module.exports = mongoose.model("Project", projectSchema);
