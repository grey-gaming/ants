import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";

type MessageRole = "user" | "agent";
type AgentTier = "t1" | "t2" | "t3";

interface ChatBubbleProps {
	content: string;
	role: MessageRole;
	agentName?: string;
	agentTier?: AgentTier;
	isStreaming?: boolean;
	timestamp?: string;
}

export function ChatBubble({
	content,
	role,
	agentName,
	agentTier,
	isStreaming,
	timestamp,
}: ChatBubbleProps) {
	const isUser = role === "user";

	return (
		<div
			className={cn(
				"flex gap-3 mb-4",
				isUser ? "flex-row-reverse" : "flex-row",
			)}
		>
			{/* Avatar */}
			{!isUser && agentName && agentTier && (
				<div className="flex-shrink-0">
					<AgentAvatar name={agentName} tier={agentTier} />
				</div>
			)}

			{/* Message bubble */}
			<div
				className={cn(
					"max-w-[80%] md:max-w-[70%] lg:max-w-[60%]",
					isUser ? "items-end" : "items-start",
				)}
			>
				<div
					className={cn(
						"rounded-lg px-4 py-3",
						isUser
							? "bg-accent text-white rounded-tr-sm"
							: "bg-surface-1 text-text-primary rounded-tl-sm",
					)}
				>
					<div className="whitespace-pre-wrap text-body">
						{content}
						{isStreaming && (
							<span className="inline-block h-4 w-0.5 ml-0.5 bg-text-primary animate-blink" />
						)}
					</div>
				</div>
				{timestamp && (
					<span className="mt-1 block text-xs text-text-tertiary">
						{timestamp}
					</span>
				)}
			</div>
		</div>
	);
}
