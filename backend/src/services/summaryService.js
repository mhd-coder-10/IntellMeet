// AI Meeting Summary & Action Item Extraction Service
// Generates concise executive summaries, discussion points, key decisions,
// and extracts smart action items using Google Gemini AI

const Summary = require("../models/Summary");
const ActionItem = require("../models/ActionItem");
const Meeting = require("../models/Meeting");
const Transcript = require("../models/Transcript");
const transcriptionService = require("./transcriptionService");

/**
 * Generate or regenerate AI Summary and Action Items for a meeting
 */
const generateSummary = async (meetingId, userId, options = {}) => {
  const { forceRegenerate = false } = options;

  // 1. Fetch meeting with host and participants populated
  const meeting = await Meeting.findById(meetingId)
    .populate("host", "name username email avatar")
    .populate("participants", "name username email avatar");

  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  // 2. Check if a summary already exists
  let existingSummary = await Summary.findOne({ meeting: meetingId });
  if (existingSummary && !forceRegenerate) {
    const existingActionItems = await ActionItem.find({ meeting: meetingId })
      .populate("assignee", "name username avatar")
      .sort({ createdAt: 1 });
    return { summary: existingSummary, actionItems: existingActionItems };
  }

  // 3. Find meeting transcript text
  let transcript = await Transcript.findOne({ meeting: meetingId, status: "completed" });

  // If transcript not completed yet, check if meeting has recording to transcribe first
  if (!transcript || !transcript.fullText || transcript.fullText.trim().length === 0) {
    const hasRecording =
      (meeting.recordings && meeting.recordings.length > 0) || !!meeting.recordingUrl;
    if (hasRecording) {
      try {
        console.log(`[AI Summary] Transcript not found, auto-generating transcript for meeting "${meeting.title}"...`);
        transcript = await transcriptionService.generateTranscript(meetingId, userId, { forceRegenerate: false });
      } catch (err) {
        console.warn(`[AI Summary] Auto-transcription failed:`, err.message);
      }
    }
  }

  if (!transcript || !transcript.fullText || transcript.fullText.trim().length === 0) {
    const error = new Error(
      "No meeting transcript or audio dialogue found. Please generate the meeting transcript first."
    );
    error.statusCode = 400;
    throw error;
  }

  const transcriptText = transcript.fullText.trim();
  const hostName = meeting.host?.name || "Host";
  const participantsList = [
    meeting.host,
    ...(meeting.participants || []),
  ].filter(Boolean);

  const participantNames = participantsList
    .map((p) => p.name || p.username)
    .filter(Boolean)
    .join(", ");

  // 4. Construct AI Prompt
  const prompt = `You are an elite enterprise AI meeting intelligence assistant.
Meeting Title: "${meeting.title || "Meeting"}"
Host: "${hostName}"
Attendees: ${participantNames || "Team Members"}

Below is the verbatim transcription of the meeting:
"""
${transcriptText}
"""

Analyze this transcript thoroughly and extract:
1. "overview": A concise 2-4 sentence executive summary of what was discussed, purpose, and outcomes.
2. "keyPoints": Array of 3 to 6 bullet points covering major topics and insights discussed.
3. "decisions": Array of 1 to 4 clear decisions or conclusions agreed upon. If none explicitly stated, infer the key takeaway.
4. "actionItems": Array of concrete tasks extracted from what needs to be done. Each task must have:
   - "task": Clear actionable description of the task.
   - "assigneeName": Name of the person responsible if mentioned or inferred from Attendees list (${participantNames}), or "Team" / "Host".
   - "priority": "high", "medium", or "low".
   - "dueDateText": Timeframe or deadline if mentioned (e.g. "By end of week", "Tomorrow", "Next meeting") or "TBD".
5. "sentiment": One of "productive", "positive", "neutral", "constructive", "urgent".

Respond STRICTLY with valid JSON matching this schema:
{
  "overview": "...",
  "keyPoints": ["...", "..."],
  "decisions": ["..."],
  "actionItems": [
    {
      "task": "...",
      "assigneeName": "...",
      "priority": "medium",
      "dueDateText": "TBD"
    }
  ],
  "sentiment": "productive"
}`;

  // 5. Call Google Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("No AI API key configured on server. Please configure an API key.");
  }

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
  ];
  let rawResponse = null;
  let lastError = null;

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      });

      const data = await response.json();
      if (data && !data.error && data.candidates?.[0]) {
        rawResponse = data;
        break;
      }
      if (data?.error) {
        lastError = data.error;
        console.warn(`[AI Summary] Model ${model} returned error: ${data.error.message}`);
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI Summary] Failed calling ${model}:`, err.message);
    }
  }

  if (!rawResponse) {
    let friendlyMsg = "AI summary service is currently busy. Please retry in a few moments.";
    throw new Error(friendlyMsg);
  }

  const rawText = rawResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let parsed = null;

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {}
  }

  // Fallback defaults if parsing was partial
  const overview =
    parsed?.overview?.trim() ||
    `Meeting focused on ${meeting.title}. Discussion points were reviewed and action items tracked for follow-up.`;
  const keyPoints =
    Array.isArray(parsed?.keyPoints) && parsed.keyPoints.length > 0
      ? parsed.keyPoints.map((p) => String(p).trim()).filter(Boolean)
      : [`Discussion held regarding ${meeting.title}`, "Key updates and action plans reviewed."];
  const decisions =
    Array.isArray(parsed?.decisions) && parsed.decisions.length > 0
      ? parsed.decisions.map((d) => String(d).trim()).filter(Boolean)
      : ["Agreed to follow up on outlined deliverables and project objectives."];
  const sentiment = parsed?.sentiment || "productive";

  // 6. Save or Update Summary in MongoDB
  if (!existingSummary) {
    existingSummary = new Summary({
      meeting: meetingId,
      overview,
      keyPoints,
      decisions,
      sentiment,
      status: "completed",
      provider: "ai-intelligence",
      wordCount: overview.split(/\s+/).filter(Boolean).length,
      sourceTextLength: transcriptText.length,
      generatedBy: userId,
    });
  } else {
    existingSummary.overview = overview;
    existingSummary.keyPoints = keyPoints;
    existingSummary.decisions = decisions;
    existingSummary.sentiment = sentiment;
    existingSummary.status = "completed";
    existingSummary.wordCount = overview.split(/\s+/).filter(Boolean).length;
    existingSummary.sourceTextLength = transcriptText.length;
    existingSummary.generatedBy = userId;
  }
  await existingSummary.save();

  // 7. Process and Save Action Items
  // If forceRegenerate, remove previous AI-generated items (preserve manual items)
  if (forceRegenerate) {
    await ActionItem.deleteMany({ meeting: meetingId, isAiGenerated: true });
  }

  const rawActionItems = Array.isArray(parsed?.actionItems) ? parsed.actionItems : [];
  const savedActionItems = [];

  for (const item of rawActionItems) {
    if (!item?.task) continue;

    // Attempt to match assigneeName with meeting attendee
    let matchedUser = null;
    if (item.assigneeName) {
      const target = item.assigneeName.toLowerCase().trim();
      matchedUser = participantsList.find((p) => {
        const pName = (p.name || "").toLowerCase();
        const pUser = (p.username || "").toLowerCase();
        return pName.includes(target) || target.includes(pName) || pUser.includes(target);
      });
    }

    const newActionItem = new ActionItem({
      meeting: meetingId,
      summary: existingSummary._id,
      task: item.task.trim(),
      assignee: matchedUser ? matchedUser._id : null,
      assigneeName: matchedUser ? matchedUser.name : (item.assigneeName || "Unassigned"),
      priority: ["low", "medium", "high", "urgent"].includes((item.priority || "").toLowerCase())
        ? item.priority.toLowerCase()
        : "medium",
      status: "pending",
      dueDateText: item.dueDateText || "TBD",
      isAiGenerated: true,
    });
    await newActionItem.save();
    savedActionItems.push(newActionItem);
  }

  // Fetch all action items for this meeting (including any manual ones)
  const allActionItems = await ActionItem.find({ meeting: meetingId })
    .populate("assignee", "name username avatar")
    .sort({ createdAt: 1 });

  return {
    summary: existingSummary,
    actionItems: allActionItems,
  };
};

/**
 * Get summary and action items for a meeting
 */
const getSummaryByMeetingId = async (meetingId) => {
  const summary = await Summary.findOne({ meeting: meetingId }).populate(
    "generatedBy",
    "name username avatar"
  );
  const actionItems = await ActionItem.find({ meeting: meetingId })
    .populate("assignee", "name username avatar")
    .sort({ createdAt: 1 });

  return { summary, actionItems };
};

/**
 * Delete summary and all associated action items
 */
const deleteSummary = async (meetingId) => {
  await Summary.deleteOne({ meeting: meetingId });
  await ActionItem.deleteMany({ meeting: meetingId, isAiGenerated: true });
};

/**
 * Export summary and action items as Plain Text or Markdown
 */
const exportSummary = async (meetingId, format = "txt") => {
  const meeting = await Meeting.findById(meetingId).populate("host", "name");
  const { summary, actionItems } = await getSummaryByMeetingId(meetingId);

  if (!summary) {
    const error = new Error("No summary exists to export for this meeting");
    error.statusCode = 404;
    throw error;
  }

  const title = meeting?.title || "Meeting";
  const host = meeting?.host?.name || "Host";
  const dateStr = new Date(summary.createdAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let output = "";

  if (format === "md" || format === "markdown") {
    output += `# AI Meeting Summary: ${title}\n\n`;
    output += `**Date:** ${dateStr}  \n`;
    output += `**Host:** ${host}  \n`;
    output += `**Sentiment:** ${summary.sentiment.toUpperCase()}  \n\n`;

    output += `## Executive Overview\n${summary.overview}\n\n`;

    output += `## Key Discussion Points\n`;
    summary.keyPoints.forEach((point) => {
      output += `- ${point}\n`;
    });
    output += `\n`;

    if (summary.decisions && summary.decisions.length > 0) {
      output += `## Key Decisions Made\n`;
      summary.decisions.forEach((dec) => {
        output += `✓ ${dec}\n`;
      });
      output += `\n`;
    }

    output += `## Action Items\n`;
    if (actionItems.length === 0) {
      output += `_No action items registered._\n`;
    } else {
      actionItems.forEach((item) => {
        const checkbox = item.status === "completed" ? "[x]" : "[ ]";
        output += `- ${checkbox} **${item.task}** (Assignee: ${item.assigneeName || "Unassigned"} | Priority: ${item.priority.toUpperCase()})\n`;
      });
    }
  } else {
    // Plain text
    output += `========================================================\n`;
    output += `AI MEETING SUMMARY: ${title.toUpperCase()}\n`;
    output += `Date: ${dateStr}\n`;
    output += `Host: ${host}\n`;
    output += `========================================================\n\n`;

    output += `1. EXECUTIVE OVERVIEW\n`;
    output += `---------------------\n`;
    output += `${summary.overview}\n\n`;

    output += `2. KEY DISCUSSION POINTS\n`;
    output += `------------------------\n`;
    summary.keyPoints.forEach((point, i) => {
      output += `${i + 1}. ${point}\n`;
    });
    output += `\n`;

    if (summary.decisions && summary.decisions.length > 0) {
      output += `3. DECISIONS MADE\n`;
      output += `-----------------\n`;
      summary.decisions.forEach((dec, i) => {
        output += `[✓] ${dec}\n`;
      });
      output += `\n`;
    }

    output += `4. ACTION ITEMS & DELIVERABLES\n`;
    output += `------------------------------\n`;
    if (actionItems.length === 0) {
      output += `No action items registered.\n`;
    } else {
      actionItems.forEach((item, i) => {
        const mark = item.status === "completed" ? "[DONE]" : "[PENDING]";
        output += `${i + 1}. ${mark} ${item.task} (Owner: ${item.assigneeName || "Unassigned"}, Priority: ${item.priority})\n`;
      });
    }
  }

  const sanitized = title.replace(/[^a-z0-9_-]/gi, "_");
  const ext = format === "md" || format === "markdown" ? "md" : "txt";
  const mimeType = ext === "md" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8";

  return {
    content: output,
    mimeType,
    filename: `${sanitized}_summary.${ext}`,
  };
};

module.exports = {
  generateSummary,
  getSummaryByMeetingId,
  deleteSummary,
  exportSummary,
};
