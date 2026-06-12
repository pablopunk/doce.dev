import { create } from "./projects.create";
import { get, list } from "./projects.crud";
import { deleteAll, deleteProject } from "./projects.delete";
import { restart, stop } from "./projects.lifecycle";
import { restartOpencode } from "./projects.opencode";
import { deploy, rollback, stopProduction } from "./projects.production";
import { getProductionHistory } from "./projects.production-history";
import {
	markInitialPromptCompleted,
	markInitialPromptSent,
} from "./projects.prompt";
import { getQueueStatus } from "./projects.queue-status";
import { updateIdentity, updateModel } from "./projects.settings";

export const projects = {
	create,
	list,
	get,
	delete: deleteProject,
	stop,
	restart,
	deploy,
	stopProduction,
	deleteAll,
	updateModel,
	rollback,
	markInitialPromptSent,
	markInitialPromptCompleted,
	getQueueStatus,
	getProductionHistory,
	restartOpencode,
	updateIdentity,
};
