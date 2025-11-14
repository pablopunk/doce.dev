import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { DEFAULT_AI_MODEL } from "@/domain/llms/models/ai-models";

const dbPath = process.env.DATABASE_PATH || "./data/doceapp.db";
mkdirSync(dirname(dbPath), { recursive: true });

const projectsDir = process.env.PROJECTS_DIR || "./data/projects/";
mkdirSync(projectsDir, { recursive: true });

const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    status TEXT DEFAULT 'draft',
    preview_url TEXT,
    deployed_url TEXT
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    model TEXT DEFAULT 'openai/gpt-4.1-mini',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, file_path)
  );

  CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    container_id TEXT,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'building',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
  CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
`);

// Config operations
export const config = {
	get: (key: string): string | undefined => {
		const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as
			| { value: string }
			| undefined;
		return row?.value;
	},

	set: (key: string, value: string): void => {
		db.prepare(
			"INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
		).run(key, value);
	},

	isSetupComplete: (): boolean => {
		if (config.get("setup_complete") === "true") return true;

		const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as
			| { count?: number }
			| undefined;
		const hasUser = (row?.count ?? 0) > 0;

		const provider = config.get("ai_provider");
		const hasEnvKey = Boolean(
			process.env.OPENAI_API_KEY ||
				process.env.ANTHROPIC_API_KEY ||
				process.env.OPENROUTER_API_KEY,
		);
		const hasConfigKey = provider
			? Boolean(config.get(`${provider}_api_key`))
			: false;
		const hasAI = hasEnvKey || (provider && hasConfigKey);

		return hasUser && !!hasAI;
	},
};

// User operations
export const users = {
	create: (username: string, passwordHash: string) => {
		const id = randomUUID();
		db.prepare(
			"INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)",
		).run(id, username, passwordHash);
		return { id, username };
	},

	getByUsername: (username: string) => {
		return db
			.prepare("SELECT * FROM users WHERE username = ?")
			.get(username) as any;
	},
};

// Project operations
export const projects = {
	getAll: () => {
		return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all();
	},

	getById: (id: string) => {
		return db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
	},

	create: (name: string, description?: string) => {
		const id = randomUUID();
		db.prepare(
			"INSERT INTO projects (id, name, description) VALUES (?, ?, ?)",
		).run(id, name, description || null);
		return { id, name, description };
	},

	delete: (id: string) => {
		db.prepare("DELETE FROM projects WHERE id = ?").run(id);
	},

	update: (id: string, data: any) => {
		const fields = Object.keys(data)
			.map((key) => `${key} = ?`)
			.join(", ");
		const values = Object.values(data);
		db.prepare(
			`UPDATE projects SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		).run(...values, id);
		return projects.getById(id);
	},

	appendBuildLog: (projectId: string, logLine: string) => {
		const project = projects.getById(projectId) as any;
		const currentLogs = project?.build_logs || "";
		const newLogs = currentLogs + logLine;
		db.prepare(
			"UPDATE projects SET build_logs = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		).run(newLogs, projectId);
	},

	clearBuildLogs: (projectId: string) => {
		db.prepare(
			"UPDATE projects SET build_logs = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		).run(projectId);
	},
};

// Conversation operations
export const conversations = {
	getByProjectId: (projectId: string) => {
		return db
			.prepare("SELECT * FROM conversations WHERE project_id = ?")
			.get(projectId) as any;
	},

	getById: (conversationId: string) => {
		return db
			.prepare("SELECT * FROM conversations WHERE id = ?")
			.get(conversationId) as any;
	},

	create: (projectId: string, model?: string) => {
		const id = randomUUID();
		const selectedModel = model || DEFAULT_AI_MODEL;
		db.prepare(
			"INSERT INTO conversations (id, project_id, model) VALUES (?, ?, ?)",
		).run(id, projectId, selectedModel);
		return { id, project_id: projectId, model: selectedModel };
	},

	updateModel: (conversationId: string, model: string) => {
		db.prepare(
			"UPDATE conversations SET model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		).run(model, conversationId);
		return conversations.getById(conversationId);
	},
};

// Message operations
export const messages = {
	save: (
		conversationId: string,
		role: string,
		content: string,
		streamingStatus: "streaming" | "complete" | "error" = "complete",
	) => {
		const id = randomUUID();
		db.prepare(
			"INSERT INTO messages (id, conversation_id, role, content, streaming_status) VALUES (?, ?, ?, ?, ?)",
		).run(id, conversationId, role, content, streamingStatus);
		return {
			id,
			conversation_id: conversationId,
			role,
			content,
			streaming_status: streamingStatus,
		};
	},

	getByConversationId: (conversationId: string) => {
		return db
			.prepare(
				"SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
			)
			.all(conversationId);
	},

	update: (
		messageId: string,
		content: string,
		streamingStatus?: "streaming" | "complete" | "error",
	) => {
		if (streamingStatus) {
			db.prepare(
				"UPDATE messages SET content = ?, streaming_status = ? WHERE id = ?",
			).run(content, streamingStatus, messageId);
		} else {
			db.prepare("UPDATE messages SET content = ? WHERE id = ?").run(
				content,
				messageId,
			);
		}
		return { id: messageId, content, streaming_status: streamingStatus };
	},

	delete: (messageId: string) => {
		const result = db
			.prepare("DELETE FROM messages WHERE id = ?")
			.run(messageId);
		return result.changes > 0;
	},

	deleteFromIndex: (conversationId: string, messageIndex: number) => {
		const allMessages = db
			.prepare(
				"SELECT id FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
			)
			.all(conversationId) as { id: string }[];

		if (messageIndex < allMessages.length) {
			const messagesToDelete = allMessages.slice(messageIndex);
			const placeholders = messagesToDelete.map(() => "?").join(",");
			const ids = messagesToDelete.map((m) => m.id);

			if (ids.length > 0) {
				db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(
					...ids,
				);
				return ids.length;
			}
		}

		return 0;
	},
};

// File operations
export const files = {
	getByProjectId: (projectId: string) => {
		const allFiles = db
			.prepare("SELECT * FROM files WHERE project_id = ? ORDER BY file_path")
			.all(projectId) as Array<{
			id: string;
			project_id: string;
			file_path: string;
			content: string;
			created_at: string;
			updated_at: string;
		}>;

		const shouldIgnore = (filePath: string) => {
			const ignoredPatterns = [
				/node_modules\//,
				/\.next\//,
				/\.astro\//,
				/dist\//,
				/build\//,
				/out\//,
				/\.cache\//,
				/\.turbo\//,
				/\.vercel\//,
				/\.netlify\//,
				/package-lock\.json$/,
				/yarn\.lock$/,
				/pnpm-lock\.yaml$/,
				/bun\.lockb$/,
				/\.env$/,
				/\.env\.local$/,
				/\.env\.[^/]+$/,
				/\.DS_Store$/,
				/Thumbs\.db$/,
				/\.git\//,
				/\.svn\//,
				/\.hg\//,
				/AGENTS\.md$/,
				/\.vscode\//,
				/\.idea\//,
				/\.vs\//,
				/\*\.swp$/,
				/\*~$/,
				/\.log$/,
				/npm-debug\.log$/,
				/yarn-debug\.log$/,
				/yarn-error\.log$/,
			];

			return ignoredPatterns.some((pattern) => pattern.test(filePath));
		};

		return allFiles.filter((file) => !shouldIgnore(file.file_path));
	},

	save: (projectId: string, filePath: string, content: string) => {
		const existing = db
			.prepare("SELECT id FROM files WHERE project_id = ? AND file_path = ?")
			.get(projectId, filePath) as any;

		if (existing) {
			db.prepare(
				"UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
			).run(content, existing.id);
			return {
				id: existing.id,
				project_id: projectId,
				file_path: filePath,
				content,
			};
		} else {
			const id = randomUUID();
			db.prepare(
				"INSERT INTO files (id, project_id, file_path, content) VALUES (?, ?, ?, ?)",
			).run(id, projectId, filePath, content);
			return { id, project_id: projectId, file_path: filePath, content };
		}
	},
};

// Deployment operations
export const deployments = {
	create: (projectId: string, containerId: string, url: string) => {
		const id = randomUUID();
		db.prepare(
			"INSERT INTO deployments (id, project_id, container_id, url, status) VALUES (?, ?, ?, ?, ?)",
		).run(id, projectId, containerId, url, "building");
		return {
			id,
			project_id: projectId,
			container_id: containerId,
			url,
			status: "building",
		};
	},

	update: (id: string, data: any) => {
		const fields = Object.keys(data)
			.map((key) => `${key} = ?`)
			.join(", ");
		const values = Object.values(data);
		db.prepare(
			`UPDATE deployments SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		).run(...values, id);
		return db.prepare("SELECT * FROM deployments WHERE id = ?").get(id);
	},

	getById: (id: string) => {
		return db.prepare("SELECT * FROM deployments WHERE id = ?").get(id);
	},

	getByProjectId: (projectId: string) => {
		return db
			.prepare(
				"SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC",
			)
			.all(projectId);
	},
};

export default db;
