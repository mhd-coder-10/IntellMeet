// Right sidebar chat panel shown inside the meeting room
// Host can delete any message, members cannot delete

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
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

    // Auto scroll to latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, typingUsers]);

    const typingNames = Object.values(typingUsers);

    return (
        <div className="w-80 border-l bg-white flex flex-col h-full">
            <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">
                    Chat {isHost && <span className="text-xs text-gray-400">(Host)</span>}
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 mt-8">
                        No messages yet. Say hello!
                    </div>
                ) : (
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

                <div ref={bottomRef} />
            </div>

            <TypingIndicator usernames={typingNames} />

            <ChatInput onSend={onSend} onTyping={onTyping} />
        </div>
    );
}