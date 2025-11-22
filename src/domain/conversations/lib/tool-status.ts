const toolStatusByProject = new Map<string, string | null>();

export function setToolStatus(projectId: string, status: string | null) {
	if (!status) {
		toolStatusByProject.delete(projectId);
		return;
	}
	toolStatusByProject.set(projectId, status);
}

export function getToolStatus(projectId: string): string | null {
	return toolStatusByProject.get(projectId) ?? null;
}
