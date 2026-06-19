import { create } from "zustand";

interface SidebarState {
	isOpen: boolean;
	isCollapsed: boolean;
	openSection: string | null;
	toggle: () => void;
	collapse: () => void;
	expand: () => void;
	setSection: (section: string | null) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
	isOpen: true,
	isCollapsed: false,
	openSection: null,
	toggle: () => set((state) => ({ isOpen: !state.isOpen })),
	collapse: () => set({ isCollapsed: true }),
	expand: () => set({ isCollapsed: false }),
	setSection: (section) => set({ openSection: section }),
}));
