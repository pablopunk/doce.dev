import { LogoutButton } from "@/components/auth/LogoutButton";
import { BaseUrlSettings } from "@/components/settings/BaseUrlSettings";
import { DeleteAllProjectsSection } from "@/components/settings/DeleteAllProjectsSection";
import { TailscaleSettings } from "@/components/settings/TailscaleSettings";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

function AccountCard() {
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

export function GeneralSettings() {
	return (
		<div className="space-y-6">
			<BaseUrlSettings />
			<TailscaleSettings />
			<AccountCard />
			<DeleteAllProjectsSection />
		</div>
	);
}
