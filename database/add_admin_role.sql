-- Add account roles to existing StudyFlow databases and promote Mohammed Yusuf.
ALTER TABLE studyflow_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studyflow_users_role_check'
      AND conrelid = 'studyflow_users'::regclass
  ) THEN
    ALTER TABLE studyflow_users
      ADD CONSTRAINT studyflow_users_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

DO $$
DECLARE
  promoted_count integer;
BEGIN
  UPDATE studyflow_users
  SET role = 'admin'
  WHERE lower(email) = 'mohammed.yusuf5276@gmail.com';
  GET DIAGNOSTICS promoted_count = ROW_COUNT;
  IF promoted_count = 0 THEN
    RAISE EXCEPTION 'No StudyFlow account found for mohammed.yusuf5276@gmail.com';
  END IF;
END $$;
