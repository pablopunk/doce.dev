-- Add ports table for tracking allocated ports to prevent conflicts
CREATE TABLE ports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    port INTEGER NOT NULL UNIQUE,
    port_type TEXT NOT NULL CHECK(port_type IN ('base', 'version', 'dev')),
    project_id TEXT,
    hash TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);--> statement-breakpoint

-- Create index for faster lookups by port type
CREATE INDEX ports_port_type_idx ON ports(port_type);--> statement-breakpoint

-- Create index for faster lookups by project
CREATE INDEX ports_project_id_idx ON ports(project_id);
