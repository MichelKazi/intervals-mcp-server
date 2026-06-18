-- Race reports index table and pattern definitions lookup
-- Run against Supabase project: witrgovuotihhxyprnca

-- Pattern definitions: stable registry of recurring behavioral/psychological patterns
CREATE TABLE IF NOT EXISTS pattern_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with the known pattern
INSERT INTO pattern_definitions (id, name, description) VALUES
    ('dropout-before-effort', 'Dropout Before Full Effort', 'Self-protection mechanism: exits races before full effort to preserve the "didn''t really try" narrative rather than risk trying fully and still failing.')
ON CONFLICT (id) DO NOTHING;

-- Race reports index
CREATE TABLE IF NOT EXISTS race_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    athlete_id TEXT NOT NULL,
    date DATE NOT NULL,
    race_name TEXT NOT NULL,
    race_type TEXT NOT NULL CHECK (race_type IN ('A', 'B', 'C')),
    result TEXT NOT NULL,
    dropped BOOLEAN DEFAULT FALSE,
    finish_position INTEGER,
    tsb_at_race NUMERIC,
    ctl_at_race NUMERIC,
    intervals_activity_id TEXT,
    intervals_event_id TEXT,
    vault_path TEXT,
    patterns JSONB DEFAULT '[]'::JSONB,
    tags TEXT[] DEFAULT '{}',
    vault_write_ok BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (athlete_id, date, race_name)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_race_reports_athlete_date ON race_reports (athlete_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_race_reports_dropped ON race_reports (athlete_id, dropped) WHERE dropped = TRUE;
CREATE INDEX IF NOT EXISTS idx_race_reports_tags ON race_reports USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_race_reports_patterns ON race_reports USING GIN (patterns);
