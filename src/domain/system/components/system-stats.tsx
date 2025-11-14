"use client";

import { Eye, Layers, Rocket, Server } from "lucide-react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function SystemStats() {
	const { data: stats } = useSWR("/api/stats", fetcher, {
		refreshInterval: 10000,
	});

	if (!stats) {
		return null;
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
			<Card className="p-6">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-strong/10 rounded-lg">
						<Layers className="h-6 w-6 text-strong" />
					</div>
					<div>
						<p className="text-sm text-muted">Total Projects</p>
						<p className="text-2xl font-bold">{stats.totalProjects}</p>
					</div>
				</div>
			</Card>

			<Card className="p-6">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-strong/10 rounded-lg">
						<Rocket className="h-6 w-6 text-strong" />
					</div>
					<div>
						<p className="text-sm text-muted">Deployments</p>
						<p className="text-2xl font-bold">{stats.totalDeployments}</p>
					</div>
				</div>
			</Card>

			<Card className="p-6">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-strong/10 rounded-lg">
						<Eye className="h-6 w-6 text-strong" />
					</div>
					<div>
						<p className="text-sm text-muted">Active Previews</p>
						<p className="text-2xl font-bold">{stats.activePreviews}</p>
					</div>
				</div>
			</Card>

			<Card className="p-6">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-warning/10 rounded-lg">
						<Server className="h-6 w-6 text-warning" />
					</div>
					<div>
						<p className="text-sm text-muted">Containers</p>
						<p className="text-2xl font-bold">{stats.totalContainers}</p>
					</div>
				</div>
			</Card>
		</div>
	);
}
