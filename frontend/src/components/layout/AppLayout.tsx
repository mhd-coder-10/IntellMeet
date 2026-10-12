// App Layout Component for Authenticated Pages
// Wraps authenticated pages with the Clean Header, Hover Sidebar, and smooth responsive content area

import { Outlet } from "react-router-dom";
import { Header } from "@/components/common/Header";
import { Sidebar } from "@/components/common/Sidebar";
import { useSidebarStore } from "@/store/sidebarStore";

export function AppLayout() {
  const { isOpen } = useSidebarStore();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-100 flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Sticky Top Header */}
      <Header />

      {/* Main Body Area with Hover-Expandable Sidebar & Dynamic Content Padding */}
      <div className="flex-1 flex relative w-full max-w-full overflow-x-hidden min-w-0">
        <Sidebar />

        {/* Content Viewport Container
            Expands to full screen width when sidebar is closed (md:pl-0)
            Smoothly adjusts and shrinks width when sidebar opens (md:pl-64) */}
        <div
          className={`flex-1 w-full max-w-full min-w-0 overflow-x-hidden transition-all duration-300 ease-in-out ${
            isOpen ? "md:pl-64" : "md:pl-0"
          }`}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
