const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    // Ensure old unique meetingCode index does not block new workspace-based meetings
    mongoose.connection.collection("meetings").dropIndex("meetingCode_1").catch(() => {});

    console.log("MongoDB connected successfully....");
  } catch (error) {
    console.error("\nMongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;

