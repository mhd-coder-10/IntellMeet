// AI Meeting Transcript Card Component
// Displays searchable, speaker-attributed transcripts with timestamps,
// copy & export controls, and on-demand AI generation

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles,
  Search,
  Copy,
  Download,
  Check,
  RefreshCw,
  Loader2,
  FileText,
  Clock,
  MessageSquare,
  Cpu,
  AlignLeft,
  ListFilter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMeetingTranscript,
  generateMeetingTranscript,
  downloadMeetingTranscript,
} from "@/services/aiService";
import type { MeetingTranscript, TranscriptSegment } from "@/types/transcript";

interface Props {
  meetingId: string;
  meetingTitle?: string;
  meetingCode?: string;
  recordingIndex?: number;
  hasRecordings?: boolean;
  onSeekToTime?: (seconds: number) => void;
}

// Format seconds into mm:ss
const formatSeconds = (sec: number) => {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (Math.round(sec) % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export function TranscriptCard({
  meetingId,
  meetingTitle = "Meeting",
  meetingCode = "",
  recordingIndex = 0,
  hasRecordings = true,
  onSeekToTime,
}: Props) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"segments" | "text">("segments");
  const [isCopied, setIsCopied] = useState(false);

  // Fetch transcript for this meeting
  const {
    data: transcript,
    isLoading,
  } = useQuery<MeetingTranscript | null>({
    queryKey: ["meeting-transcript", meetingId, recordingIndex],
    queryFn: () => getMeetingTranscript(meetingId, recordingIndex),
    enabled: !!meetingId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Mutation to generate or regenerate transcript
  const generateMutation = useMutation({
    mutationFn: () =>
      generateMeetingTranscript(meetingId, {
        recordingIndex,
        forceRegenerate: true,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["meeting-transcript", meetingId, recordingIndex],
        data
      );
      toast.success("AI Transcript generated successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to generate transcript");
    },
  });

  // Copy full transcript to clipboard
  const handleCopy = async () => {
    if (!transcript) return;
    try {
      let copyText = `Meeting Transcript: ${meetingTitle} (${meetingCode})\n`;
      copyText += `Duration: ${formatSeconds(transcript.duration)} | Words: ${transcript.wordCount}\n\n`;

      if (transcript.segments && transcript.segments.length > 0) {
        copyText += transcript.segments
          .map(
            (s) =>
              `[${formatSeconds(s.startTime)} - ${formatSeconds(s.endTime)}] ${s.speaker}:\n${s.text}`
          )
          .join("\n\n");
      } else {
        copyText += transcript.fullText;
      }

      await navigator.clipboard.writeText(copyText);
      setIsCopied(true);
      toast.success("Transcript copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy transcript");
    }
  };

  // Export transcript (.txt or .vtt)
  const handleExport = async (format: "txt" | "vtt" | "json") => {
    try {
      const sanitizedTitle = (meetingTitle || "transcript").replace(/[^a-z0-9_-]/gi, "-");
      await downloadMeetingTranscript(meetingId, format, `${sanitizedTitle}-transcript`);
      toast.success(`Downloaded transcript (${format.toUpperCase()})`);
    } catch {
      toast.error(`Failed to export transcript as .${format}`);
    }
  };

  // Filter segments by search query
  const filteredSegments = useMemo(() => {
    if (!transcript?.segments) return [];
    if (!searchQuery.trim()) return transcript.segments;

    const q = searchQuery.toLowerCase().trim();
    return transcript.segments.filter(
      (s) =>
        s.text.toLowerCase().includes(q) ||
        s.speaker.toLowerCase().includes(q)
    );
  }, [transcript?.segments, searchQuery]);

  // Provider label formatter (generic enterprise AI branding)
  const providerLabel = useMemo(() => {
    return "AI Intelligence";
  }, []);

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
      {/* Card Header with AI Badge & Primary Controls */}
      <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3.5 sm:p-4 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm sm:text-base font-semibold text-white tracking-wide">
                  AI Meeting Transcript
                </CardTitle>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/25 border border-indigo-400/30 text-indigo-200">
                  <Cpu className="w-2.5 h-2.5" />
                  {providerLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-300/80 mt-0.5">
                Automated speech-to-text with speaker identification & timestamps
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {transcript && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 px-2.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 rounded-lg gap-1.5"
                  title="Copy full transcript"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{isCopied ? "Copied" : "Copy"}</span>
                </Button>

                <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg overflow-hidden h-8">
                  <button
                    onClick={() => handleExport("txt")}
                    className="px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition flex items-center gap-1 border-r border-slate-700 h-full"
                    title="Download Plain Text"
                  >
                    <Download className="w-3 h-3 text-slate-400" />
                    TXT
                  </button>
                  <button
                    onClick={() => handleExport("vtt")}
                    className="px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition flex items-center gap-1 h-full"
                    title="Download Subtitles (.vtt)"
                  >
                    VTT
                  </button>
                </div>
              </>
            )}

            <Button
              size="sm"
              onClick={() => {
                if (!hasRecordings) {
                  toast.error("Please record the meeting first to transcribe audio.");
                  return;
                }
                generateMutation.mutate();
              }}
              disabled={generateMutation.isPending || isLoading || !hasRecordings}
              title={!hasRecordings ? "Recording required to transcribe" : undefined}
              className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm gap-1.5 transition-all"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : transcript ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Transcript
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Row (when transcript exists) */}
        {transcript && (
          <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-slate-800/80 text-xs text-slate-300 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Duration:{" "}
              <strong className="text-white font-mono">
                {formatSeconds(transcript.duration)}
              </strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Words:{" "}
              <strong className="text-white font-mono">
                {transcript.wordCount}
              </strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              Dialogue Turns:{" "}
              <strong className="text-white font-mono">
                {transcript.segments?.length || 0}
              </strong>
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-3.5 sm:p-4">
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2.5">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs">Loading AI meeting transcript...</p>
          </div>
        ) : !transcript ? (
          /* Empty State: Not generated yet */
          <div className="py-4 px-3 text-center max-w-xs mx-auto space-y-2">
            {!hasRecordings ? (
              <>
                <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-xs">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold text-slate-800">
                    No Recording Available
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Record a meeting session first to generate an AI speech transcript.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold text-slate-800">
                    No Transcript Generated Yet
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Transcribe spoken dialogue from this recorded meeting session.
                  </p>
                </div>
                <div className="pt-1 flex justify-center">
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3.5 py-1.5 h-8 rounded-xl shadow gap-1.5"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Transcribing Audio...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Generate AI Transcript
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Active Transcript View */
          <div className="space-y-4">
            {/* Search Bar & View Mode Toggle */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search spoken keywords or speaker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-slate-800 placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* View Switcher: Segments vs Full Text */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  onClick={() => setViewMode("segments")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition ${
                    viewMode === "segments"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ListFilter className="w-3 h-3" />
                  Dialogue Turns ({filteredSegments.length})
                </button>
                <button
                  onClick={() => setViewMode("text")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition ${
                    viewMode === "text"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <AlignLeft className="w-3 h-3" />
                  Full Text
                </button>
              </div>
            </div>

            {/* View Mode 1: Dialogue Segments */}
            {viewMode === "segments" && (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {filteredSegments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 space-y-2.5">
                    <p>
                      {searchQuery
                        ? `No transcript segments match "${searchQuery}"`
                        : "No audible speech dialogue detected in this recording (low audio or background noise)."}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                      className="text-xs h-7 px-3 rounded-lg border-slate-300"
                    >
                      {generateMutation.isPending ? "Retrying..." : "Retry Transcription"}
                    </Button>
                  </div>
                ) : (
                  filteredSegments.map((segment: TranscriptSegment) => (
                    <div
                      key={segment.id}
                      className="group p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 hover:border-indigo-200 transition-all flex gap-3.5"
                    >
                      {/* Avatar initial */}
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-0.5">
                        {segment.speaker?.charAt(0).toUpperCase() || "U"}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-800">
                              {segment.speaker}
                            </span>
                            {segment.confidence && segment.confidence >= 0.9 && (
                              <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
                                AI Verified
                              </span>
                            )}
                          </div>

                          {/* Timestamp Pill - Click to seek video */}
                          <button
                            onClick={() => onSeekToTime && onSeekToTime(segment.startTime)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-[11px] font-mono text-slate-500 transition shadow-2xs group-hover:bg-indigo-50/50"
                            title="Click to jump video to this moment"
                          >
                            <Clock className="w-2.5 h-2.5 text-indigo-500" />
                            {formatSeconds(segment.startTime)} -{" "}
                            {formatSeconds(segment.endTime)}
                          </button>
                        </div>

                        {/* Spoken text */}
                        <p className="text-xs text-slate-700 leading-relaxed font-normal">
                          {segment.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* View Mode 2: Clean Full Text */}
            {viewMode === "text" && (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 font-mono text-xs text-slate-800 leading-relaxed max-h-[460px] overflow-y-auto whitespace-pre-wrap select-text">
                {transcript.fullText || "No full text available"}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
