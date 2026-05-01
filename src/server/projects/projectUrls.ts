import type { Project } from "@/server/db/schema";
import { getTailscaleProjectUrl } from "@/server/tailscale/urls";

export interface RuntimeUrlSet {
	local: string;
	tailscale: string | null;
	preferred: string;
}

export interface NullableRuntimeUrlSet {
	local: string | null;
	tailscale: string | null;
	preferred: string | null;
}

export interface ProjectRuntimeUrls {
	preview: RuntimeUrlSet;
	production: NullableRuntimeUrlSet;
}

function buildLocalUrl(port: number | null | undefined): string | null {
	return port ? `http://localhost:${port}` : null;
}

function preferTailscale(
	localUrl: string | null,
	tailscaleUrl: string | null,
): string | null {
	return tailscaleUrl ?? localUrl;
}

export async function getProjectRuntimeUrls(
	project: Pick<Project, "id" | "slug" | "productionPort"> & {
		devPort?: number | null;
	},
): Promise<ProjectRuntimeUrls> {
	const previewLocalUrl = buildLocalUrl(project.devPort);
	const productionLocalUrl = buildLocalUrl(project.productionPort);
	const [previewTailscaleUrl, productionTailscaleUrl] = await Promise.all([
		getTailscaleProjectUrl(project.slug, "preview", project.id),
		getTailscaleProjectUrl(project.slug, "production", project.id),
	]);

	return {
		preview: {
			local: previewLocalUrl ?? "http://localhost:4321",
			tailscale: previewTailscaleUrl,
			preferred:
				preferTailscale(previewLocalUrl, previewTailscaleUrl) ??
				"http://localhost:4321",
		},
		production: {
			local: productionLocalUrl,
			tailscale: productionTailscaleUrl,
			preferred: preferTailscale(productionLocalUrl, productionTailscaleUrl),
		},
	};
}
