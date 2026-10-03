// Defines TypeScript types for chat messages
// Matches the shape returned by both REST API and Socket.io

export interface ChatSender {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
}

export interface ChatMessage {
  _id: string;
  meeting: string;
  sender: ChatSender;
  message: string;
  type: "text" | "system";
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TypingUser {
  userId: string;
  username: string;
}