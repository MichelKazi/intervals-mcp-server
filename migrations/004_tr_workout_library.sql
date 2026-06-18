-- TrainerRoad workout library cache
-- Stores full workout metadata for fast search by zone, duration, TSS, tags

CREATE TABLE IF NOT EXISTS tr_workout_library (
    tr_workout_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    duration_secs INTEGER NOT NULL,
    tss REAL,
    is_outside BOOLEAN DEFAULT FALSE,
    sport_type TEXT DEFAULT 'Ride',
    -- Derived classification
    zone_focus TEXT[], -- e.g. {'vo2max', 'threshold', 'sweet-spot'}
    tags TEXT[], -- e.g. {'over-under', 'progressive', 'short-intervals'}
    intensity_min INTEGER, -- lowest %FTP in main set
    intensity_max INTEGER, -- highest %FTP in main set
    interval_count INTEGER, -- number of work intervals (non-warmup/cooldown)
    -- Raw structure for reconstruction
    intervals_json JSONB, -- full interval data for workout_doc generation
    -- Coaching classification
    adaptation_target TEXT, -- aerobic_base, threshold_power, vo2max, repeatability, etc.
    interval_pattern TEXT, -- steady_state, over_under, short_intervals, microbursts, etc.
    race_specific BOOLEAN DEFAULT FALSE,
    work_duration_avg INTEGER, -- average work interval duration in seconds
    recovery_duration_avg INTEGER, -- average recovery interval duration in seconds
    -- Metadata
    crawled_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tr_library_zone_focus ON tr_workout_library USING GIN (zone_focus);
CREATE INDEX IF NOT EXISTS idx_tr_library_tags ON tr_workout_library USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_tr_library_duration ON tr_workout_library (duration_secs);
CREATE INDEX IF NOT EXISTS idx_tr_library_tss ON tr_workout_library (tss);
CREATE INDEX IF NOT EXISTS idx_tr_library_sport ON tr_workout_library (sport_type);
CREATE INDEX IF NOT EXISTS idx_tr_library_name ON tr_workout_library (name);
CREATE INDEX IF NOT EXISTS idx_tr_library_adaptation ON tr_workout_library (adaptation_target);
CREATE INDEX IF NOT EXISTS idx_tr_library_pattern ON tr_workout_library (interval_pattern);
CREATE INDEX IF NOT EXISTS idx_tr_library_race_specific ON tr_workout_library (race_specific) WHERE race_specific = true;
