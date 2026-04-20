-- 003_add_tier1_fields.sql
-- Add Tier 1 GEDCOM fields on individuals: occupation (OCCU),
-- burial date/place (BURI), and NAME sub-fields (prefix/suffix/nickname).
-- All columns default to empty string so existing data is preserved.

BEGIN;

ALTER TABLE individuals ADD COLUMN IF NOT EXISTS occupation   TEXT NOT NULL DEFAULT '';
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS burial_date  TEXT NOT NULL DEFAULT '';
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS burial_place TEXT NOT NULL DEFAULT '';
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS name_prefix  TEXT NOT NULL DEFAULT '';
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS name_suffix  TEXT NOT NULL DEFAULT '';
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS nickname     TEXT NOT NULL DEFAULT '';

ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS occupation   TEXT;
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS burial_date  TEXT;
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS burial_place TEXT;
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS name_prefix  TEXT;
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS name_suffix  TEXT;
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS nickname     TEXT;

COMMIT;
