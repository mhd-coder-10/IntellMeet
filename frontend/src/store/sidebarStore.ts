// Sidebar state management store using Zustand
// Controls hover expansion, pinning, and mobile drawer visibility

import { create } from "zustand";

let leaveTimeout: ReturnType<typeof setTimeout> | null = null;

interface SidebarState {
  isOpen: boolean;
  isHovered: boolean;
  isPinned: boolean;
  isMobileOpen: boolean;
  setHovered: (hovered: boolean, immediate?: boolean) => void;
  togglePin: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  isOpen: false,
  isHovered: false,
  isPinned: false,
  isMobileOpen: false,

  setHovered: (hovered: boolean, immediate = false) => {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout);
      leaveTimeout = null;
    }

    const { isPinned } = get();

    if (hovered) {
      set({
        isHovered: true,
        isOpen: true,
      });
    } else {
      if (immediate) {
        set({
          isHovered: false,
          isOpen: isPinned,
        });
      } else {
        leaveTimeout = setTimeout(() => {
          const currentPinned = get().isPinned;
          set({
            isHovered: false,
            isOpen: currentPinned,
          });
          leaveTimeout = null;
        }, 180);
      }
    }
  },

  togglePin: () => {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout);
      leaveTimeout = null;
    }
    const { isPinned, isHovered } = get();
    const newPinned = !isPinned;
    set({
      isPinned: newPinned,
      isOpen: newPinned || isHovered,
    });
  },

  toggleMobile: () => {
    set((state) => ({ isMobileOpen: !state.isMobileOpen }));
  },

  closeMobile: () => {
    set({ isMobileOpen: false });
  },
}));
