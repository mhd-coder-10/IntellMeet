// Service for User Profile and Account Management
// Connects to /api/users endpoints with JWT authentication

import api from "./api";
import type { User } from "@/types/auth";

export interface UpdateProfilePayload {
  name?: string;
  username?: string;
  bio?: string;
}

export interface UpdatePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// Fetch current user profile from backend
export const getUserProfile = async (): Promise<User> => {
  const response = await api.get("/users/profile");
  return response.data.data.user;
};

// Update name, username, bio
export const updateUserProfile = async (
  payload: UpdateProfilePayload
): Promise<User> => {
  const response = await api.put("/users/profile", payload);
  return response.data.data.user;
};

// Upload new avatar image to Cloudinary via backend
export const uploadAvatar = async (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await api.put("/users/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data.data.user;
};

// Delete avatar image from Cloudinary & database
export const deleteAvatar = async (): Promise<User> => {
  const response = await api.delete("/users/avatar");
  return response.data.data.user;
};

// Update account password
export const changePassword = async (
  payload: UpdatePasswordPayload
): Promise<{ message: string }> => {
  const response = await api.put("/users/password", payload);
  return response.data;
};
