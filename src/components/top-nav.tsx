"use client";

import clsx from "clsx";
import { Monitor, Moon, Settings, Sun, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";

export function TopNav({
	fullWidth,
	projectName,
}: {
	fullWidth?: boolean;
	projectName?: string;
}) {
	const { setTheme } = useTheme();

	return (
		<nav className="relative border-b border-surface backdrop-blur supports-[backdrop-filter]:bg-surface/80 shadow-md dark:shadow-[0_2px_5px_0_hsl(0_0%_100%_/_0.15)]">
			<div
				className={clsx("px-4", {
					"container mx-auto": !fullWidth,
				})}
			>
				<div className="flex h-14 items-center justify-between">
					<a
						href="/"
						className="flex items-center gap-2 font-semibold text-strong hover:text-fg/80 transition-colors"
					>
						<Zap className="h-5 w-5 text-warning" />
						<span>doce.dev</span>
					</a>
					{projectName && (
						<div className="absolute left-1/2 -translate-x-1/2 font-semibold text-strong">
							{projectName}
						</div>
					)}
					<div className="flex items-center gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon-sm" title="Toggle theme">
									<Sun className="h-4 w-4 [.dark_&]:hidden" />
									<Moon className="h-4 w-4 hidden [.dark_&]:block" />
									<span className="sr-only">Toggle theme</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setTheme("light")}>
									<Sun className="h-4 w-4 mr-2" />
									Light
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setTheme("dark")}>
									<Moon className="h-4 w-4 mr-2" />
									Dark
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setTheme("system")}>
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
