"use client";

import { actions } from "astro:actions";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { NavLinks } from "@/components/navbar/NavLinks";
import { ThemeToggle } from "@/components/navbar/ThemeToggle";
import { ProjectIconPicker } from "@/components/projects/ProjectIconPicker";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { Badge } from "@/components/ui/badge";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { VERSION } from "@/server/version";
import { MobileMenu } from "./MobileMenu";

interface NavbarInnerProps {
	projectName?: string | undefined;
	projectIcon?: string | undefined;
	projectId?: string | undefined;
}

function NavbarInner({
	projectName,
	projectIcon,
	projectId,
}: NavbarInnerProps) {
	const { handleClick, state } = useAppUpdate();
	const [editing, setEditing] = useState(false);
	const [displayName, setDisplayName] = useState(projectName ?? "");
	const [displayIcon, setDisplayIcon] = useState(projectIcon ?? "✨");
	const [editName, setEditName] = useState(projectName ?? "");
	const [editIcon, setEditIcon] = useState(projectIcon ?? "✨");
	const inputRef = useRef<HTMLInputElement>(null);

	const needsUpdate = state === "update-available";
	const isUpdating = state === "updating";
	const needsRestart = state === "restart-ready";

	useEffect(() => {
		setDisplayName(projectName ?? "");
		setDisplayIcon(projectIcon ?? "✨");
		setEditName(projectName ?? "");
		setEditIcon(projectIcon ?? "✨");
	}, [projectName, projectIcon]);

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	const save = async (nameOverride?: string, iconOverride?: string) => {
		if (!projectId) return;
		const nameToSave = nameOverride ?? editName.trim();
		const iconToSave = iconOverride ?? editIcon;
		if (!nameToSave) {
			setEditing(false);
			return;
		}
		if (nameToSave === displayName && iconToSave === displayIcon) {
			setEditing(false);
			return;
		}
		const { error } = await actions.projects.updateIdentity({
			projectId,
			name: nameToSave,
			icon: iconToSave,
		});
		if (error) {
			toast.error(error.message ?? "Failed to update project");
			setEditName(displayName);
			setEditIcon(displayIcon);
		} else {
			toast.success("Project updated");
			setDisplayName(nameToSave);
			setDisplayIcon(iconToSave);
			window.dispatchEvent(new CustomEvent("project-identity-updated"));
		}
		setEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			void save();
		} else if (e.key === "Escape") {
			setEditing(false);
			setEditName(projectName ?? "");
			setEditIcon(projectIcon ?? "✨");
		}
	};

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
				{projectName && projectId && (
					<div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
						<ProjectIconPicker
							value={editIcon}
							onChange={(icon) => {
								setEditIcon(icon);
								void save(editName, icon);
							}}
						/>
						<input
							ref={inputRef}
							type="text"
							value={editing ? editName : displayName}
							readOnly={!editing}
							onFocus={() => setEditing(true)}
							onChange={(e) => editing && setEditName(e.target.value)}
							onKeyDown={handleKeyDown}
							onBlur={() => void save()}
							className={`text-sm font-medium bg-transparent outline-none transition-all truncate max-w-[180px] sm:max-w-[260px] md:max-w-[400px] h-7 leading-7 ${
								editing ? "cursor-text" : "cursor-pointer hover:opacity-80"
							}`}
							maxLength={64}
						/>
					</div>
				)}
				{projectName && !projectId && (
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
	projectId?: string | undefined;
}

export function Navbar({ projectName, projectIcon, projectId }: NavbarProps) {
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
			<NavbarInner
				projectName={projectName}
				projectIcon={projectIcon}
				projectId={projectId}
			/>
		</ThemeProvider>
	);
}
