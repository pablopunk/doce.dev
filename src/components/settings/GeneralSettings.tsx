import { LogoutButton } from "@/components/auth/LogoutButton";
import { BaseUrlSettings } from "@/components/settings/BaseUrlSettings";
import { DeleteAllProjectsSection } from "@/components/settings/DeleteAllProjectsSection";
import { StatusSettings } from "@/components/settings/StatusSettings";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { QueueJob } from "@/server/db/schema";
import type { SettingsStatusDiagnostics } from "@/server/settings/status";

interface GeneralSettingsProps {
	projectCount: number;
	statusData: {
		jobs: QueueJob[];
		paused: boolean;
		concurrency: number;
		pagination: {
			page: number;
			pageSize: number;
			totalCount: number;
			totalPages: number;
		};
		filters: {
			state?: string;
			type?: string;
			projectId?: string;
			q?: string;
		};
		diagnostics: SettingsStatusDiagnostics;
	};
}

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

export function GeneralSettings({
	projectCount,
	statusData,
}: GeneralSettingsProps) {
	return (
		<div className="space-y-6">
			<BaseUrlSettings />
			<AccountCard />
			<StatusSettings
				initialJobs={statusData.jobs}
				initialPaused={statusData.paused}
				initialConcurrency={statusData.concurrency}
				initialPagination={statusData.pagination}
				filters={statusData.filters}
				diagnostics={statusData.diagnostics}
			/>
			<DeleteAllProjectsSection projectCount={projectCount} />
		</div>
	);
}
