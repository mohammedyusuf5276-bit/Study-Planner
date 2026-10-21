-- Apply this migration to databases that were created before display names
-- were added to the account table.
ALTER TABLE studyflow_users ADD COLUMN IF NOT EXISTS display_name text;

UPDATE studyflow_users
SET display_name = split_part(email, '@', 1)
WHERE display_name IS NULL OR btrim(display_name) = '';

ALTER TABLE studyflow_users ALTER COLUMN display_name SET NOT NULL;
