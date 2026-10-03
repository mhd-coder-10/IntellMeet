// Chat input with send button and typing notifications
// Emits typing true on keystroke, false after 1.5s idle

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    onSend: (text: string) => void;
    onTyping: (isTyping: boolean) => void;
}

export function ChatInput({ onSend, onTyping }: Props) {
    const [text, setText] = useState("");
    const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);

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
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter sends, Shift+Enter adds a new line
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="border-t p-3 flex items-end gap-2 bg-white">
            <textarea
                value={text}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 resize-none border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-24"
            />

            <Button
                size="icon"
                onClick={handleSend}
                disabled={!text.trim()}
                className="h-9 w-9 shrink-0"
            >
                <Send className="h-4 w-4" />
            </Button>
        </div>
    );
}