const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    // Ensure old unique meetingCode index does not block new workspace-based meetings
    mongoose.connection.collection("meetings").dropIndex("meetingCode_1").catch(() => {});

    console.log("MongoDB connected successfully....");

    // Pre-register all models so populated queries never fail with MissingSchemaError
    require("../models/User");
    require("../models/Team");
    require("../models/Project");
    require("../models/Meeting");
    require("../models/Task");
    require("../models/ActionItem");
    require("../models/Summary");
    require("../models/Transcript");
    require("../models/Notification");
    require("../models/ChatMessage");
  } catch (error) {
    console.error("\nMongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;

