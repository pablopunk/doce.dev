"use client";

import { LayoutGrid, Menu, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const cycleOrder = ["system", "light", "dark"] as const;

export const MobileMenu = () => {
	const { theme, preference, setPreference } = useTheme();
	const nextTheme = () => {
		const currentIndex = cycleOrder.indexOf(preference);
		setPreference(
			cycleOrder[(currentIndex + 1) % cycleOrder.length] ?? "system",
		);
	};
	const ThemeIcon =
		preference === "system" ? Monitor : theme === "light" ? Sun : Moon;

	return (
		<div className="md:hidden flex items-center gap-2">
			<DropdownMenu>
				<DropdownMenuTrigger
					aria-label="Open menu"
					className="p-2 rounded-lg hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
				>
					<Menu className="h-5 w-5" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={nextTheme}>
						<ThemeIcon className="w-4 h-4" />
						Theme: {preference}
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => {
							window.location.href = "/";
						}}
					>
						<LayoutGrid className="w-4 h-4" />
						Projects
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => {
							window.location.href = "/settings";
						}}
					>
						<Settings className="w-4 h-4" />
						Settings
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
