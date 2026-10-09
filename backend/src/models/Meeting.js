
// Defines the Meeting schema for MongoDB
// Stores meeting details, host, participants, code, status and settings

const mongoose = require("mongoose")

const meetingSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Meeting title is required"],
            trim: true,
        },
        description: {
            type: String,
            default: "",
            trim: true,
        },
        host: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        meetingCode: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        password: {
            type: String,
            default: "",
            select: false,
        },
        scheduledAt: {
            type: Date,
            default: Date.now,
        },
        startTime: {
            type: Date,
            default: Date.now,
        },
        endTime: {
            type: Date,
            default: null,
        },
        startedAt: {
            type: Date,
            default: null,
        },
        endedAt: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: ["scheduled", "ongoing", "completed", "cancelled"],
            default: "scheduled",
        },
        isRecording: {
            type: Boolean,
            default: false,
        },
        recordingStartedAt: {
            type: Date,
            default: null,
        },
        recordingUserId: {
            type: String,
            default: null,
        },
        recordingUrl: {
            type: String,
            default: "",
        },
        recordings: [
            {
                url: {
                    type: String,
                    required: true,
                },
                title: {
                    type: String,
                    default: "",
                },
                duration: {
                    type: Number,
                    default: 0,
                },
                size: {
                    type: Number,
                    default: 0,
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        recordingDeletedByHost: {
            type: Boolean,
            default: false,
        },
        isHostDeleted: {
            type: Boolean,
            default: false,
        },
        hostDeletedAt: {
            type: Date,
            default: null,
        },
        settings: {
            allowChat: { type: Boolean, default: true },
            allowScreenShare: { type: Boolean, default: true },
            muteOnJoin: { type: Boolean, default: false },
            waitingRoom: { type: Boolean, default: false },
        },
    },
    { timestamps: true }
)

const Meeting = mongoose.model("Meeting", meetingSchema)

module.exports = Meeting