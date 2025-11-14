/**
 * Database abstraction layer
 *
 * This is the public API for database operations.
 * All domain code should import from this file, not directly from providers.
 */

import sqliteDb, * as sqlite from "./providers/sqlite";

// Re-export provider operations as namespaced objects
export const config = sqlite.config;
export const users = sqlite.users;
export const projects = sqlite.projects;
export const conversations = sqlite.conversations;
export const messages = sqlite.messages;
export const files = sqlite.files;
export const deployments = sqlite.deployments;

// Export raw database for advanced queries (use sparingly)
export const getDatabase = () => sqliteDb;

// Legacy function exports for backward compatibility
// TODO: Migrate all callers to use the new namespaced API
export const getConfig = sqlite.config.get;
export const setConfig = sqlite.config.set;
export const isSetupComplete = sqlite.config.isSetupComplete;

export const createUser = sqlite.users.create;
export const getUserByUsername = sqlite.users.getByUsername;

export const getProjects = sqlite.projects.getAll;
export const getProject = sqlite.projects.getById;
export const createProject = sqlite.projects.create;
export const deleteProject = sqlite.projects.delete;
export const updateProject = sqlite.projects.update;
export const appendBuildLog = sqlite.projects.appendBuildLog;
export const clearBuildLogs = sqlite.projects.clearBuildLogs;

export const getConversation = sqlite.conversations.getByProjectId;
export const getConversationById = sqlite.conversations.getById;
export const createConversation = sqlite.conversations.create;
export const updateConversationModel = sqlite.conversations.updateModel;

export const saveMessage = sqlite.messages.save;
export const getMessages = sqlite.messages.getByConversationId;
export const updateMessage = sqlite.messages.update;
export const deleteMessage = sqlite.messages.delete;
export const deleteMessagesFromIndex = sqlite.messages.deleteFromIndex;

export const getFiles = sqlite.files.getByProjectId;
export const saveFile = sqlite.files.save;

export const createDeployment = sqlite.deployments.create;
export const updateDeployment = sqlite.deployments.update;
export const getDeployment = sqlite.deployments.getById;
export const getDeployments = sqlite.deployments.getByProjectId;
