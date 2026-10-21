-- Add password_display column to studyflow_users table so admin can view user passwords
ALTER TABLE studyflow_users
  ADD COLUMN IF NOT EXISTS password_display text;
