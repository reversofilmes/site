-- Migration 0009: rename date_mmddyyyy → date_yymmdd and convert values MMDDYYYY → YYMMDD
-- MMDDYYYY (8 chars, e.g. "02172026") → YYMMDD (6 chars, e.g. "260217")
-- Formula: YY = substr(7,2), MM = substr(1,2), DD = substr(3,2)
-- Only convert rows where value is exactly 8 digits (safe guard).

UPDATE projects
SET date_mmddyyyy = substr(date_mmddyyyy, 7, 2) || substr(date_mmddyyyy, 1, 2) || substr(date_mmddyyyy, 3, 2)
WHERE length(date_mmddyyyy) = 8
  AND date_mmddyyyy GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';

ALTER TABLE projects RENAME COLUMN date_mmddyyyy TO date_yymmdd;
