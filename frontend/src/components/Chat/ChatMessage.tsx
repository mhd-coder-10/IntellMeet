// Renders a single chat message bubble
// Host sees a delete button on hover for any message

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

interface Props {
    message: ChatMessageType;
    isOwn: boolean;
    canDelete: boolean;
    onDelete: (messageId: string) => void;
}

const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
};

export function ChatMessage({ message, isOwn, canDelete, onDelete }: Props) {
    const [isHovered, setIsHovered] = useState(false);

    const handleDelete = () => {
        if (confirm("Delete this message? This cannot be undone.")) {
            onDelete(message._id);
        }
    };

    return (
        <div
            className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {!isOwn && (
                <span className="text-xs text-gray-500 mb-1 px-1">
                    {message.sender.name}
                </span>
            )}

            <div className="flex items-center gap-2 max-w-[85%]">
                {!isOwn && canDelete && isHovered && (
                    <button
                        onClick={handleDelete}
                        className="text-gray-400 hover:text-red-500 transition"
                        title="Delete message"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                )}

                <div
                    className={`px-3 py-2 rounded-lg text-sm break-words ${isOwn
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-gray-100 text-gray-900 rounded-bl-sm"
                        }`}
                >
                    {message.message}
                </div>

                {isOwn && canDelete && isHovered && (
                    <button
                        onClick={handleDelete}
                        className="text-gray-400 hover:text-red-500 transition"
                        title="Delete message"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            <span className="text-[10px] text-gray-400 mt-1 px-1">
                {formatTime(message.createdAt)}
            </span>
        </div>
    );
}