import type { Project } from "@/server/db/schema";

export interface RuntimeUrlSet {
	local: string | null;
	tailscale: string | null;
	preferred?: string | null;
}

export type ProjectListItem = Project & {
	previewUrl: string | null;
	previewUrls?: RuntimeUrlSet;
	productionUrls?: RuntimeUrlSet;
};
