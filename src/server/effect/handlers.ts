import { handleDockerComposeUp } from "@/server/queue/handlers/dockerComposeUp";
import { handleDockerEnsureRunning } from "@/server/queue/handlers/dockerEnsureRunning";
import { handleDockerStop } from "@/server/queue/handlers/dockerStop";
import { handleDockerWaitReady } from "@/server/queue/handlers/dockerWaitReady";
import { handleOpencodeSendInitialPrompt } from "@/server/queue/handlers/opencodeSendInitialPrompt";
import { handleOpencodeSendUserPrompt } from "@/server/queue/handlers/opencodeSendUserPrompt";
import { handleOpencodeSessionCreate } from "@/server/queue/handlers/opencodeSessionCreate";
import { handleProductionBuild } from "@/server/queue/handlers/productionBuild";
import { handleProductionStart } from "@/server/queue/handlers/productionStart";
import { handleProductionStop } from "@/server/queue/handlers/productionStop";
import { handleProductionWaitReady } from "@/server/queue/handlers/productionWaitReady";
import { handleProjectCreate } from "@/server/queue/handlers/projectCreate";
import { handleProjectDelete } from "@/server/queue/handlers/projectDelete";
import { handleDeleteAllForUser } from "@/server/queue/handlers/projectsDeleteAllForUser";
import { wrapLegacyHandler } from "./handler-adapter";
import { registerHandler } from "./queue.worker";

export function registerAllHandlers(): void {
	registerHandler("project.create", wrapLegacyHandler(handleProjectCreate));
	registerHandler("project.delete", wrapLegacyHandler(handleProjectDelete));
	registerHandler("docker.composeUp", handleDockerComposeUp);
	registerHandler("docker.waitReady", handleDockerWaitReady);
	registerHandler("docker.stop", wrapLegacyHandler(handleDockerStop));
	registerHandler("projects.deleteAllForUser", handleDeleteAllForUser);
	registerHandler("docker.ensureRunning", handleDockerEnsureRunning);
	registerHandler("opencode.sessionCreate", handleOpencodeSessionCreate);
	registerHandler(
		"opencode.sendInitialPrompt",
		handleOpencodeSendInitialPrompt,
	);
	registerHandler("opencode.sendUserPrompt", handleOpencodeSendUserPrompt);
	registerHandler("production.build", handleProductionBuild);
	registerHandler("production.start", handleProductionStart);
	registerHandler("production.waitReady", handleProductionWaitReady);
	registerHandler("production.stop", handleProductionStop);
}
