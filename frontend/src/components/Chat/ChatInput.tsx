// Chat input with auto-expanding textarea, emoji shortcuts, send button, typing notifications, and @mention autocomplete
// Preserves all existing logic while providing a polished Google Meet / Discord-quality dark UI

import { useRef, useState, useEffect } from "react";
import { Send, Smile, Sparkles, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MentionCandidate {
  id: string;
  name: string;
  username: string;
  profilePicture?: string;
}

interface Props {
  onSend: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  mentionSuggestions?: MentionCandidate[];
}

const QUICK_EMOJIS = ["👍", "👏", "❤️", "😂", "🎉", "🔥", "👋", "🚀", "💯"];

export function ChatInput({ onSend, onTyping, mentionSuggestions = [] }: Props) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Auto-resize textarea to fit text up to max-height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [text]);

  // Filter mention candidates based on active query
  const filteredCandidates = mentionSuggestions.filter((c) => {
    if (!mentionQuery) return true;
    return (
      (c.username || "").toLowerCase().includes(mentionQuery) ||
      (c.name || "").toLowerCase().includes(mentionQuery)
    );
  });

  const handleChange = (value: string) => {
    setText(value);

    // Check for @mention trigger at the current cursor position
    const cursorPos = textareaRef.current?.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursorPos);
    const mentionMatch = beforeCursor.match(/@([a-zA-Z0-9_.-]*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1].toLowerCase());
      setShowMentions(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentions(false);
    }

    // Emit typing true only once until user stops
    if (!isTypingRef.current && value.trim()) {
      isTypingRef.current = true;
      onTyping(true);
    }

    // Reset the idle timeout
    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTyping(false);
      }
    }, 1500);
  };

  const handleSelectMention = (candidate: MentionCandidate) => {
    const cursorPos = textareaRef.current?.selectionStart ?? text.length;
    const beforeCursor = text.slice(0, cursorPos);
    const afterCursor = text.slice(cursorPos);

    const newBefore = beforeCursor.replace(
      /@([a-zA-Z0-9_.-]*)$/,
      `@${candidate.username} `
    );
    const newText = newBefore + afterCursor;
    setText(newText);
    setShowMentions(false);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const pos = newBefore.length;
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleSend = () => {
    if (!text.trim()) return;

    onSend(text);

    // Clear typing state immediately
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping(false);
    }

    setText("");
    setShowMentions(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If mention popover is open, intercept navigation keys
    if (showMentions && filteredCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < filteredCandidates.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCandidates.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectMention(filteredCandidates[selectedMentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    // Normal Enter sends, Shift+Enter adds a new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    const newText = text + emoji;
    handleChange(newText);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-gray-800/80 p-3 bg-gray-900/95 backdrop-blur-md flex flex-col gap-2 relative">
      {/* Quick emoji drawer toggle */}
      {showEmojiPicker && (
        <div className="flex items-center gap-1.5 p-1.5 bg-gray-800/90 border border-gray-700/60 rounded-xl backdrop-blur-md shadow-lg overflow-x-auto scrollbar-none animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="text-[11px] text-gray-400 pl-1.5 pr-1 flex items-center gap-1 select-none">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Quick:
          </span>
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleInsertEmoji(emoji)}
              className="text-base hover:scale-125 hover:bg-gray-700/60 p-1 rounded-lg transition-transform active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Mention Autocomplete Dropdown */}
      {showMentions && filteredCandidates.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-2 bg-gray-900/95 border border-purple-500/30 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden z-30 max-h-52 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-1.5 bg-gray-800/80 border-b border-gray-700/50 flex items-center justify-between text-[11px] text-purple-300 font-semibold select-none">
            <span className="flex items-center gap-1.5">
              <AtSign className="w-3 h-3 text-purple-400" />
              Mention attendee
            </span>
            <span className="text-[10px] text-gray-400 font-normal">
              ↑↓ Navigate • ↵ Select
            </span>
          </div>

          <div className="overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
            {filteredCandidates.map((candidate, idx) => {
              const isSelected = idx === selectedMentionIndex;
              const initials = (candidate.name || candidate.username || "?")
                .slice(0, 2)
                .toUpperCase();

              return (
                <button
                  key={candidate.id || candidate.username}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent textarea blur
                    handleSelectMention(candidate);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? "bg-purple-600/25 border border-purple-500/40 text-purple-100"
                      : "hover:bg-gray-800/70 text-gray-300 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {candidate.profilePicture ? (
                      <img
                        src={candidate.profilePicture}
                        alt={candidate.name}
                        className="w-6 h-6 rounded-full object-cover shrink-0 border border-gray-700"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-xs font-medium text-gray-200 truncate">
                        {candidate.name}
                      </div>
                      <div className="text-[11px] text-purple-400 truncate">
                        @{candidate.username}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[10px] text-purple-300/80 shrink-0 font-mono">
                      ↵
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main input card container */}
      <div className="relative flex flex-col bg-gray-800/70 focus-within:bg-gray-800 border border-gray-700/60 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 rounded-2xl transition-all shadow-inner p-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message or type @ to mention..."
          rows={1}
          className="w-full resize-none bg-transparent px-2 py-1 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none max-h-28 overflow-y-auto leading-relaxed scrollbar-thin"
        />

        {/* Input action toolbar */}
        <div className="flex items-center justify-between pt-1 px-1 mt-0.5 border-t border-gray-700/30">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors ${
                showEmojiPicker ? "text-blue-400 bg-gray-700/50" : ""
              }`}
              title="Add emoji"
            >
              <Smile className="h-4 w-4" />
            </button>

            {/* Quick @ mention button */}
            <button
              type="button"
              onClick={() => {
                const prefix = text && !text.endsWith(" ") ? text + " @" : text + "@";
                handleChange(prefix);
                textareaRef.current?.focus();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-purple-300 hover:bg-purple-900/30 transition-colors"
              title="Mention participant (@)"
            >
              <AtSign className="h-4 w-4" />
            </button>

            <span className="text-[10px] text-gray-500 hidden sm:inline select-none pl-1">
              Press Enter ↵ to send
            </span>
          </div>

          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim()}
            className="h-8 w-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            title="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}