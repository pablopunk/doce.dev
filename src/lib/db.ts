import Database from "better-sqlite3"
import { randomUUID } from "crypto"

const dbPath = process.env.DATABASE_PATH || "./data/v0builder.db"
const db = new Database(dbPath)

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
`)

// Config functions
export function getConfig(key: string) {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as { value: string } | undefined
  return row?.value
}

export function setConfig(key: string, value: string) {
  db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run(key, value)
}

export function isSetupComplete() {
  return getConfig("setup_complete") === "true"
}

// User functions
export function createUser(username: string, passwordHash: string) {
  const id = randomUUID()
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)").run(id, username, passwordHash)
  return { id, username }
}

export function getUserByUsername(username: string) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any
}

// Project functions
export function getProjects() {
  return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all()
}

export function getProject(id: string) {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id)
}

export function createProject(name: string, description?: string) {
  const id = randomUUID()
  db.prepare("INSERT INTO projects (id, name, description) VALUES (?, ?, ?)").run(id, name, description || null)
  return { id, name, description }
}

export function deleteProject(id: string) {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id)
}

export function updateProject(id: string, data: any) {
  const fields = Object.keys(data)
    .map((key) => `${key} = ?`)
    .join(", ")
  const values = Object.values(data)
  db.prepare(`UPDATE projects SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id)
  return getProject(id)
}

// Conversation functions
export function getConversation(projectId: string) {
  return db.prepare("SELECT * FROM conversations WHERE project_id = ?").get(projectId)
}

export function createConversation(projectId: string) {
  const id = randomUUID()
  db.prepare("INSERT INTO conversations (id, project_id) VALUES (?, ?)").run(id, projectId)
  return { id, project_id: projectId }
}

export function saveMessage(conversationId: string, role: string, content: string) {
  const id = randomUUID()
  db.prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)").run(
    id,
    conversationId,
    role,
    content,
  )
  return { id, conversation_id: conversationId, role, content }
}

export function getMessages(conversationId: string) {
  return db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conversationId)
}

// File functions
export function getFiles(projectId: string) {
  return db.prepare("SELECT * FROM files WHERE project_id = ? ORDER BY file_path").all(projectId)
}

export function saveFile(projectId: string, filePath: string, content: string) {
  const existing = db
    .prepare("SELECT id FROM files WHERE project_id = ? AND file_path = ?")
    .get(projectId, filePath) as any

  if (existing) {
    db.prepare("UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(content, existing.id)
    return { id: existing.id, project_id: projectId, file_path: filePath, content }
  } else {
    const id = randomUUID()
    db.prepare("INSERT INTO files (id, project_id, file_path, content) VALUES (?, ?, ?, ?)").run(
      id,
      projectId,
      filePath,
      content,
    )
    return { id, project_id: projectId, file_path: filePath, content }
  }
}

// Deployment functions
export function createDeployment(projectId: string, containerId: string, url: string) {
  const id = randomUUID()
  db.prepare("INSERT INTO deployments (id, project_id, container_id, url, status) VALUES (?, ?, ?, ?, ?)").run(
    id,
    projectId,
    containerId,
    url,
    "building",
  )
  return { id, project_id: projectId, container_id: containerId, url, status: "building" }
}

export function updateDeployment(id: string, data: any) {
  const fields = Object.keys(data)
    .map((key) => `${key} = ?`)
    .join(", ")
  const values = Object.values(data)
  db.prepare(`UPDATE deployments SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id)
  return db.prepare("SELECT * FROM deployments WHERE id = ?").get(id)
}

export function getDeployment(id: string) {
  return db.prepare("SELECT * FROM deployments WHERE id = ?").get(id)
}

export function getDeployments(projectId: string) {
  return db.prepare("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC").all(projectId)
}

export default db
