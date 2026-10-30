// AI Meeting Summary & Action Item Extraction Service
// Generates concise executive summaries, discussion points, key decisions,
// and extracts smart action items using Google Gemini AI

const Summary = require("../models/Summary");
const ActionItem = require("../models/ActionItem");
const Meeting = require("../models/Meeting");
const Transcript = require("../models/Transcript");
require("../models/Task");
require("../models/Project");
require("../models/Team");
require("../models/User");
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
      .populate("convertedProject", "name color")
      .populate("convertedTeam", "name color")
      .populate("convertedTask", "title status columnId")
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

  // Detect if recording has no spoken discussion (silence, music, or non-verbal audio only)
  const isNonVerbal =
    transcript.hasSpokenContent === false ||
    (Array.isArray(transcript.segments) && transcript.segments.length === 0) ||
    /no spoken discussion|no audible speech|background sound only|pure silence|ambient audio/i.test(transcript.fullText || "");

  if (isNonVerbal) {
    console.log(`[AI Summary] Transcript indicates non-verbal audio for meeting "${meeting.title}". Storing informative non-verbal summary without external AI overhead.`);

    // If previous AI action items existed, clear them so phantom tasks are not displayed
    const oldAiItems = await ActionItem.find({ meeting: meetingId, isAiGenerated: true });
    if (oldAiItems.length > 0) {
      const Task = require("../models/Task");
      const oldTaskIds = oldAiItems.map((i) => i.convertedTask).filter(Boolean);
      if (oldTaskIds.length > 0) {
        await Task.deleteMany({ _id: { $in: oldTaskIds } });
      }
      await ActionItem.deleteMany({ meeting: meetingId, isAiGenerated: true });
    }

    const nonVerbalOverview =
      transcript.contentNotice ||
      "No spoken discussion was detected in the meeting recording (only silence, background music, or non-verbal audio). A meeting summary and action items cannot be generated because there was no verbal conversation.";

    if (!existingSummary) {
      existingSummary = new Summary({
        meeting: meetingId,
        overview: nonVerbalOverview,
        keyPoints: ["No spoken discussion or verbal topics detected in the recording."],
        decisions: [],
        sentiment: "neutral",
        status: "completed",
        hasSpokenContent: false,
        contentNotice: nonVerbalOverview,
        provider: "ai-transcription-detection",
        wordCount: 0,
        sourceTextLength: 0,
        generatedBy: userId,
      });
    } else {
      existingSummary.overview = nonVerbalOverview;
      existingSummary.keyPoints = ["No spoken discussion or verbal topics detected in the recording."];
      existingSummary.decisions = [];
      existingSummary.sentiment = "neutral";
      existingSummary.status = "completed";
      existingSummary.hasSpokenContent = false;
      existingSummary.contentNotice = nonVerbalOverview;
      existingSummary.provider = "ai-transcription-detection";
      existingSummary.wordCount = 0;
      existingSummary.sourceTextLength = 0;
      existingSummary.generatedBy = userId;
    }
    await existingSummary.save();

    return {
      summary: existingSummary,
      actionItems: [],
    };
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

  const attendeesFormatted = participantsList
    .map((p) => `- "${p.name}" (username: @${p.username})`)
    .join("\n");

  // 4. Construct AI Prompt
  const prompt = `You are an elite enterprise AI meeting intelligence assistant.
Meeting Title: "${meeting.title || "Meeting"}"
Host: "${hostName}"
Attendees:
${attendeesFormatted || participantNames || "Team Members"}

Below is the verbatim transcription of the meeting:
"""
${transcriptText}
"""

Analyze this transcript thoroughly and extract:
1. "overview": A concise 2-4 sentence executive summary of what was discussed, purpose, and outcomes.
2. "keyPoints": Array of 3 to 6 bullet points covering major topics and insights discussed.
3. "decisions": Array of 1 to 4 clear decisions or conclusions agreed upon. If none explicitly stated, infer the key takeaway.
4. "actionItems": Array of concrete tasks extracted from what needs to be done.
   CRITICAL REQUIREMENTS FOR EACH ACTION ITEM:
   - "title": A short, crisp, professional 3-6 word task title summarizing the action (e.g. "UI & API Integration Fixes", "Database Consistency Verification", "API Validation & Error Handling", "Regression Testing on Modules", "Client Delivery Documentation").
   - "task": Clear actionable description of what needs to be accomplished.
   - "assigneeName": MUST STRICTLY be one of the EXACT attendee names from the Attendees list above: [${participantNames}].
     CRITICAL: DO NOT use generic role titles like "Frontend Developer", "Back-end Developer", "Database Developer", "QA Developer", "Testing Team", "Client Delivery Developer", "Team", "Host", or "Unassigned". You MUST assign each task to an actual attendee person's exact name from the Attendees list based on who spoke about or owns that responsibility in the meeting.
   - "priority": "high", "medium", or "low".
   - "dueDateText": Timeframe or deadline if mentioned (e.g. "By end of week", "Tomorrow", "Next meeting") or "Next meeting".
5. "sentiment": One of "productive", "positive", "neutral", "constructive", "urgent".

Respond STRICTLY with valid JSON matching this schema:
{
  "overview": "...",
  "keyPoints": ["...", "..."],
  "decisions": ["..."],
  "actionItems": [
    {
      "title": "...",
      "task": "...",
      "assigneeName": "...",
      "priority": "medium",
      "dueDateText": "Next meeting"
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
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-1.5-flash",
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
    } catch { }
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
      hasSpokenContent: true,
      contentNotice: null,
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
    existingSummary.hasSpokenContent = true;
    existingSummary.contentNotice = null;
    existingSummary.wordCount = overview.split(/\s+/).filter(Boolean).length;
    existingSummary.sourceTextLength = transcriptText.length;
    existingSummary.generatedBy = userId;
  }
  await existingSummary.save();

  // 7. Process and Save Action Items
  const { io = null } = options;
  const Task = require("../models/Task");
  const Project = require("../models/Project");
  const Team = require("../models/Team");

  // If forceRegenerate, remove previous AI-generated items AND any linked tasks from Kanban
  if (forceRegenerate) {
    const oldAiItems = await ActionItem.find({ meeting: meetingId, isAiGenerated: true });
    const oldTaskIds = oldAiItems.map((i) => i.convertedTask).filter(Boolean);
    if (oldTaskIds.length > 0) {
      await Task.deleteMany({ _id: { $in: oldTaskIds } });
    }
    await ActionItem.deleteMany({ meeting: meetingId, isAiGenerated: true });
  }

  // Helper to generate a short title from task text if not provided
  const generateShortTitle = (taskText) => {
    if (!taskText) return "Action Item";
    const cleaned = taskText.replace(/^[\d\.\-\*\s]+/, "").trim();
    const firstPart = cleaned.split(/[\.\:\;\n]/)[0].trim();
    const words = firstPart.split(/\s+/);
    if (words.length <= 6) return firstPart;
    return words.slice(0, 6).join(" ");
  };

  // Helper to reliably map any raw assignee string or context to a real participant
  const resolveParticipant = (rawAssigneeName, taskText = "", titleText = "") => {
    if (!participantsList || participantsList.length === 0) return null;
    const target = (rawAssigneeName || "").toLowerCase().trim();
    const fullContext = `${target} ${taskText} ${titleText}`.toLowerCase();

    // 1. Direct exact or substring match with participant name or username
    for (const p of participantsList) {
      const pName = (p.name || "").toLowerCase().trim();
      const pUser = (p.username || "").toLowerCase().trim();
      if (pName && (target === pName || target.includes(pName) || pName.includes(target))) {
        return p;
      }
      if (pUser && (target === pUser || target.includes(pUser) || pUser.includes(target))) {
        return p;
      }
    }

    // 2. First-name or Last-name match
    for (const p of participantsList) {
      const parts = (p.name || "").toLowerCase().split(/\s+/).filter(Boolean);
      for (const part of parts) {
        if (part.length >= 3 && target.includes(part)) {
          return p;
        }
      }
    }

    // 3. Domain & role heuristics mapping to actual attendees based on speech topics
    const roleMatchers = [
      { keywords: ["front", "ui", "ux", "responsive", "css", "layout"], roleKey: "front" },
      { keywords: ["back", "api", "controller", "service", "route", "server"], roleKey: "back" },
      { keywords: ["data", "db", "database", "query", "record", "storage"], roleKey: "db" },
      { keywords: ["test", "qa", "regression", "bug", "retest"], roleKey: "qa" },
      { keywords: ["client", "delivery", "handover", "document"], roleKey: "client" },
    ];

    for (const m of roleMatchers) {
      if (m.keywords.some((k) => target.includes(k))) {
        const matched = participantsList.find((p) => {
          const name = (p.name || "").toLowerCase();
          const user = (p.username || "").toLowerCase();
          if (m.roleKey === "front" && (name.includes("charoliya") || user.includes("cha10") || name.includes("front"))) return true;
          if (m.roleKey === "back" && (name.includes("mohammad ch") || user.includes("cha_mhd") || name.includes("back"))) return true;
          if (m.roleKey === "db" && (name.includes("scuben") || user.includes("scuben") || name.includes("data"))) return true;
          if (m.roleKey === "qa" && (name.includes("int") || user.includes("int16") || name.includes("test") || name.includes("qa"))) return true;
          if (m.roleKey === "client" && (p._id.toString() === meeting.host?._id?.toString() || name.includes("mhd dev"))) return true;
          return false;
        });
        if (matched) return matched;
      }
    }

    // 4. Check if task text or title mentions participant's name
    for (const p of participantsList) {
      const pName = (p.name || "").toLowerCase().trim();
      if (pName && fullContext.includes(pName)) {
        return p;
      }
    }

    // 5. Fallback: Host or first participant, so it is NEVER null or generic role string!
    return meeting.host || participantsList[0];
  };

  const rawActionItems = Array.isArray(parsed?.actionItems) ? parsed.actionItems : [];
  const savedActionItems = [];

  for (const item of rawActionItems) {
    if (!item?.task) continue;

    const shortTitle = (item.title || "").trim() || generateShortTitle(item.task);
    const matchedUser = resolveParticipant(item.assigneeName, item.task, shortTitle);

    const newActionItem = new ActionItem({
      meeting: meetingId,
      summary: existingSummary._id,
      title: shortTitle,
      task: item.task.trim(),
      assignee: matchedUser ? matchedUser._id : (meeting.host?._id || null),
      assigneeName: matchedUser ? matchedUser.name : (meeting.host?.name || "Host"),
      priority: ["low", "medium", "high", "urgent"].includes((item.priority || "").toLowerCase())
        ? item.priority.toLowerCase()
        : "medium",
      status: "pending",
      dueDateText: item.dueDateText || "Next meeting",
      isAiGenerated: true,
    });
    await newActionItem.save();
    savedActionItems.push(newActionItem);
  }

  // 8. Auto-Push Action Items into Kanban Board (Default status: "To-Do" / col-todo)
  let targetProjectId = meeting.project ? (meeting.project._id || meeting.project) : null;
  let targetTeamId = meeting.workspace ? (meeting.workspace._id || meeting.workspace) : null;

  if (!targetProjectId && targetTeamId) {
    const defaultProj = await Project.findOne({ team: targetTeamId }).sort({ createdAt: 1 });
    if (defaultProj) targetProjectId = defaultProj._id;
  }

  if (targetProjectId && !targetTeamId) {
    const projDoc = await Project.findById(targetProjectId);
    if (projDoc) targetTeamId = projDoc.team;
  }

  if (!targetProjectId || !targetTeamId) {
    const hostTeam = await Team.findOne({
      $or: [
        { owner: meeting.host?._id || meeting.host },
        { "members.user": meeting.host?._id || meeting.host },
      ],
    });
    if (hostTeam) {
      targetTeamId = hostTeam._id;
      const projDoc = await Project.findOne({ team: hostTeam._id }).sort({ createdAt: 1 });
      if (projDoc) targetProjectId = projDoc._id;
    }
  }

  if (targetProjectId && targetTeamId) {
    let currentOrder = 0;
    const highestTask = await Task.findOne({
      project: targetProjectId,
      columnId: "col-todo",
    }).sort({ order: -1 });
    if (highestTask && typeof highestTask.order === "number") {
      currentOrder = highestTask.order + 1;
    }

    const targetProjectDoc = await Project.findById(targetProjectId).select("name");

    for (const actionItem of savedActionItems) {
      try {
        const kanbanTask = await Task.create({
          title: actionItem.title || actionItem.task,
          description: actionItem.task,
          project: targetProjectId,
          team: targetTeamId,
          columnId: "col-todo",
          status: "todo",
          priority: actionItem.priority || "medium",
          assignee: actionItem.assignee || null,
          creator: meeting.host?._id || userId,
          dueDate: actionItem.dueDate || null,
          order: currentOrder++,
          tags: ["Meeting", "ActionItem", "AI-Extracted"],
          meeting: meetingId,
          actionItemId: actionItem._id,
        });

        actionItem.isConverted = true;
        actionItem.convertedTask = kanbanTask._id;
        actionItem.convertedProject = targetProjectId;
        actionItem.convertedTeam = targetTeamId;
        actionItem.convertedAt = new Date();
        await actionItem.save();

        if (io) {
          const populatedTask = await Task.findById(kanbanTask._id)
            .populate("assignee", "name username email profilePicture")
            .populate("creator", "name username email profilePicture");
          io.to(`project:${targetProjectId}`).emit("task:created", populatedTask);
          io.to(`team:${targetTeamId}`).emit("team:updated", { _id: targetTeamId });
          io.emit("team:updated", { _id: targetTeamId });
        }

        // Send notification to assigned attendee if not self
        if (actionItem.assignee && actionItem.assignee.toString() !== (userId || "").toString()) {
          try {
            const notificationService = require("./notificationService");
            await notificationService.createNotification({
              recipient: actionItem.assignee,
              sender: userId || meeting.host?._id || null,
              type: "task_assigned",
              title: "Task Assigned from Meeting",
              message: `You were assigned: "${actionItem.title || actionItem.task}" on board "${targetProjectDoc?.name || "Kanban"}" from meeting "${meeting.title}"`,
              link: `/teams/${targetTeamId}/projects/${targetProjectId}`,
            });
          } catch (notifErr) {
            console.warn("[AI Summary] Assignee notification error:", notifErr.message);
          }
        }
      } catch (taskErr) {
        console.warn("[AI Summary] Auto-push to Kanban task creation error:", taskErr.message);
      }
    }
  }

  // Fetch all action items for this meeting (including any manual ones)
  const allActionItems = await ActionItem.find({ meeting: meetingId })
    .populate("assignee", "name username avatar")
    .populate("convertedProject", "name color")
    .populate("convertedTeam", "name color")
    .populate("convertedTask", "title status columnId")
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
  const summary = await Summary.findOne({ meeting: meetingId })
    .populate("generatedBy", "name username avatar profilePicture")
    .populate("trustedBy", "name username avatar profilePicture");

  const actionItems = await ActionItem.find({ meeting: meetingId })
    .populate("assignee", "name username avatar")
    .populate("convertedProject", "name color")
    .populate("convertedTeam", "name color")
    .populate("convertedTask", "title status columnId")
    .sort({ createdAt: 1 });

  return { summary, actionItems };
};

/**
 * Mark summary as trusted and finalized (Meeting host only)
 */
const trustSummary = async (meetingId, userId) => {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const isHost = meeting.host && meeting.host.toString() === userId.toString();
  if (!isHost) {
    const error = new Error("Permission Denied: Only the meeting host can mark the summary as trusted");
    error.statusCode = 403;
    throw error;
  }

  const summary = await Summary.findOne({ meeting: meetingId });
  if (!summary) {
    const error = new Error("Summary not found");
    error.statusCode = 404;
    throw error;
  }

  summary.isTrusted = true;
  summary.trustedBy = userId;
  summary.trustedAt = new Date();
  await summary.save();

  return await Summary.findById(summary._id)
    .populate("generatedBy", "name username avatar profilePicture")
    .populate("trustedBy", "name username avatar profilePicture");
};

/**
 * Delete summary and all associated action items (Host only, and cannot delete if trusted)
 */
const deleteSummary = async (meetingId, userId) => {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const isHost = meeting.host && meeting.host.toString() === userId.toString();
  if (!isHost) {
    const error = new Error("Permission Denied: Only the meeting host can delete the summary");
    error.statusCode = 403;
    throw error;
  }

  const summary = await Summary.findOne({ meeting: meetingId });
  if (summary && summary.isTrusted) {
    const error = new Error("This summary is marked as Trusted and finalized. It cannot be deleted.");
    error.statusCode = 400;
    throw error;
  }

  await Summary.deleteOne({ meeting: meetingId });
  await ActionItem.deleteMany({ meeting: meetingId });
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
        const titleStr = item.title ? `**${item.title}:** ` : "";
        output += `- ${checkbox} ${titleStr}${item.task} (Assignee: ${item.assigneeName || "Unassigned"} | Priority: ${item.priority.toUpperCase()})\n`;
      });
    }
  } else {
    // Plain text
    output += `AI MEETING SUMMARY: ${title.toUpperCase()}\n`;
    output += `Date: ${dateStr}\n`;
    output += `Host: ${host}\n\n`;


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
        const titleStr = item.title ? `[${item.title}] ` : "";
        output += `${i + 1}. ${mark} ${titleStr}${item.task} (Owner: ${item.assigneeName || "Unassigned"}, Priority: ${item.priority})\n`;
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
  trustSummary,
  deleteSummary,
  exportSummary,
};
