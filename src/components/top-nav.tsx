"use client";

import { Monitor, Moon, Settings, Sun, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";

export function TopNav() {
	const { theme, setTheme } = useTheme();

	return (
		<nav className="relative border-b border-border bg-bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-bg-surface/80 shadow-elevation">
			<div className="absolute inset-x-0 top-0 h-px bg-highlight" />
			<div className="container mx-auto px-4">
				<div className="flex h-14 items-center justify-between">
					<a
						href="/"
						className="flex items-center gap-2 font-semibold text-foreground hover:text-foreground/80 transition-colors"
					>
						<Zap className="h-5 w-5 text-yellow-500" />
						<span>doce.dev</span>
					</a>
					<div className="flex items-center gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon-sm" title="Toggle theme">
									<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
									<Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
									<span className="sr-only">Toggle theme</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() => setTheme("light")}
									className="cursor-pointer"
								>
									<Sun className="h-4 w-4 mr-2" />
									Light
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => setTheme("dark")}
									className="cursor-pointer"
								>
									<Moon className="h-4 w-4 mr-2" />
									Dark
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => setTheme("system")}
									className="cursor-pointer"
								>
									<Monitor className="h-4 w-4 mr-2" />
									System
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<a href="/settings">
							<Button variant="ghost" size="sm">
								<Settings className="h-4 w-4 mr-2" />
								Settings
							</Button>
						</a>
					</div>
				</div>
			</div>
		</nav>
	);
}
