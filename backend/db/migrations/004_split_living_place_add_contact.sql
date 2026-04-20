-- 004_split_living_place_add_contact.sql
-- Split `living_place` into structured `living_city` + `living_country`,
-- and add contact fields `email` + `phone` on individuals.
-- Existing `living_place` values are split on the first comma:
--   "Paris, France"      -> city="Paris", country="France"
--   "Paris"              -> city="Paris", country=""
--   "Lyon, Rhône, France"-> city="Lyon",  country="Rhône, France"

BEGIN;

-- New structured location + contact columns on individuals.
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS living_city    TEXT NOT NULL DEFAULT '';
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS living_country TEXT NOT NULL DEFAULT '';
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS email          TEXT NOT NULL DEFAULT '';
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS phone          TEXT NOT NULL DEFAULT '';

-- Mirror on history (nullable to allow pre-existing rows).
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS living_city    TEXT;
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS living_country TEXT;
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE individual_history ADD COLUMN IF NOT EXISTS phone          TEXT;

-- Backfill living_city / living_country from the legacy living_place column
-- when that column still exists (it does for any DB that applied migration 002).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'individuals'
          AND column_name  = 'living_place'
    ) THEN
        UPDATE individuals
        SET living_city = CASE
                WHEN living_place = '' THEN ''
                WHEN position(',' IN living_place) = 0 THEN trim(living_place)
                ELSE trim(substring(living_place FROM 1 FOR position(',' IN living_place) - 1))
            END,
            living_country = CASE
                WHEN position(',' IN living_place) = 0 THEN ''
                ELSE trim(substring(living_place FROM position(',' IN living_place) + 1))
            END
        WHERE living_place <> '';

        ALTER TABLE individuals        DROP COLUMN living_place;
        ALTER TABLE individual_history DROP COLUMN IF EXISTS living_place;
    END IF;
END $$;

COMMIT;
