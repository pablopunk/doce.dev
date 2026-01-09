-- Remove duplicate model column after migrating to current_model
-- The old 'model' column was conflicting with the new 'currentModel' column

-- Migrate data from old 'model' column to new 'currentModel' column
-- Add provider prefix to models that don't already have it
UPDATE projects
SET current_model = CASE
    WHEN model LIKE '%/%' THEN model  -- Already has provider prefix
    WHEN model IS NOT NULL THEN 'openrouter/' || model  -- Add prefix
    ELSE current_model  -- Keep existing current_model if model is null
END
WHERE current_model IS NULL AND model IS NOT NULL;--> statement-breakpoint

-- Fix any existing data that might be missing provider prefixes
UPDATE projects
SET current_model = 'openrouter/' || current_model
WHERE current_model IS NOT NULL
  AND current_model NOT LIKE '%/%';--> statement-breakpoint

-- Drop the old 'model' column
ALTER TABLE projects DROP COLUMN model;