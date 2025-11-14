import { server as projectActions } from "@/domain/projects/actions/project-actions";
import { server as llmActions } from "@/domain/llms/actions/llm-actions";
import { server as conversationActions } from "@/domain/conversations/actions/conversation-actions";
import { server as authActions } from "@/domain/auth/actions/auth-actions";
import {
	deployments as deploymentActions,
	stats as statsActions,
	admin as adminActions,
} from "@/domain/system/actions/system-actions";

export const server = {
	admin: adminActions,
	chat: conversationActions,
	config: llmActions,
	deployments: deploymentActions,
	projects: projectActions,
	setup: authActions,
	stats: statsActions,
};
