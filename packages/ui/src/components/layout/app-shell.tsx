import { type ReactNode, useState } from "react";
import { MobileNav } from "@/components/ants/mobile-nav";
import { MobileSidebar } from "./mobile-sidebar";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
	children: ReactNode;
	currentThreadName?: string;
}

export function AppShell({ children, currentThreadName }: AppShellProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<div className="flex h-screen w-full overflow-hidden bg-surface-0">
			{/* Sidebar — hidden on mobile */}
			<aside className="hidden md:block">
				<Sidebar />
			</aside>

			{/* Main content area */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Top bar — mobile only */}
				<Topbar
					currentThreadName={currentThreadName}
					onMenuClick={() => setMobileMenuOpen(true)}
				/>

				{/* Page content */}
				<main className="flex-1 overflow-auto p-3 md:p-4 lg:p-6">
					{children}
				</main>

				{/* Bottom nav — mobile only */}
				<nav className="md:hidden">
					<MobileNav />
				</nav>
			</div>

			{/* Mobile sidebar overlay */}
			<MobileSidebar
				open={mobileMenuOpen}
				onClose={() => setMobileMenuOpen(false)}
			/>
		</div>
	);
}
