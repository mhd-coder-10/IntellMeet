// Team Workspace and Project Board API Service

import api from "./api";
import type { Team, ProjectBoard } from "@/types/team";

// Get all workspaces for current user
export const getUserTeams = async (): Promise<Team[]> => {
  const res = await api.get<{ success: boolean; data: Team[] }>("/teams");
  return res.data.data;
};

// Create a new team workspace
export const createTeam = async (data: {
  name: string;
  description?: string;
  color?: string;
  avatar?: string;
}): Promise<Team> => {
  const res = await api.post<{ success: boolean; data: Team }>("/teams", data);
  return res.data.data;
};

// Get team workspace details by ID
export const getTeamById = async (teamId: string): Promise<Team> => {
  const res = await api.get<{ success: boolean; data: Team }>(`/teams/${teamId}`);
  return res.data.data;
};

// Update team details
export const updateTeam = async (
  teamId: string,
  data: { name?: string; description?: string; color?: string; avatar?: string }
): Promise<Team> => {
  const res = await api.put<{ success: boolean; data: Team }>(`/teams/${teamId}`, data);
  return res.data.data;
};

// Delete team workspace
export const deleteTeam = async (teamId: string): Promise<void> => {
  await api.delete(`/teams/${teamId}`);
};

// Add team member by email or username
export const addTeamMember = async (
  teamId: string,
  data: { identifier: string; role?: "admin" | "member" }
): Promise<Team> => {
  const res = await api.post<{ success: boolean; data: Team }>(
    `/teams/${teamId}/members`,
    data
  );
  return res.data.data;
};

// Remove team member
export const removeTeamMember = async (
  teamId: string,
  userId: string
): Promise<Team> => {
  const res = await api.delete<{ success: boolean; data: Team }>(
    `/teams/${teamId}/members/${userId}`
  );
  return res.data.data;
};

// Update team member role (admin <-> member)
export const updateTeamMemberRole = async (
  teamId: string,
  userId: string,
  role: "admin" | "member"
): Promise<Team> => {
  const res = await api.patch<{ success: boolean; data: Team }>(
    `/teams/${teamId}/members/${userId}/role`,
    { role }
  );
  return res.data.data;
};

// Join team using invite code
export const joinTeamByCode = async (code: string): Promise<Team> => {
  const res = await api.post<{ success: boolean; data: Team; message?: string }>("/teams/join", {
    code,
  });
  const data = res.data.data;
  if (res.data.message && !data.membershipMessage) {
    data.membershipMessage = res.data.message;
  }
  return data;
};

// Respond to join request (Accept or Reject)
export const respondToJoinRequest = async (
  teamId: string,
  userId: string,
  action: "accept" | "reject"
): Promise<Team> => {
  const res = await api.post<{ success: boolean; data: Team }>(
    `/teams/${teamId}/requests/${userId}/respond`,
    { action }
  );
  return res.data.data;
};

// Cancel join request or remove rejected team
export const cancelJoinRequest = async (teamId: string): Promise<{ message: string }> => {
  const res = await api.delete<{ success: boolean; message: string }>(
    `/teams/${teamId}/requests`
  );
  return res.data;
};

// Create a new project board in a team
export const createProject = async (
  teamId: string,
  data: { name: string; description?: string; color?: string }
): Promise<ProjectBoard> => {
  const res = await api.post<{ success: boolean; data: ProjectBoard }>(
    `/teams/${teamId}/projects`,
    data
  );
  return res.data.data;
};

// Get all projects for a team
export const getProjectsByTeam = async (teamId: string): Promise<ProjectBoard[]> => {
  const res = await api.get<{ success: boolean; data: ProjectBoard[] }>(
    `/teams/${teamId}/projects`
  );
  return res.data.data;
};

// Get project board by ID
export const getProjectById = async (projectId: string): Promise<ProjectBoard> => {
  const res = await api.get<{ success: boolean; data: ProjectBoard }>(
    `/projects/${projectId}`
  );
  return res.data.data;
};

// Update project board
export const updateProject = async (
  projectId: string,
  data: { name?: string; description?: string; color?: string; status?: string }
): Promise<ProjectBoard> => {
  const res = await api.put<{ success: boolean; data: ProjectBoard }>(
    `/projects/${projectId}`,
    data
  );
  return res.data.data;
};

// Delete project board
export const deleteProject = async (projectId: string): Promise<void> => {
  await api.delete(`/projects/${projectId}`);
};
