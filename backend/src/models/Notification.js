// Defines the Notification schema for MongoDB
// Stores user notifications with type, reference and read status

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        type: {
            type: String,
            enum: [
                "meeting_invite",
                "meeting_invited",
                "meeting_started",
                "meeting_live",
                "meeting_ended",
                "meeting_updated",
                "meeting_cancelled",
                "chat_mention",
                "action_item",
                "system",
                "task_assigned",
                "task_status",
                "task_created",
                "task_updated",
                "task_deleted",
                "task_comment",
                "task_due",
                "team_updated",
                "project_updated",
            ],
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        link: {
            type: String,
            default: "",
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        readAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
)

// Automatically remove notifications older than 10 days (10 days * 24h * 60m * 60s = 864,000s)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 10 * 24 * 60 * 60 });

const Notification = mongoose.model("Notification", notificationSchema)

module.exports = Notification