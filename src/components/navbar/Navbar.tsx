"use client";

import { useEffect, useState } from "react";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { Badge } from "@/components/ui/badge";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { VERSION } from "@/server/version";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

function NavbarInner() {
	const { handleClick, state } = useAppUpdate();

	const needsUpdate = state === "update-available";
	const isUpdating = state === "updating";
	const needsRestart = state === "restart-ready";

	return (
		<header className="border-b border-border bg-background sticky top-0 z-40">
			<div className="flex h-14 items-center justify-between px-4 md:px-6">
				{/* Logo/Brand */}
				<a
					href="/"
					className="flex items-center font-semibold text-sm tracking-tight hover:opacity-80 transition-opacity gap-2"
				>
					<img src="/icon-1080.svg" alt="doce.dev" className="w-5 h-5" />
					<span>
						doce<span className="text-muted-foreground">.dev</span>
					</span>
					<Badge variant="secondary" className="text-xs">
						alpha
					</Badge>
					<Badge
						variant="outline"
						className={`text-xs text-muted-foreground cursor-pointer hover:bg-accent ${needsUpdate ? "border-orange-500 text-orange-500" : ""} ${isUpdating ? "opacity-70" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							handleClick();
						}}
					>
						<span>{VERSION}</span>
						{needsUpdate && (
							<span className="ml-1 w-2 h-2 rounded-full bg-orange-500" />
						)}
						{isUpdating && <span className="ml-1">...</span>}
						{needsRestart && <span className="ml-1">↻</span>}
					</Badge>
				</a>

				{/* Desktop Navigation */}
				<NavLinks />

				{/* Right side - Desktop theme toggle + Mobile menu */}
				<div className="flex items-center gap-2">
					<div className="hidden md:block">
						<ThemeToggle />
					</div>
					<MobileMenu />
				</div>
			</div>
		</header>
	);
}

export function Navbar() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// On server render, return a simple navbar stub
	if (!mounted) {
		return (
			<header className="border-b border-border bg-background sticky top-0 z-40">
				<div className="flex h-14 items-center justify-between px-4 md:px-6">
					<a
						href="/"
						className="flex items-center font-semibold text-sm tracking-tight gap-2"
					>
						<img src="/icon-1080.svg" alt="doce.dev" className="w-5 h-5" />
						<span>
							doce<span className="text-muted-foreground">.dev</span>
						</span>
						<div className="inline-flex items-center rounded-full border border-input bg-background px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
							alpha
						</div>
						<div className="inline-flex items-center rounded-full border border-input bg-background px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
							{VERSION}
						</div>
					</a>
					<div className="hidden md:flex items-center gap-1" />
					<div className="flex items-center gap-2" />
				</div>
			</header>
		);
	}

	// On client, render the full interactive navbar
	return (
		<ThemeProvider>
			<NavbarInner />
		</ThemeProvider>
	);
}
