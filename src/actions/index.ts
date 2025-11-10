import { server as adminActions } from "./admin";
import { server as chatActions } from "./chat";
import { server as configActions } from "./config";
import { server as deploymentActions } from "./deployments";
import { server as projectActions } from "./projects";
import { server as setupActions } from "./setup";
import { server as statsActions } from "./stats";

export const server = {
	admin: adminActions,
	chat: chatActions,
	config: configActions,
	deployments: deploymentActions,
	projects: projectActions,
	setup: setupActions,
	stats: statsActions,
};
