// Renders a single chat message bubble with rich dark aesthetics, avatars, timestamps, and host actions
// Preserves all original logic, with non-blocking inline delete confirmation and copy-to-clipboard

import { useState } from "react";
import { Trash2, Copy, Check, Shield, ShieldAlert } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

interface Props {
  message: ChatMessageType;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: (messageId: string) => void;
}

// Consistent vibrant avatar gradients based on user id or name
const AVATAR_GRADIENTS = [
  "from-blue-600 to-indigo-600",
  "from-violet-600 to-purple-600",
  "from-emerald-600 to-teal-600",
  "from-amber-600 to-orange-600",
  "from-rose-600 to-pink-600",
  "from-cyan-600 to-blue-600",
  "from-fuchsia-600 to-pink-600",
];

const NAME_COLORS = [
  "text-blue-400",
  "text-purple-400",
  "text-emerald-400",
  "text-amber-400",
  "text-rose-400",
  "text-cyan-400",
  "text-fuchsia-400",
];

const getHash = (str: string = "") => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return Math.abs(hash);
};

const getAvatarGradient = (str: string = "") => {
  return AVATAR_GRADIENTS[getHash(str) % AVATAR_GRADIENTS.length];
};

const getNameColor = (str: string = "") => {
  return NAME_COLORS[getHash(str) % NAME_COLORS.length];
};

const getInitials = (name: string = "") => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

// Auto-detect and render clickable links in message text
function renderMessageText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-300 hover:text-blue-100 break-all transition-colors underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function ChatMessage({ message, isOwn, canDelete, onDelete }: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleConfirmDelete = () => {
    onDelete(message._id);
    setShowConfirmDelete(false);
  };

  // System message view
  if (message.type === "system") {
    return (
      <div className="flex justify-center my-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-800/70 border border-gray-700/50 text-[11px] text-gray-400 font-medium shadow-sm">
          <Shield className="w-3 h-3 text-blue-400" />
          <span>{message.message}</span>
        </div>
      </div>
    );
  }

  const senderName = message.sender?.name || message.sender?.username || "Guest";
  const avatarGradient = getAvatarGradient(message.sender?._id || senderName);
  const nameColor = getNameColor(message.sender?._id || senderName);

  // Deleted message view
  if (message.isDeleted) {
    return (
      <div
        className={`flex flex-col my-1.5 transition-all ${
          isOwn ? "items-end" : "items-start"
        }`}
      >
        {!isOwn && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className={`text-xs font-medium opacity-60 ${nameColor}`}>
              {senderName}
            </span>
            <span className="text-[10px] text-gray-500">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}

        <div
          className={`flex items-center gap-2 max-w-[88%] ${
            isOwn ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {!isOwn && (
            <div className="shrink-0 mb-1 opacity-50">
              {message.sender?.profilePicture ? (
                <img
                  src={message.sender.profilePicture}
                  alt={senderName}
                  className="w-7 h-7 rounded-full object-cover border border-gray-700/50 grayscale"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full bg-gray-800 text-gray-400 font-medium text-[10px] flex items-center justify-center border border-gray-700/60 select-none"
                >
                  {getInitials(senderName)}
                </div>
              )}
            </div>
          )}

          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gray-800/40 border border-gray-700/50 text-xs text-gray-400 italic shadow-sm backdrop-blur-xs">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
            <span className="text-gray-300 font-medium">Message was deleted by host</span>
          </div>
        </div>

        {isOwn && (
          <div className="flex items-center justify-end gap-1 mt-0.5 px-1">
            <span className="text-[10px] text-gray-500">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`group flex flex-col relative transition-all duration-150 ${
        isOwn ? "items-end" : "items-start"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowConfirmDelete(false);
      }}
    >
      {/* Header with sender name for incoming messages */}
      {!isOwn && (
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className={`text-xs font-medium ${nameColor}`}>
            {senderName}
          </span>
          <span className="text-[10px] text-gray-500">
            {formatTime(message.createdAt)}
          </span>
        </div>
      )}

      {/* Message bubble & actions row */}
      <div
        className={`flex items-end gap-2 max-w-[88%] ${
          isOwn ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar for remote participants */}
        {!isOwn && (
          <div className="shrink-0 mb-1">
            {message.sender?.profilePicture ? (
              <img
                src={message.sender.profilePicture}
                alt={senderName}
                className="w-7 h-7 rounded-full object-cover border border-gray-700/70 shadow-sm"
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-full bg-gradient-to-tr ${avatarGradient} text-white font-semibold text-[10px] flex items-center justify-center shadow-sm select-none`}
              >
                {getInitials(senderName)}
              </div>
            )}
          </div>
        )}

        {/* Bubble container */}
        <div className="relative group/bubble flex flex-col">
          <div
            className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm transition-colors ${
              isOwn
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-br-xs border border-blue-500/30 shadow-blue-900/10"
                : "bg-gray-800/90 hover:bg-gray-800 text-gray-100 rounded-2xl rounded-tl-xs border border-gray-700/60 shadow-black/20"
            }`}
          >
            {renderMessageText(message.message)}
          </div>

          {/* Time & status for own message */}
          {isOwn && (
            <div className="flex items-center justify-end gap-1 mt-0.5 px-1">
              <span className="text-[10px] text-gray-400">
                {formatTime(message.createdAt)}
              </span>
            </div>
          )}
        </div>

        {/* Hover Action Bar (Copy + Host Delete) */}
        <div
          className={`flex items-center gap-1 transition-opacity duration-150 ${
            isHovered || showConfirmDelete
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Inline Delete Confirmation */}
          {showConfirmDelete ? (
            <div className="flex items-center gap-1 bg-red-950/90 border border-red-800/80 px-2 py-0.5 rounded-lg text-xs shadow-md animate-in fade-in">
              <span className="text-[11px] text-red-200">Delete?</span>
              <button
                onClick={handleConfirmDelete}
                className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded text-[10px] transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[10px] transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <>
              {/* Copy message button */}
              <button
                onClick={handleCopy}
                className="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800/90 border border-transparent hover:border-gray-700/60 transition-all"
                title={copied ? "Copied!" : "Copy message"}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Delete message button (Host only) */}
              {canDelete && (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="p-1 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                  title="Delete message"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}