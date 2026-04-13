-- 002_add_living_place.sql
-- Add living_place (current residence) to individuals and history.

BEGIN;

ALTER TABLE individuals ADD COLUMN IF NOT EXISTS living_place TEXT NOT NULL DEFAULT '';
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS living_place TEXT;

COMMIT;
