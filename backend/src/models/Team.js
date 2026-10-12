// Team Workspace Model
// Represents team workspaces, memberships, invite codes, and permissions

const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["active", "pending", "rejected"],
      default: "active",
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    color: {
      type: String,
      default: "indigo", // indigo, blue, emerald, purple, amber, rose
    },
    avatar: {
      type: String,
      default: "",
    },
    members: [teamMemberSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes
teamSchema.index({ "members.user": 1 });
// teamSchema.index({ code: 1 });

module.exports = mongoose.model("Team", teamSchema);
