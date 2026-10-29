// Team and Workspace TypeScript Definitions

export interface TeamMemberUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  profilePicture?: string;
}

export interface TeamMember {
  user: TeamMemberUser;
  role: "owner" | "admin" | "member";
  status?: "active" | "pending" | "rejected";
  joinedAt: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  order: number;
  color?: string;
}

export interface ProjectMember {
  user: TeamMemberUser;
  addedAt?: string;
  _id?: string;
}

export interface ProjectBoard {
  _id: string;
  name: string;
  description?: string;
  team: string | Team;
  owner: TeamMemberUser;
  status: "active" | "completed" | "archived";
  color: string;
  columns: KanbanColumn[];
  members?: ProjectMember[];
  totalTasks?: number;
  doneTasks?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  _id: string;
  name: string;
  description?: string;
  owner: TeamMemberUser;
  code: string;
  color: string;
  avatar?: string;
  members: TeamMember[];
  projectCount?: number;
  taskCount?: number;
  projects?: ProjectBoard[];
  currentUserStatus?: "active" | "pending" | "rejected";
  currentUserRole?: "owner" | "admin" | "member";
  membershipMessage?: string;
  createdAt: string;
  updatedAt: string;
}
