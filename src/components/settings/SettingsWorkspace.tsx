import { Globe, LogOut, ShieldAlert, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { BaseUrlSettings } from "@/components/settings/BaseUrlSettings";
import { DeleteAllProjectsSection } from "@/components/settings/DeleteAllProjectsSection";
import { ProvidersSettings } from "@/components/settings/ProvidersSettings";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SettingsSectionId = "providers" | "base-url" | "account" | "danger";

interface SettingsWorkspaceProps {
	projectCount: number;
}

const sections = [
	{
		id: "providers",
		label: "Providers",
		description: "Models, API keys, and subscriptions",
		icon: WandSparkles,
	},
	{
		id: "base-url",
		label: "Base URL",
		description: "Generated links and host defaults",
		icon: Globe,
	},
	{
		id: "account",
		label: "Account",
		description: "Session and account actions",
		icon: LogOut,
	},
	{
		id: "danger",
		label: "Danger Zone",
		description: "Destructive instance-wide actions",
		icon: ShieldAlert,
	},
] as const satisfies Array<{
	id: SettingsSectionId;
	label: string;
	description: string;
	icon: typeof WandSparkles;
}>;

function AccountSettingsCard() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Account</CardTitle>
				<CardDescription>Manage your account settings.</CardDescription>
			</CardHeader>
			<CardContent>
				<LogoutButton />
			</CardContent>
		</Card>
	);
}

export function SettingsWorkspace({ projectCount }: SettingsWorkspaceProps) {
	const [activeSection, setActiveSection] =
		useState<SettingsSectionId>("providers");

	const activeContent = useMemo(() => {
		switch (activeSection) {
			case "providers":
				return <ProvidersSettings />;
			case "base-url":
				return <BaseUrlSettings />;
			case "account":
				return <AccountSettingsCard />;
			case "danger":
				return <DeleteAllProjectsSection projectCount={projectCount} />;
		}
	}, [activeSection, projectCount]);

	return (
		<div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
			<aside className="lg:sticky lg:top-6">
				<div className="rounded-2xl border border-border/60 bg-card/80 p-2 backdrop-blur-sm">
					<nav className="grid gap-1">
						{sections.map((section) => {
							const Icon = section.icon;
							const isActive = activeSection === section.id;

							return (
								<button
									key={section.id}
									type="button"
									onClick={() => setActiveSection(section.id)}
									className={cn(
										"flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
										isActive
											? "bg-foreground text-background shadow-sm"
											: "text-foreground hover:bg-muted",
									)}
								>
									<Icon className="mt-0.5 size-4 shrink-0" />
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											{section.label}
										</span>
										<span
											className={cn(
												"mt-0.5 block text-xs",
												isActive
													? "text-background/80"
													: "text-muted-foreground",
											)}
										>
											{section.description}
										</span>
									</span>
								</button>
							);
						})}
					</nav>
				</div>
			</aside>

			<div className="min-w-0">{activeContent}</div>
		</div>
	);
}
