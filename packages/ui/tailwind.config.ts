/** @type {import('tailwindcss').Config} */
export default {
	// dark mode handled via data-theme attribute in globals.css
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			colors: {
				surface: {
					"0": "var(--surface-0)",
					"1": "var(--surface-1)",
					"2": "var(--surface-2)",
					"3": "var(--surface-3)",
				},
				text: {
					primary: "var(--text-primary)",
					secondary: "var(--text-secondary)",
					tertiary: "var(--text-tertiary)",
				},
				accent: {
					DEFAULT: "var(--accent)",
					hover: "var(--accent-hover)",
					muted: "var(--accent-muted)",
				},
				success: "var(--success)",
				warning: "var(--warning)",
				error: "var(--error)",
				info: "var(--info)",
				border: "var(--border)",
				agent: {
					t1: "#3B82F6",
					t2: "#F59E0B",
					t3: "#10B981",
				},
			},
			spacing: {
				"1": "4px",
				"2": "8px",
				"3": "12px",
				"4": "16px",
				"5": "20px",
				"6": "24px",
				"8": "32px",
				"10": "40px",
				"12": "48px",
				"16": "64px",
			},
			borderRadius: {
				lg: "var(--radius-lg)",
				md: "var(--radius-md)",
				sm: "var(--radius-sm)",
			},
			fontFamily: {
				sans: [
					"-apple-system",
					"BlinkMacSystemFont",
					"Inter",
					"Segoe UI",
					"system-ui",
					"sans-serif",
				],
				mono: ["JetBrains Mono", "ui-monospace", "monospace"],
			},
			fontSize: {
				"display-xl": [
					"48px",
					{
						lineHeight: "1.1",
						fontWeight: "700",
					},
				],
				"display-md": [
					"36px",
					{
						lineHeight: "1.1",
						fontWeight: "700",
					},
				],
				"heading-lg": [
					"24px",
					{
						lineHeight: "1.2",
						fontWeight: "600",
					},
				],
				"heading-md": [
					"20px",
					{
						lineHeight: "1.3",
						fontWeight: "600",
					},
				],
				"heading-sm": [
					"16px",
					{
						lineHeight: "1.4",
						fontWeight: "600",
					},
				],
				"body-lg": [
					"16px",
					{
						lineHeight: "1.5",
						fontWeight: "400",
					},
				],
				body: [
					"14px",
					{
						lineHeight: "1.5",
						fontWeight: "400",
					},
				],
				"body-sm": [
					"13px",
					{
						lineHeight: "1.4",
						fontWeight: "400",
					},
				],
				"body-xs": [
					"12px",
					{
						lineHeight: "1.3",
						fontWeight: "400",
					},
				],
				code: [
					"13px",
					{
						lineHeight: "1.5",
						fontWeight: "400",
					},
				],
			},
			keyframes: {
				"accordion-down": {
					from: {
						height: "0",
					},
					to: {
						height: "var(--radix-accordion-content-height)",
					},
				},
				"accordion-up": {
					from: {
						height: "var(--radix-accordion-content-height)",
					},
					to: {
						height: "0",
					},
				},
				blink: {
					"0%, 100%": {
						opacity: "1",
					},
					"50%": {
						opacity: "0",
					},
				},
				pulse: {
					"0%, 100%": {
						opacity: "1",
					},
					"50%": {
						opacity: "0.5",
					},
				},
				shimmer: {
					"0%": {
						backgroundPosition: "-200% 0",
					},
					"100%": {
						backgroundPosition: "200% 0",
					},
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				blink: "blink 1s step-end infinite",
				pulse: "pulse 2s ease-in-out infinite",
				shimmer: "shimmer 2s linear infinite",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
