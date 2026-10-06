const multer = require("multer");

// Store file in memory as buffer before uploading to cloudinary or disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

const uploadRecording = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB limit for meeting recordings
  fileFilter: (req, file, cb) => {
    // Allow webm, mp4, octet-stream video formats
    if (
      file.mimetype.startsWith("video/") ||
      file.mimetype === "application/octet-stream" ||
      file.originalname.endsWith(".webm") ||
      file.originalname.endsWith(".mp4")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only video files (.webm, .mp4) are allowed"), false);
    }
  },
});

upload.upload = upload;
upload.uploadRecording = uploadRecording;

module.exports = upload;
module.exports.upload = upload;
module.exports.uploadRecording = uploadRecording;