-- Remove openrouter_api_key column from user_settings table
-- This migration is safe to run when the column already exists (no-op)

ALTER TABLE user_settings DROP COLUMN openrouter_api_key;
