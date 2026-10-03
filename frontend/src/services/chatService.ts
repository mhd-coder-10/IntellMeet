// Handles chat API calls for fetching history and deleting messages

import api from "./api";
import type { ChatMessage } from "@/types/chat";

// Fetch paginated chat history for a meeting
export const getChatHistory = async (
    meetingId: string,
    limit = 50,
    page = 1
): Promise<ChatMessage[]> => {
    const response = await api.get(
        `/chats/${meetingId}?limit=${limit}&page=${page}`
    );
    return response.data.data.messages;
};

// Soft delete a chat message owned by current user
export const deleteChatMessage = async (messageId: string): Promise<void> => {
    await api.delete(`/chats/message/${messageId}`);
};