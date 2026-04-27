"use client";

import {
	Download,
	FolderOpen,
	LayoutDashboard,
	Moon,
	Rocket,
	Settings,
	Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@/components/ui/command";

interface CommandProject {
	id: string;
	name: string;
}

interface CommandPaletteProps {
	projects?: CommandProject[];
	currentProjectId?: string;
	onExport?: () => void;
	onDeploy?: () => void;
}

function navigateTo(href: string) {
	if (typeof window !== "undefined") {
		window.location.href = href;
	}
}

export function CommandPalette({
	projects = [],
	currentProjectId,
	onExport,
	onDeploy,
}: CommandPaletteProps) {
	const [open, setOpen] = useState(false);
	const { theme, toggleTheme } = useTheme();

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, []);

	const run = (fn: () => void) => {
		setOpen(false);
		fn();
	};

	return (
		<CommandDialog open={open} onOpenChange={setOpen}>
			<Command>
				<CommandInput placeholder="Type a command or search..." />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>

					<CommandGroup heading="Navigation">
						<CommandItem onSelect={() => run(() => navigateTo("/"))}>
							<LayoutDashboard className="mr-2 h-4 w-4" />
							<span>Go to Dashboard</span>
						</CommandItem>
						<CommandItem onSelect={() => run(() => navigateTo("/settings"))}>
							<Settings className="mr-2 h-4 w-4" />
							<span>Go to Settings</span>
						</CommandItem>
					</CommandGroup>

					{projects.length > 0 && (
						<CommandGroup heading="Projects">
							{projects.map((project) => (
								<CommandItem
									key={project.id}
									onSelect={() =>
										run(() => navigateTo(`/projects/${project.id}`))
									}
								>
									<FolderOpen className="mr-2 h-4 w-4" />
									<span>{project.name}</span>
									{project.id === currentProjectId && (
										<CommandShortcut>current</CommandShortcut>
									)}
								</CommandItem>
							))}
						</CommandGroup>
					)}

					{currentProjectId && (onExport || onDeploy) && (
						<CommandGroup heading="Project Actions">
							{onExport && (
								<CommandItem onSelect={() => run(onExport)}>
									<Download className="mr-2 h-4 w-4" />
									<span>Export Project</span>
								</CommandItem>
							)}
							{onDeploy && (
								<CommandItem onSelect={() => run(onDeploy)}>
									<Rocket className="mr-2 h-4 w-4" />
									<span>Deploy Project</span>
								</CommandItem>
							)}
						</CommandGroup>
					)}

					<CommandGroup heading="Preferences">
						<CommandItem onSelect={() => run(toggleTheme)}>
							{theme === "dark" ? (
								<Sun className="mr-2 h-4 w-4" />
							) : (
								<Moon className="mr-2 h-4 w-4" />
							)}
							<span>Toggle Theme</span>
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
