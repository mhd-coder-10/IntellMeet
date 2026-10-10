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

module.exports = {
  generateTranscript,
  getTranscript,
  updateTranscript,
  deleteTranscript,
  exportTranscript,
};
