// Zustand store for chat messages and typing users
// Supports adding, removing and clearing messages

import { create } from "zustand";
import type { ChatMessage } from "@/types/chat";

interface ChatState {
    messages: ChatMessage[];
    typingUsers: Record<string, string>;
    setMessages: (messages: ChatMessage[]) => void;
    addMessage: (message: ChatMessage) => void;
    removeMessage: (messageId: string, deletedBy?: string) => void;
    setTyping: (userId: string, username: string, isTyping: boolean) => void;
    clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    typingUsers: {},

    setMessages: (messages) => set({ messages }),

    addMessage: (message) =>
        set((state) => {
            const exists = state.messages.some((m) => m._id === message._id);
            if (exists) return state;
            return { messages: [...state.messages, message] };
        }),

    removeMessage: (messageId, deletedBy = "host") =>
        set((state) => ({
            messages: state.messages.map((m) =>
                m._id === messageId
                    ? {
                        ...m,
                        isDeleted: true,
                        deletedBy: deletedBy || "host",
                        message: "Message was deleted by host",
                      }
                    : m
            ),
        })),

    setTyping: (userId, username, isTyping) =>
        set((state) => {
            const updated = { ...state.typingUsers };
            if (isTyping) {
                updated[userId] = username;
            } else {
                delete updated[userId];
            }
            return { typingUsers: updated };
        }),

    clearChat: () => set({ messages: [], typingUsers: {} }),
}));