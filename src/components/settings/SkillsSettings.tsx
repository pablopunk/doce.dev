import { Sparkles } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function SkillsSettings() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Skills</CardTitle>
				<CardDescription>
					Manage agent skills installed from skills.sh across all projects.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
					<Sparkles className="size-10 stroke-1" />
					<p className="text-sm">No skills installed yet.</p>
					<p className="max-w-sm text-xs">
						Skills teach your AI agent specialized knowledge like framework best
						practices, design systems, and coding patterns.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
