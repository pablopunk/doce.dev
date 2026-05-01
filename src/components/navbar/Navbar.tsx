"use client";

import { useEffect, useState } from "react";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { Badge } from "@/components/ui/badge";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { VERSION } from "@/server/version";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

interface NavbarInnerProps {
	projectName?: string | undefined;
	projectIcon?: string | undefined;
}

function NavbarInner({ projectName, projectIcon }: NavbarInnerProps) {
	const { handleClick, state } = useAppUpdate();

	const needsUpdate = state === "update-available";
	const isUpdating = state === "updating";
	const needsRestart = state === "restart-ready";

	return (
		<header className="border-b border-border bg-background sticky top-0 z-40">
			<div className="flex h-14 items-center justify-between px-4 md:px-6 relative">
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

				{/* Center - Project name + icon */}
				{projectName && (
					<div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
						{projectIcon && (
							<span className="inline-flex size-7 items-center justify-center rounded-lg bg-muted text-sm">
								{projectIcon}
							</span>
						)}
						<span className="text-sm font-medium truncate max-w-[180px] sm:max-w-[260px] md:max-w-[400px]">
							{projectName}
						</span>
					</div>
				)}

				{/* Right side - Desktop navigation, theme toggle + Mobile menu */}
				<div className="flex items-center gap-2">
					<NavLinks />
					<div className="hidden md:block">
						<ThemeToggle />
					</div>
					<MobileMenu />
				</div>
			</div>
		</header>
	);
}

interface NavbarProps {
	projectName?: string | undefined;
	projectIcon?: string | undefined;
}

export function Navbar({ projectName, projectIcon }: NavbarProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// On server render, return a simple navbar stub without dynamic badges
	if (!mounted) {
		return (
			<header className="border-b border-border bg-background sticky top-0 z-40">
				<div className="flex h-14 items-center justify-between px-4 md:px-6 relative">
					<a
						href="/"
						className="flex items-center font-semibold text-sm tracking-tight gap-2"
					>
						<img src="/icon-1080.svg" alt="doce.dev" className="w-5 h-5" />
						<span>
							doce<span className="text-muted-foreground">.dev</span>
						</span>
					</a>
					{projectName && (
						<div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
							{projectIcon && (
								<span className="inline-flex size-7 items-center justify-center rounded-lg bg-muted text-sm">
									{projectIcon}
								</span>
							)}
							<span className="text-sm font-medium truncate max-w-[180px] sm:max-w-[260px] md:max-w-[400px]">
								{projectName}
							</span>
						</div>
					)}
					<div className="hidden md:flex items-center gap-1" />
					<div className="flex items-center gap-2" />
				</div>
			</header>
		);
	}

	// On client, render the full interactive navbar
	return (
		<ThemeProvider>
			<NavbarInner projectName={projectName} projectIcon={projectIcon} />
		</ThemeProvider>
	);
}
