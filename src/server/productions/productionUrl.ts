import type { Project } from "@/server/db/schema";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProjectRuntimeUrls } from "@/server/projects/projectUrls";

export async function getCanonicalProductionUrl(
	project: Pick<Project, "id" | "slug" | "productionPort">,
): Promise<string> {
	const urls = await getProjectRuntimeUrls(project);
	return (
		urls.production.preferred ?? `http://localhost:${project.productionPort}`
	);
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
