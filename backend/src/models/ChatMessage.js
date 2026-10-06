// Defines the ChatMessage schema for MongoDB
// Stores sender, meeting, message text and message type

const mongoose = require("mongoose")

const chatMessageSchema = new mongoose.Schema(
    {
        meeting: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Meeting",
            required: true,
            index: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        message: {
            type: String,
            required: [true, "Message cannot be empty"],
            trim: true,
            maxlength: [2000, "Message cannot exceed 2000 characters"],
        },
        type: {
            type: String,
            enum: ["text", "system"],
            default: "text",
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedBy: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
)

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema)

module.exports = ChatMessage