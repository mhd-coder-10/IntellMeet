// Hover-Expandable Enterprise Sidebar Navigation Component
// Automatically expands when hovered and collapses when cursor leaves.
// Adjusts the page content smoothly without cutting off any elements.

import { useLocation, Link } from "react-router-dom";
import {
  Home,
  Video,
  Users,
  Plus,
  Search,
  User as UserIcon,
  Pin,
  PinOff,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { useSidebarStore } from "@/store/sidebarStore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const {
    isOpen,
    isPinned,
    isMobileOpen,
    setHovered,
    togglePin,
    closeMobile,
  } = useSidebarStore();

  const navLinks = [
    { to: "/dashboard", label: "Dashboard", icon: Home, badge: null },
    { to: "/meetings", label: "Meetings", icon: Video, badge: null },
    { to: "/teams", label: "Teams & Boards", icon: Users, badge: "Collab" },
    { to: "/meetings/create", label: "New Meeting", icon: Plus, badge: null },
    { to: "/meetings/join", label: "Join Room", icon: Search, badge: null },
    { to: "/profile", label: "My Profile", icon: UserIcon, badge: null },
  ];

  return (
    <>
      {/* LEFT EDGE HOVER TRIGGER STRIP (Desktop only - strictly hidden on mobile)
          When cursor hovers over the extreme left edge, sidebar expands automatically! */}
      {!isPinned && (
        <div
          onMouseEnter={() => {
            if (typeof window !== "undefined" && window.innerWidth >= 768) {
              setHovered(true);
            }
          }}
          className={`hidden md:block fixed top-16 left-0 bottom-0 w-3.5 z-30 transition-all ${
            isOpen ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100 group"
          }`}
          title="Hover to open navigation menu"
        >
          {/* Subtle floating hint tab on edge */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-3.5 h-14 rounded-r-lg bg-blue-500/25 group-hover:bg-blue-600 group-hover:w-5 transition-all flex items-center justify-center text-white text-[10px] shadow-xs cursor-pointer">
            <ChevronRight className="w-3 h-3 opacity-80 group-hover:opacity-100 transition" />
          </div>
        </div>
      )}

      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs md:hidden animate-in fade-in-50"
        />
      )}

      {/* MAIN SIDEBAR CONTAINER
          On Mobile: Strictly controlled by isMobileOpen via 3-line header button.
          On Desktop: Hover or pin expands/collapses sidebar. */}
      <aside
        onMouseEnter={() => {
          if (typeof window !== "undefined" && window.innerWidth >= 768) {
            setHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (typeof window !== "undefined" && window.innerWidth >= 768) {
            setHovered(false);
          }
        }}
        className={`fixed top-16 left-0 bottom-0 w-64 max-w-[80vw] bg-white/95 backdrop-blur-md border-r border-slate-200/90 z-50 flex flex-col justify-between shadow-2xl md:shadow-md transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : isOpen
            ? "md:translate-x-0 md:opacity-100 md:pointer-events-auto -translate-x-full opacity-0 pointer-events-none"
            : "-translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        {/* Top Header Section */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Workspace Menu
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Pin / Unpin Button */}
            <button
              type="button"
              onClick={togglePin}
              className={`hidden md:flex p-1.5 rounded-lg text-xs transition ${
                isPinned
                  ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
              title={isPinned ? "Unpin sidebar (auto-collapse)" : "Pin sidebar open"}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={closeMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Links List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              location.pathname === link.to ||
              (link.to !== "/dashboard" && location.pathname.startsWith(link.to));

            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMobile}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span>{link.label}</span>
                </div>

                {link.badge && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom Quick Action Card & User Info */}
        <div className="p-3 border-t border-slate-100 space-y-2.5 bg-slate-50/50">
          <Link to="/meetings/create" onClick={closeMobile} className="block">
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs h-9 font-semibold shadow-xs gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Instant Meeting</span>
            </Button>
          </Link>

          {/* User mini badge */}
          {user && (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
              <div className="w-7 h-7 rounded-lg overflow-hidden bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(user.name || "U")[0]}</span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate leading-tight">
                  {user.name}
                </span>
                <span className="text-[10px] text-slate-400 truncate leading-tight">
                  @{user.username}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
