// Application header with responsive desktop navigation and mobile drawer menu
// Shown on all authenticated pages

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogOut,
  Video,
  Menu,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { logout as logoutApi } from "@/services/authService";
import { NotificationDropdown } from "./NotificationDropdown";
import { useSidebarStore } from "@/store/sidebarStore";

export function Header() {
  const { user, clearAuth } = useAuthStore();
  const { setHovered, togglePin, toggleMobile } = useSidebarStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleGlobalRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      toast.success("Page data refreshed!");
    } catch {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.error("Logout API error:", error);
    }
    clearAuth();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md transition-colors shadow-xs">
      <div className="w-full flex h-16 items-center justify-between px-4 sm:px-6 md:px-8">
        {/* Brand Logo & Hover Sidebar Trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Desktop Hover & Pin Menu Trigger */}
          <button
            type="button"
            onClick={togglePin}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="hidden md:inline-flex p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition border border-transparent hover:border-slate-200 cursor-pointer"
            title="Open navigation menu (Hover or Click to Pin)"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Single 3-Line Menu Trigger */}
          <button
            type="button"
            onClick={toggleMobile}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200 cursor-pointer"
            title="Open navigation menu"
            aria-label="Open mobile navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            to="/dashboard"
            className="flex items-center gap-2 sm:gap-2.5 group"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition transform shrink-0">
              <Video className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                IntellMeet
              </span>
              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded-md tracking-wider">
                PRO
              </span>
            </div>
          </Link>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <>
              {/* Real-Time Notification Bell Dropdown */}
              <NotificationDropdown />

              {/* Desktop Global Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGlobalRefresh}
                disabled={isRefreshing}
                className="hidden sm:inline-flex text-slate-500 hover:text-blue-600 hover:bg-blue-50 text-xs px-2.5 py-1.5 rounded-xl transition gap-1.5 border border-transparent hover:border-blue-200"
                title="Refresh page data"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
                <span className="hidden xl:inline text-xs font-medium">Refresh</span>
              </Button>

              {/* Desktop Profile Pill */}
              <Link
                to="/profile"
                className={`hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition ${location.pathname === "/profile"
                    ? "border-blue-300 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-100 text-slate-800"
                  }`}
                title="Manage Profile"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold border border-white/40 shrink-0">
                  {user.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-900 leading-tight max-w-[110px] truncate">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    @{user.username}
                  </span>
                </div>
              </Link>

              {/* Desktop Logout Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="hidden sm:inline-flex text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs px-2.5 py-1.5 rounded-xl transition"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
                <span className="ml-1.5">Logout</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}