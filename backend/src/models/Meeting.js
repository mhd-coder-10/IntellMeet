
// Defines the Meeting schema for MongoDB
// Stores meeting details, host, participants, code, status and settings

const mongoose = require("mongoose");
require("./User");
require("./Team");
require("./Project");

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
        workspace: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
            default: null,
            index: true,
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
            index: true,
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
            enum: ["scheduled", "ongoing", "completed", "cancelled", "expired"],
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

// Automatically delete all recordings from Cloudinary when meeting is removed from database
meetingSchema.pre(["findOneAndDelete", "deleteOne", "deleteMany"], async function () {
  try {
    const { deleteMediaFile } = require("../utils/mediaStorage");
    const docs = await this.model.find(this.getQuery());
    for (const doc of docs) {
      if (Array.isArray(doc.recordings) && doc.recordings.length > 0) {
        for (const rec of doc.recordings) {
          if (rec?.url) {
            await deleteMediaFile(rec.url);
          }
        }
      } else if (doc.recordingUrl) {
        await deleteMediaFile(doc.recordingUrl);
      }
    }
  } catch (err) {
    console.warn("[Meeting Cleanup] Error removing recordings from Cloudinary during deletion:", err.message);
  }
});

meetingSchema.pre("remove", async function () {
  try {
    const { deleteMediaFile } = require("../utils/mediaStorage");
    if (Array.isArray(this.recordings) && this.recordings.length > 0) {
      for (const rec of this.recordings) {
        if (rec?.url) {
          await deleteMediaFile(rec.url);
        }
      }
    } else if (this.recordingUrl) {
      await deleteMediaFile(this.recordingUrl);
    }
  } catch (err) {
    console.warn("[Meeting Cleanup] Error removing recordings from Cloudinary:", err.message);
  }
});

const Meeting = mongoose.model("Meeting", meetingSchema)

module.exports = Meeting