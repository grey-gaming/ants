import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopbarProps {
	currentThreadName?: string;
	onMenuClick?: () => void;
}

export function Topbar({ currentThreadName, onMenuClick }: TopbarProps) {
	return (
		<header className="flex h-16 items-center justify-between border-b border-border bg-surface-1 px-4 md:hidden">
			<Link to="/" className="flex items-center gap-2">
				<div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white">
					A
				</div>
			</Link>

			<h1 className="flex-1 truncate text-sm font-medium text-text-primary px-2">
				{currentThreadName || "ANTS"}
			</h1>

			<Button
				variant="ghost"
				size="icon"
				className="h-10 w-10"
				onClick={onMenuClick}
			>
				<Menu className="h-5 w-5 text-text-secondary" />
			</Button>
		</header>
	);
}
