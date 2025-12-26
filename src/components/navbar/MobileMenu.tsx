"use client";

import { Clock, LayoutGrid, Menu, Settings } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./ThemeToggle";

export const MobileMenu = () => {
	return (
		<div className="md:hidden flex items-center gap-2">
			<ThemeToggle />
			<DropdownMenu>
				<DropdownMenuTrigger
					aria-label="Open menu"
					className="p-2 rounded-lg hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 dark:focus-visible:ring-gray-600"
				>
					<Menu className="h-5 w-5" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => (window.location.href = "/")}>
						<LayoutGrid className="w-4 h-4" />
						Projects
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => (window.location.href = "/queue")}>
						<Clock className="w-4 h-4" />
						Queue
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => (window.location.href = "/settings")}
					>
						<Settings className="w-4 h-4" />
						Settings
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
