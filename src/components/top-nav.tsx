"use client";

import { Button } from "@/components/ui/button";
import { Zap, Settings } from "lucide-react";

export function TopNav() {
	return (
		<nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container mx-auto px-4">
				<div className="flex h-14 items-center justify-between">
					<a
						href="/"
						className="flex items-center gap-2 font-semibold text-foreground hover:text-foreground/80 transition-colors"
					>
						<Zap className="h-5 w-5 text-yellow-500" />
						<span>doce.dev</span>
					</a>
					<a href="/settings">
						<Button variant="ghost" size="sm">
							<Settings className="h-4 w-4 mr-2" />
							Settings
						</Button>
					</a>
				</div>
			</div>
		</nav>
	);
}
