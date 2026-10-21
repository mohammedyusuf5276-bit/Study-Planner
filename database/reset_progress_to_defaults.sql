-- Run this in the Neon SQL Editor to reset every account's progress.
-- User accounts and credentials are retained. On each account's next sign-in,
-- the app recreates its progress from DEFAULT_DATA in app.js.
TRUNCATE TABLE studyflow_data;
