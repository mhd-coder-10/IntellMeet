// Application header with responsive desktop navigation and mobile drawer menu
// Shown on all authenticated pages

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  LogOut,
  Video,
  Home,
  Plus,
  Search,
  User as UserIcon,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { logout as logoutApi } from "@/services/authService";

export function Header() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile menu open state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navLinks = [
    { to: "/dashboard", label: "Dashboard", icon: Home },
    { to: "/meetings", label: "Meetings", icon: Video },
    { to: "/meetings/create", label: "New Meeting", icon: Plus },
    { to: "/meetings/join", label: "Join Room", icon: Search },
    { to: "/profile", label: "Profile", icon: UserIcon },
  ];

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md transition-colors shadow-xs">
      <div className="w-full max-w-[1440px] mx-auto flex h-16 items-center justify-between px-4 sm:px-6 md:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition transform">
              <Video className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                IntellMeet
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded-md tracking-wider">
                PRO
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link key={link.to} to={link.to}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-xs font-semibold rounded-xl px-3 py-1.5 transition ${isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {link.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-3">
          {user && (
            <>
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

              {/* Mobile Hamburger Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-blue-600" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer / Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white p-4 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* User Info Card in Mobile Menu */}
          {user && (
            <Link
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold border border-white/40 shrink-0">
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
                <div className="text-left">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{user.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 border border-blue-200">
                      {user.role}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">@{user.username}</span>
                </div>
              </div>

              <div className="flex items-center text-xs text-blue-600 font-medium">
                <span>View</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          )}

          {/* Navigation Links List */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block">
              Menu Navigation
            </span>
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
                    <span>{link.label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Mobile Logout Button */}
          <div className="pt-2 border-t border-slate-200">
            <Button
              variant="ghost"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 text-sm font-medium rounded-xl py-2.5 px-3.5"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out of Account
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}