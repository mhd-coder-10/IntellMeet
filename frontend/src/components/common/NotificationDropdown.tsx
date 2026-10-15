// Real-Time Notification Bell Dropdown Component
// Displays live unread notifications, mark-all-read, clear-all, direct deep linking, and real-time socket updates

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  Trash2,
  Video,
  FolderKanban,
  MessageSquare,
  Users,
  Sparkles,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AtSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} from "@/services/notificationService";
import { useSocket } from "@/hooks/useSocket";
import type { AppNotification, NotificationType } from "@/types/notification";

// Format relative time (e.g., "2m ago", "1h ago", "Yesterday")
function formatRelativeTime(dateString: string): string {
  try {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 45) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// Icon and color configuration per notification type
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "meeting_started":
    case "meeting_invite":
    case "meeting_updated":
      return {
        icon: Video,
        bg: "bg-blue-50 text-blue-600 border-blue-200",
      };
    case "task_assigned":
    case "task_created":
      return {
        icon: FolderKanban,
        bg: "bg-indigo-50 text-indigo-600 border-indigo-200",
      };
    case "task_status":
      return {
        icon: CheckCircle2,
        bg: "bg-amber-50 text-amber-600 border-amber-200",
      };
    case "task_comment":
      return {
        icon: MessageSquare,
        bg: "bg-cyan-50 text-cyan-600 border-cyan-200",
      };
    case "task_due":
      return {
        icon: Clock,
        bg: "bg-rose-50 text-rose-600 border-rose-200",
      };
    case "task_deleted":
      return {
        icon: AlertCircle,
        bg: "bg-red-50 text-red-600 border-red-200",
      };
    case "team_updated":
    case "project_updated":
      return {
        icon: Users,
        bg: "bg-purple-50 text-purple-600 border-purple-200",
      };
    case "chat_mention":
      return {
        icon: AtSign,
        bg: "bg-purple-50 text-purple-600 border-purple-200",
      };
    case "action_item":
      return {
        icon: Sparkles,
        bg: "bg-emerald-50 text-emerald-600 border-emerald-200",
      };
    default:
      return {
        icon: Bell,
        bg: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  // Fetch notifications
  const { data, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(40),
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Real-Time Socket.io Listener for new notifications
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewNotification = (newNotif: AppNotification) => {
      // Show instant toast notification (with unique id to prevent duplicate popups)
      toast.info(newNotif.title, {
        id: `notif-${newNotif._id}`,
        description: newNotif.message,
        action: newNotif.link
          ? {
              label: "View",
              onClick: () => {
                navigate(newNotif.link!);
              },
            }
          : undefined,
      });

      // Optimistically update React Query cache
      queryClient.setQueryData(
        ["notifications"],
        (old: { notifications: AppNotification[]; unreadCount: number } | undefined) => {
          if (!old) {
            return { notifications: [newNotif], unreadCount: 1 };
          }
          if (old.notifications.some((n) => n._id === newNotif._id)) {
            return old;
          }
          return {
            notifications: [newNotif, ...old.notifications],
            unreadCount: old.unreadCount + 1,
          };
        }
      );
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [socket, isConnected, queryClient, navigate]);

  // Close dropdown on outside click or Esc
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Mutations
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["notifications"],
        (old: { notifications: AppNotification[]; unreadCount: number } | undefined) => {
          if (!old) return old;
          return {
            notifications: old.notifications.map((n) =>
              n._id === updated._id ? { ...n, isRead: true } : n
            ),
            unreadCount: Math.max(0, old.unreadCount - 1),
          };
        }
      );
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.setQueryData(
        ["notifications"],
        (old: { notifications: AppNotification[]; unreadCount: number } | undefined) => {
          if (!old) return old;
          return {
            notifications: old.notifications.map((n) => ({ ...n, isRead: true })),
            unreadCount: 0,
          };
        }
      );
      toast.success("All notifications marked as read");
    },
    onError: () => {
      toast.error("Failed to mark all as read");
    },
  });

  const deleteSingleMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(
        ["notifications"],
        (old: { notifications: AppNotification[]; unreadCount: number } | undefined) => {
          if (!old) return old;
          const wasUnread = old.notifications.find((n) => n._id === deletedId && !n.isRead);
          return {
            notifications: old.notifications.filter((n) => n._id !== deletedId),
            unreadCount: wasUnread ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
          };
        }
      );
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: () => clearAllNotifications(),
    onSuccess: () => {
      queryClient.setQueryData(["notifications"], {
        notifications: [],
        unreadCount: 0,
      });
      toast.success("All notifications cleared");
    },
    onError: () => {
      toast.error("Failed to clear notifications");
    },
  });

  // Otherwise kahi bhi click kare to sirf notification read ho jana chahiye (no navigation)
  const handleCardClick = (notif: AppNotification) => {
    if (!notif.isRead) {
      markAsReadMutation.mutate(notif._id);
    }
  };

  // Just Arrow par click kare to notification ka details open hona chahiye
  const handleOpenDetails = (e: React.MouseEvent, notif: AppNotification) => {
    e.stopPropagation();
    if (!notif.isRead) {
      markAsReadMutation.mutate(notif._id);
    }
    if (notif.link) {
      setIsOpen(false);
      // Normalize meeting link: always land on meeting details, never direct call room
      let targetLink = notif.link;
      const meetingMatch = targetLink.match(/^\/meetings\/([a-zA-Z0-9_-]+)$/);
      if (meetingMatch && meetingMatch[1] && meetingMatch[1] !== "schedule") {
        targetLink = `/meetings/${meetingMatch[1]}/details`;
      }
      navigate(targetLink);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    return true;
  });

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-xl transition border ${
          isOpen
            ? "bg-blue-50 border-blue-200 text-blue-600 shadow-xs"
            : "bg-transparent border-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900"
        }`}
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full mt-2 w-[calc(100vw-1rem)] sm:w-[420px] max-w-[440px] rounded-2xl bg-white shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {/* Action Buttons: Mark all read & Clear all */}
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    className="h-7 px-2 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Read all</span>
                  </Button>
                )}

                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearAllMutation.mutate()}
                    disabled={clearAllMutation.isPending}
                    className="h-7 px-2 text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg gap-1"
                    title="Clear all notifications"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear all</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Filter Tabs: All vs Unread */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  filter === "all"
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  filter === "unread"
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  {filter === "unread"
                    ? "No unread notifications right now."
                    : "You do not have any notifications at the moment."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const config = getNotificationIcon(notif.type);
                const Icon = config.icon;

                return (
                  <div
                    key={notif._id}
                    className={`group relative p-3 sm:p-3.5 transition flex items-start gap-3 hover:bg-slate-50/80 cursor-pointer ${
                      !notif.isRead ? "bg-blue-50/30" : "bg-white"
                    }`}
                    onClick={() => handleCardClick(notif)}
                    title={!notif.isRead ? "Click to mark as read" : undefined}
                  >
                    {/* Unread indicator dot */}
                    {!notif.isRead && (
                      <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}

                    {/* Icon or Sender Avatar */}
                    <div className="relative shrink-0">
                      {notif.sender?.profilePicture ? (
                        <img
                          src={notif.sender.profilePicture}
                          alt={notif.sender.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center ${config.bg}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      {/* Footer Action Icons */}
                      <div className="flex items-center justify-between gap-1 pt-1">
                        <span className="text-[10px] text-slate-400">
                          {!notif.isRead ? "Click to mark read" : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {notif.link && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenDetails(e, notif)}
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                              title="Go to details"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Individual Delete Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSingleMutation.mutate(notif._id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                            title="Delete notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          {notifications.length > 0 && (
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 px-4">
              <span>Real-time notifications</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-blue-600 font-semibold hover:underline"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
