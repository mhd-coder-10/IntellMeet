const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
    },

    profilePicture: {
      type: String,
      default: "",
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      default: null,
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
    },

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    attendedMeetings: [
      {
        meeting: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Meeting",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        leftAt: {
          type: Date,
          default: Date.now,
        },
        totalDurationSeconds: {
          type: Number,
          default: 0,
        },
        sessions: [
          {
            joinedAt: {
              type: Date,
              default: Date.now,
            },
            leftAt: {
              type: Date,
              default: null,
            },
            durationSeconds: {
              type: Number,
              default: 0,
            },
          },
        ],
      },
    ],
    
    hiddenMeetings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meeting",
      },
    ],
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },


  }, { timestamps: true });


// Hash password before saving user
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});


// Compare plain password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Automatically delete avatar from Cloudinary when user is removed from database
userSchema.pre(["findOneAndDelete", "deleteOne", "deleteMany"], async function () {
  try {
    const { deleteMediaFile } = require("../utils/mediaStorage");
    const docs = await this.model.find(this.getQuery());
    for (const doc of docs) {
      if (doc?.profilePicture) {
        await deleteMediaFile(doc.profilePicture);
      }
    }
  } catch (err) {
    console.warn("[User Cleanup] Error removing avatar from Cloudinary during user deletion:", err.message);
  }
});

userSchema.pre("remove", async function () {
  try {
    if (this.profilePicture) {
      const { deleteMediaFile } = require("../utils/mediaStorage");
      await deleteMediaFile(this.profilePicture);
    }
  } catch (err) {
    console.warn("[User Cleanup] Error removing avatar from Cloudinary:", err.message);
  }
});

const User = mongoose.model("User", userSchema);

module.exports = User;