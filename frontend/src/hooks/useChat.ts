// Manages chat lifecycle: loads history, listens to socket events
// Provides send, delete and typing helpers

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { useChatStore } from "@/store/chatStore";
import { useAuthStore } from "@/store/authStore";
import { getChatHistory } from "@/services/chatService";
import type { ChatMessage } from "@/types/chat";

export function useChat(socket: Socket | null, meetingId: string | null) {
    const currentUser = useAuthStore((state) => state.user);
    const {
        messages,
        typingUsers,
        setMessages,
        addMessage,
        removeMessage,
        setTyping,
        clearChat,
    } = useChatStore();

    // Load chat history on mount
    useEffect(() => {
        if (!meetingId) return;

        getChatHistory(meetingId)
            .then(setMessages)
            .catch((err) => console.error("Failed to load chat history:", err));
    }, [meetingId, setMessages]);

    // Listen to socket events for new messages, deletions and typing
    useEffect(() => {
        if (!socket || !meetingId) return;

        const handleMessage = (message: ChatMessage) => {
            addMessage(message);
        };

        const handleDelete = ({
            messageId,
            deletedBy,
        }: {
            messageId: string;
            deletedBy?: string;
        }) => {
            removeMessage(messageId, deletedBy || "host");
        };

        const handleTyping = ({
            userId,
            username,
            isTyping,
        }: {
            userId: string;
            username: string;
            isTyping: boolean;
        }) => {
            if (userId === currentUser?.id) return;
            setTyping(userId, username, isTyping);
        };

        socket.on("chat:message", handleMessage);
        socket.on("chat:message-deleted", handleDelete);
        socket.on("chat:user-typing", handleTyping);

        return () => {
            socket.off("chat:message", handleMessage);
            socket.off("chat:message-deleted", handleDelete);
            socket.off("chat:user-typing", handleTyping);
        };
    }, [socket, meetingId, currentUser, addMessage, removeMessage, setTyping]);

    // Clear chat state when leaving the room
    useEffect(() => {
        return () => clearChat();
    }, [clearChat]);

    const sendMessage = (text: string) => {
        if (!socket || !meetingId || !text.trim()) return;
        socket.emit("chat:send", { meetingId, message: text.trim() });
    };

    const deleteMessage = (messageId: string) => {
        if (!socket || !meetingId) return;
        socket.emit("chat:delete", { meetingId, messageId });
    };

    const sendTyping = (isTyping: boolean) => {
        if (!socket || !meetingId) return;
        socket.emit("chat:typing", { meetingId, isTyping });
    };

    return { messages, typingUsers, sendMessage, deleteMessage, sendTyping };
}