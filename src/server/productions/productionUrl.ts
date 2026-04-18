import type { Project } from "@/server/db/schema";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getTailscaleProjectUrl } from "@/server/tailscale/urls";

export async function getCanonicalProductionUrl(
	project: Pick<Project, "id" | "slug" | "productionPort">,
): Promise<string> {
	const tailscaleUrl = await getTailscaleProjectUrl(
		project.slug,
		"production",
		project.id,
	);

	return tailscaleUrl ?? `http://localhost:${project.productionPort}`;
}

export async function repairStaleProductionUrl(
	project: Pick<
		Project,
		"id" | "slug" | "productionPort" | "productionStatus" | "productionUrl"
	>,
): Promise<string | null> {
	if (project.productionStatus !== "running") {
		return project.productionUrl;
	}

	const canonicalUrl = await getCanonicalProductionUrl(project);
	if (project.productionUrl === canonicalUrl) {
		return canonicalUrl;
	}

	await updateProductionStatus(project.id, project.productionStatus, {
		productionUrl: canonicalUrl,
	});

	return canonicalUrl;
}
