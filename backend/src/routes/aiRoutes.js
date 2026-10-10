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

// Meeting Summary & Action Item Endpoints (Day 16)
router.post("/meetings/:id/summary/generate", protect, aiController.generateSummary);
router.get("/meetings/:id/summary", protect, aiController.getSummary);
router.delete("/meetings/:id/summary", protect, aiController.deleteSummary);
router.get("/meetings/:id/summary/export", protect, aiController.exportSummary);

// Action Item Specific Endpoints
router.patch("/action-items/:id/toggle", protect, aiController.toggleActionItem);
router.post("/meetings/:id/action-items", protect, aiController.createActionItem);
router.put("/action-items/:id", protect, aiController.updateActionItem);
router.delete("/action-items/:id", protect, aiController.deleteActionItem);

module.exports = router;
