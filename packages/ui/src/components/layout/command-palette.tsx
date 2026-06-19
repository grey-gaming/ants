import {
	Bot,
	FileText,
	Home,
	MessageSquare,
	PanelLeft,
	Search,
	Settings,
} from "lucide-react";
import * as React from "react";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { useAgents, useThreads } from "@/hooks/api";

export function CommandPalette() {
	const [open, setOpen] = React.useState(false);
	const { data: threads } = useThreads();
	const { data: agents } = useAgents();

	React.useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((o) => !o);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	return (
		<CommandDialog open={open} onOpenChange={setOpen}>
			<Command className="rounded-lg border border-border bg-surface-2">
				<CommandInput placeholder="Search threads, agents, settings..." />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>

					<CommandGroup heading="Navigate">
						<CommandItem onSelect={() => setOpen(false)}>
							<Home className="h-4 w-4" />
							<span>Dashboard</span>
						</CommandItem>
						<CommandItem onSelect={() => setOpen(false)}>
							<MessageSquare className="h-4 w-4" />
							<span>Threads</span>
						</CommandItem>
						<CommandItem onSelect={() => setOpen(false)}>
							<Bot className="h-4 w-4" />
							<span>Agents</span>
						</CommandItem>
						<CommandItem onSelect={() => setOpen(false)}>
							<Settings className="h-4 w-4" />
							<span>Settings</span>
						</CommandItem>
					</CommandGroup>

					<CommandSeparator />

					<CommandGroup heading="Recent Threads">
						{threads?.map((thread) => (
							<CommandItem key={thread.id} onSelect={() => setOpen(false)}>
								<FileText className="h-4 w-4" />
								<span>{thread.title}</span>
							</CommandItem>
						))}
					</CommandGroup>

					<CommandSeparator />

					<CommandGroup heading="Agents">
						{agents?.map((agent) => (
							<CommandItem key={agent.id} onSelect={() => setOpen(false)}>
								<Bot className="h-4 w-4" />
								<span>
									{agent.name} ({agent.tier.toUpperCase()})
								</span>
							</CommandItem>
						))}
					</CommandGroup>

					<CommandSeparator />

					<CommandGroup heading="Actions">
						<CommandItem onSelect={() => setOpen(false)}>
							<PanelLeft className="h-4 w-4" />
							<span>Toggle Sidebar</span>
						</CommandItem>
						<CommandItem onSelect={() => setOpen(false)}>
							<Search className="h-4 w-4" />
							<span>New Thread</span>
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
