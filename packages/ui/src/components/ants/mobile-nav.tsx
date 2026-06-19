import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
	label: string;
	to: string;
	icon: React.ElementType;
}

const navItems: NavItem[] = [
	{ label: "Home", to: "/", icon: LayoutDashboard },
	{ label: "Threads", to: "/threads", icon: MessageSquare },
	{ label: "Settings", to: "/settings", icon: Settings },
];

export function MobileNav() {
	const { pathname } = useLocation();

	return (
		<nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-center justify-around border-t border-border bg-surface-1 md:hidden">
			{navItems.map(({ label, to, icon: Icon }) => {
				const isActive = pathname === to || pathname.startsWith(`${to}/`);
				return (
					<Link
						key={to}
						to={to}
						className={cn(
							"flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs",
							isActive
								? "text-accent"
								: "text-text-tertiary hover:text-text-secondary",
						)}
					>
						<Icon className="h-5 w-5" />
						<span>{label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
