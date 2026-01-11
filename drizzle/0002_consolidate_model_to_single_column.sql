-- Consolidate currentModelProviderID and currentModelID into a single currentModel column
-- Format: "provider/model-id" (e.g., "openrouter/google/gemini-3-flash")

-- Add new column
ALTER TABLE projects ADD COLUMN current_model TEXT;
--> statement-breakpoint
-- Migrate existing data (if any)
-- Assumes existing format is: provider="openrouter", model="google/gemini-3-flash"
UPDATE projects
SET current_model = CASE
    WHEN current_model_provider_id IS NOT NULL AND current_model_id IS NOT NULL
    THEN current_model_provider_id || '/' || current_model_id
    WHEN current_model_id IS NOT NULL
    THEN 'openrouter/' || current_model_id
    ELSE NULL
END
WHERE current_model IS NULL AND current_model_id IS NOT NULL;
--> statement-breakpoint
-- Drop old columns
ALTER TABLE projects DROP COLUMN current_model_provider_id;
--> statement-breakpoint
ALTER TABLE projects DROP COLUMN current_model_id;