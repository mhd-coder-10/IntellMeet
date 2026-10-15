const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // Automatically delete after 10 minutes (TTL index)
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.index({ email: 1 });

module.exports = mongoose.model("Otp", otpSchema);
