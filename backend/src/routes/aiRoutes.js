// AI Routes
// Defines endpoints for meeting transcript generation, retrieval, editing, and exports

const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { protect } = require("../middleware/auth.middleware");

// Meeting Transcript Endpoints
router.post("/meetings/:id/transcript/generate", protect, aiController.generateTranscript);
router.get("/meetings/:id/transcript", protect, aiController.getTranscript);
router.put("/meetings/:id/transcript", protect, aiController.updateTranscript);
router.delete("/meetings/:id/transcript", protect, aiController.deleteTranscript);
router.get("/meetings/:id/transcript/export", protect, aiController.exportTranscript);

module.exports = router;
