// Right sidebar chat panel shown inside the meeting room
// Styled with Google Meet / Discord dark aesthetics, live auto-scroll, empty states, and quick starters
// Preserves all props, event callbacks, and host-delete privileges

import { useEffect, useRef, useState } from "react";
import {
  X,
  MessageSquare,
  Crown,
  Info,
  ArrowDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

interface Props {
  messages: ChatMessageType[];
  typingUsers: Record<string, string>;
  isHost: boolean;
  onSend: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onDelete: (messageId: string) => void;
  onClose: () => void;
}

const QUICK_STARTERS = [
  "👋 Hello everyone!",
  "👍 Can everyone hear me?",
  "🎉 Ready when you are!",
];

export function ChatPanel({
  messages,
  typingUsers,
  isHost,
  onSend,
  onTyping,
  onDelete,
  onClose,
}: Props) {
  const currentUser = useAuthStore((state) => state.user);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  // Check scroll position to display jump-to-bottom button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottom(!isNearBottom);
  };

  // Auto scroll to latest message if already near bottom or on initial load
  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom("smooth");
    }
  }, [messages, typingUsers]);

  const typingNames = Object.values(typingUsers);

  return (
    <div className="w-80 sm:w-96 flex-shrink-0 border-l border-gray-800/80 bg-gray-900/95 backdrop-blur-xl flex flex-col h-full shadow-2xl relative z-20 text-gray-100 select-text">
      {/* Top Header */}
      <div className="px-4 py-3.5 border-b border-gray-800/80 flex items-center justify-between bg-gray-900/70 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
            <MessageSquare className="h-4 w-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm text-gray-100 tracking-tight">
                In-call Messages
              </h2>
              {messages.length > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700/60">
                  {messages.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              {isHost ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-full">
                  <Crown className="w-2.5 h-2.5" />
                  Host Controls Active
                </span>
              ) : (
                <span className="text-[11px] text-gray-400">
                  Meeting Chat
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/80 transition-colors"
          title="Close chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Dismissible Google Meet-style Call Privacy Notice */}
      {showInfoBanner && (
        <div className="px-3.5 py-2 bg-blue-950/30 border-b border-blue-900/30 flex items-start justify-between gap-2 text-xs text-blue-200/80 animate-in fade-in select-none">
          <div className="flex items-start gap-2 pt-0.5">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-tight">
              Messages are only visible to members currently in this call.
            </p>
          </div>
          <button
            onClick={() => setShowInfoBanner(false)}
            className="text-blue-300/60 hover:text-blue-200 p-0.5 rounded hover:bg-blue-900/30 transition-colors"
            title="Dismiss notice"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Scrollable Messages Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 relative scrollbar-thin"
      >
        {messages.length === 0 ? (
          /* Empty Chat View */
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 select-none">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <MessageSquare className="w-7 h-7" />
            </div>

            <h3 className="font-semibold text-gray-200 text-sm mb-1">
              No messages yet
            </h3>
            <p className="text-xs text-gray-400 max-w-[220px] mb-6 leading-relaxed">
              Send a message to start conversing with everyone in the meeting.
            </p>

            {/* Quick Greeting Chips */}
            <div className="w-full flex flex-col gap-2 max-w-[240px]">
              <span className="text-[11px] font-medium text-gray-500 flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Quick greetings
              </span>
              {QUICK_STARTERS.map((text) => (
                <button
                  key={text}
                  onClick={() => onSend(text)}
                  className="w-full text-xs text-left px-3 py-2 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 text-gray-300 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Render Messages */
          messages.map((m) => (
            <ChatMessage
              key={m._id}
              message={m}
              isOwn={m.sender._id === currentUser?.id}
              canDelete={isHost}
              onDelete={onDelete}
            />
          ))
        )}

        <div ref={bottomRef} className="h-px" />
      </div>

      {/* Floating Jump to Bottom Button */}
      {showScrollBottom && (
        <div className="absolute bottom-24 right-6 z-30 animate-in fade-in slide-in-from-bottom-2">
          <button
            onClick={() => scrollToBottom("smooth")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Latest</span>
          </button>
        </div>
      )}

      {/* Active Typing Notification */}
      <TypingIndicator usernames={typingNames} />

      {/* Input Area */}
      <ChatInput onSend={onSend} onTyping={onTyping} />
    </div>
  );
}