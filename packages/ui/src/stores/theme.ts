import { create } from "zustand";

type Theme = "dark" | "light" | "system";

interface ThemeState {
	theme: Theme;
	resolvedTheme: "dark" | "light";
	setTheme: (theme: Theme) => void;
}

function getSystemTheme(): "dark" | "light" {
	if (typeof window === "undefined") return "dark";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function resolveTheme(theme: Theme): "dark" | "light" {
	return theme === "system" ? getSystemTheme() : theme;
}

export const useThemeStore = create<ThemeState>((set) => ({
	theme: (localStorage.getItem("ants_theme") as Theme) || "dark",
	resolvedTheme: "dark",
	setTheme: (theme: Theme) => {
		localStorage.setItem("ants_theme", theme);
		const resolved = resolveTheme(theme);
		document.documentElement.setAttribute("data-theme", resolved);
		set({ theme, resolvedTheme: resolved });
	},
}));

// Initialize theme on load
if (typeof window !== "undefined") {
	const saved = (localStorage.getItem("ants_theme") as Theme) || "dark";
	const resolved = resolveTheme(saved);
	document.documentElement.setAttribute("data-theme", resolved);
}
