// Chat input with auto-expanding textarea, emoji shortcuts, send button, and typing notifications
// Preserves all existing logic while providing a polished Google Meet / Discord-quality dark UI

import { useRef, useState, useEffect } from "react";
import { Send, Smile, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onSend: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
}

const QUICK_EMOJIS = ["👍", "👏", "❤️", "😂", "🎉", "🔥", "👋", "🚀", "💯"];

export function ChatInput({ onSend, onTyping }: Props) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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

  const handleChange = (value: string) => {
    setText(value);

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
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a new line
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
    <div className="border-t border-gray-800/80 p-3 bg-gray-900/95 backdrop-blur-md flex flex-col gap-2">
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

      {/* Main input card container */}
      <div className="relative flex flex-col bg-gray-800/70 focus-within:bg-gray-800 border border-gray-700/60 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 rounded-2xl transition-all shadow-inner p-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message to everyone..."
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