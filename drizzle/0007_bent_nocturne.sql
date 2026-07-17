-- Preserve the intent represented by pre-reconciliation rows before removing
-- the legacy transitional status column.
UPDATE `projects`
SET `desired_status` = CASE `status`
	WHEN 'created' THEN 'created'
	WHEN 'starting' THEN 'running'
	WHEN 'running' THEN 'running'
	WHEN 'stopping' THEN 'stopped'
	WHEN 'stopped' THEN 'stopped'
	WHEN 'error' THEN 'running'
	WHEN 'deleting' THEN 'deleting'
	ELSE `desired_status`
END;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `status`;
