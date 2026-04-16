import type { Project } from "@/server/db/schema";

export type ProjectListItem = Project & {
	previewUrl: string | null;
};
