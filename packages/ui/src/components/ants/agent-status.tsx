import { cn } from "@/lib/utils";

type AgentStatus =
	| "idle"
	| "running"
	| "thinking"
	| "tool_use"
	| "complete"
	| "error"
	| "cancelled";

interface AgentStatusIndicatorProps {
	status: AgentStatus;
	label?: string;
	size?: "sm" | "md" | "lg";
}

const statusConfig: Record<AgentStatus, { color: string; pulse?: boolean }> = {
	idle: { color: "bg-text-tertiary" },
	running: { color: "bg-warning", pulse: true },
	thinking: { color: "bg-info", pulse: true },
	tool_use: { color: "bg-success", pulse: true },
	complete: { color: "bg-success" },
	error: { color: "bg-error" },
	cancelled: { color: "bg-warning" },
};

const sizes = {
	sm: "h-2 w-2",
	md: "h-2.5 w-2.5",
	lg: "h-3 w-3",
};

export function AgentStatusIndicator({
	status,
	label,
	size = "md",
}: AgentStatusIndicatorProps) {
	const config = statusConfig[status];

	return (
		<div className="flex items-center gap-2">
			<span
				className={cn(
					"rounded-full",
					sizes[size],
					config.color,
					config.pulse && "animate-pulse",
				)}
			/>
			{label && (
				<span className="text-xs text-text-secondary capitalize">{label}</span>
			)}
		</div>
	);
}
