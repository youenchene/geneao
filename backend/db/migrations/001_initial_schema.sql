-- 001_initial_schema.sql
-- Relational GEDCOM model with full history/versioning support.
-- Every mutation creates a snapshot in the _history tables so we can rollback
-- or view the tree at any point in time.

BEGIN;

-- ============================================================
-- Core tables
-- ============================================================

CREATE TABLE IF NOT EXISTS individuals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gedcom_id   TEXT UNIQUE,                   -- e.g. "@I1@"
    given_name  TEXT NOT NULL DEFAULT '',
    surname     TEXT NOT NULL DEFAULT '',
    sex         CHAR(1) NOT NULL DEFAULT 'U'   -- M, F, U
        CHECK (sex IN ('M', 'F', 'U')),
    birth_date  TEXT NOT NULL DEFAULT '',       -- GEDCOM-style date string
    birth_place TEXT NOT NULL DEFAULT '',
    death_date  TEXT NOT NULL DEFAULT '',
    death_place TEXT NOT NULL DEFAULT '',
    note        TEXT NOT NULL DEFAULT '',
    photo_key   TEXT,                           -- S3 object key for photo
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS families (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gedcom_id       TEXT UNIQUE,               -- e.g. "@F1@"
    husband_id      UUID REFERENCES individuals(id) ON DELETE SET NULL,
    wife_id         UUID REFERENCES individuals(id) ON DELETE SET NULL,
    marriage_date   TEXT NOT NULL DEFAULT '',
    marriage_place  TEXT NOT NULL DEFAULT '',
    divorce_date    TEXT NOT NULL DEFAULT '',
    note            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_children (
    family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    child_id    UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    sort_order  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (family_id, child_id)
);

-- An individual can be a child in one family
CREATE TABLE IF NOT EXISTS individual_child_of (
    individual_id UUID PRIMARY KEY REFERENCES individuals(id) ON DELETE CASCADE,
    family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE
);

-- ============================================================
-- GEDCOM file tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS gedcom_files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    s3_key      TEXT NOT NULL,                 -- S3 object key
    version     INT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- History / versioning
-- ============================================================

CREATE TABLE IF NOT EXISTS change_sets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS individual_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_set_id   UUID NOT NULL REFERENCES change_sets(id) ON DELETE CASCADE,
    individual_id   UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
    operation       TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    -- snapshot of all fields at this point in time
    given_name      TEXT,
    surname         TEXT,
    sex             CHAR(1),
    birth_date      TEXT,
    birth_place     TEXT,
    death_date      TEXT,
    death_place     TEXT,
    note            TEXT,
    photo_key       TEXT,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_set_id   UUID NOT NULL REFERENCES change_sets(id) ON DELETE CASCADE,
    family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    operation       TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    husband_id      UUID,
    wife_id         UUID,
    marriage_date   TEXT,
    marriage_place  TEXT,
    divorce_date    TEXT,
    note            TEXT,
    child_ids       UUID[],           -- snapshot of children at this point
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_individuals_gedcom_id ON individuals(gedcom_id);
CREATE INDEX idx_families_gedcom_id ON families(gedcom_id);
CREATE INDEX idx_family_children_child ON family_children(child_id);
CREATE INDEX idx_individual_history_individual ON individual_history(individual_id);
CREATE INDEX idx_family_history_family ON family_history(family_id);
CREATE INDEX idx_change_sets_created ON change_sets(created_at);

COMMIT;
