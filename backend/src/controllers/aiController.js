// AI Controller
// Handles endpoints for AI transcription generation, retrieval, editing, and exports

const transcriptionService = require("../services/transcriptionService");

// Generate or regenerate transcript
const generateTranscript = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const { recordingIndex, provider, forceRegenerate } = req.body || {};

    const transcript = await transcriptionService.generateTranscript(
      meetingId,
      req.user?.id,
      { recordingIndex, provider, forceRegenerate }
    );

    // Broadcast real-time socket event if io is available
    const io = req.app.get("io");
    if (io) {
      io.to(meetingId).emit("transcript:completed", {
        meetingId,
        transcriptId: transcript._id,
        wordCount: transcript.wordCount,
        duration: transcript.duration,
        provider: transcript.provider,
      });
    }

    res.status(200).json({
      success: true,
      message: "AI Transcript generated successfully",
      data: { transcript },
    });
  } catch (error) {
    console.error("Generate transcript error:", error);
    const cleanMsg = (error.message || "Failed to generate transcript")
      .replace(/Gemini API Error \(\d+\):?/gi, "AI Service Error:")
      .replace(/gemini[^\s,]*/gi, "AI Service");
    res.status(error.statusCode || 500).json({
      success: false,
      message: cleanMsg,
    });
  }
};

// Get meeting transcript
const getTranscript = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const recordingIndex = req.query.recordingIndex || 0;

    const transcript = await transcriptionService.getTranscriptByMeetingId(
      meetingId,
      recordingIndex
    );

    res.status(200).json({
      success: true,
      data: { transcript: transcript || null },
    });
  } catch (error) {
    console.error("Get transcript error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch transcript",
    });
  }
};

// Update transcript segments / text (manual correction)
const updateTranscript = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const transcript = await transcriptionService.updateTranscript(
      meetingId,
      req.body,
      req.user?.id
    );

    res.status(200).json({
      success: true,
      message: "Transcript updated successfully",
      data: { transcript },
    });
  } catch (error) {
    console.error("Update transcript error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update transcript",
    });
  }
};

// Delete transcript
const deleteTranscript = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    await transcriptionService.deleteTranscript(meetingId);

    res.status(200).json({
      success: true,
      message: "Transcript deleted successfully",
    });
  } catch (error) {
    console.error("Delete transcript error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete transcript",
    });
  }
};

// Export transcript (.txt, .vtt, .json)
const exportTranscript = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const format = (req.query.format || "txt").toLowerCase();

    const { content, mimeType, filename } =
      await transcriptionService.exportTranscript(meetingId, format);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(content);
  } catch (error) {
    console.error("Export transcript error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to export transcript",
    });
  }
};

const summaryService = require("../services/summaryService");
const actionItemService = require("../services/actionItemService");

// Generate AI meeting summary and action items
const generateSummary = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const { forceRegenerate } = req.body || {};

    const result = await summaryService.generateSummary(meetingId, req.user?.id, {
      forceRegenerate,
    });

    // Broadcast socket event if io is available
    const io = req.app.get("io");
    if (io) {
      io.to(meetingId).emit("summary:completed", {
        meetingId,
        summaryId: result.summary._id,
        actionItemsCount: result.actionItems.length,
      });
    }

    res.status(200).json({
      success: true,
      message: "AI Summary and Action Items generated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Generate summary error:", error);
    const cleanMsg = (error.message || "Failed to generate summary")
      .replace(/Gemini API Error \(\d+\):?/gi, "AI Service Error:")
      .replace(/gemini[^\s,]*/gi, "AI Service");
    res.status(error.statusCode || 500).json({
      success: false,
      message: cleanMsg,
    });
  }
};

// Get meeting summary and action items
const getSummary = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const result = await summaryService.getSummaryByMeetingId(meetingId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get summary error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch summary",
    });
  }
};

// Delete meeting summary
const deleteSummary = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    await summaryService.deleteSummary(meetingId);

    res.status(200).json({
      success: true,
      message: "Summary and action items deleted successfully",
    });
  } catch (error) {
    console.error("Delete summary error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete summary",
    });
  }
};

// Export meeting summary
const exportSummary = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const format = (req.query.format || "txt").toLowerCase();

    const { content, mimeType, filename } = await summaryService.exportSummary(
      meetingId,
      format
    );

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(content);
  } catch (error) {
    console.error("Export summary error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to export summary",
    });
  }
};

// Toggle action item completed status
const toggleActionItem = async (req, res) => {
  try {
    const { id: actionItemId } = req.params;
    const item = await actionItemService.toggleActionItem(actionItemId, req.user?.id);

    res.status(200).json({
      success: true,
      message: `Action item marked as ${item.status}`,
      data: { actionItem: item },
    });
  } catch (error) {
    console.error("Toggle action item error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to toggle action item",
    });
  }
};

// Add manual action item
const createActionItem = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const io = req.app.get("io");
    const item = await actionItemService.createActionItem(
      meetingId,
      req.body,
      req.user?.id,
      io
    );

    res.status(201).json({
      success: true,
      message: "Action item created successfully",
      data: { actionItem: item },
    });
  } catch (error) {
    console.error("Create action item error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create action item",
    });
  }
};

// Update action item
const updateActionItem = async (req, res) => {
  try {
    const { id: actionItemId } = req.params;
    const io = req.app.get("io");
    const item = await actionItemService.updateActionItem(
      actionItemId,
      req.body,
      req.user?.id,
      io
    );

    res.status(200).json({
      success: true,
      message: "Action item updated successfully",
      data: { actionItem: item },
    });
  } catch (error) {
    console.error("Update action item error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update action item",
    });
  }
};

// Delete action item
const deleteActionItem = async (req, res) => {
  try {
    const { id: actionItemId } = req.params;
    await actionItemService.deleteActionItem(actionItemId);

    res.status(200).json({
      success: true,
      message: "Action item deleted successfully",
    });
  } catch (error) {
    console.error("Delete action item error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete action item",
    });
  }
};

module.exports = {
  generateTranscript,
  getTranscript,
  updateTranscript,
  deleteTranscript,
  exportTranscript,
  generateSummary,
  getSummary,
  deleteSummary,
  exportSummary,
  toggleActionItem,
  createActionItem,
  updateActionItem,
  deleteActionItem,
};
