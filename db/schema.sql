-- ============================================================================
-- Chronologicon Engine — Database Schema (DDL)
-- PostgreSQL 14+
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable trigram matching for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Table: historical_events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS historical_events (
    event_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_name       VARCHAR(500) NOT NULL,
    description      TEXT,
    start_date       TIMESTAMPTZ NOT NULL,
    end_date         TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_date - start_date))::INTEGER / 60
    ) STORED,
    parent_event_id  UUID REFERENCES historical_events(event_id) ON DELETE SET NULL,
    metadata         JSONB DEFAULT '{}',

    -- Constraint: end_date must be after or equal to start_date
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Fast date range queries (search, overlapping events, temporal gaps)
CREATE INDEX IF NOT EXISTS idx_events_start_date ON historical_events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON historical_events(end_date);

-- Fast parent-child lookups (timeline reconstruction via recursive CTE)
CREATE INDEX IF NOT EXISTS idx_events_parent_id ON historical_events(parent_event_id);

-- Fast case-insensitive partial text search (ILIKE on event_name)
CREATE INDEX IF NOT EXISTS idx_events_name_trgm ON historical_events
    USING GIN (event_name gin_trgm_ops);

-- Composite index for common date range + sorting pattern
CREATE INDEX IF NOT EXISTS idx_events_date_range ON historical_events(start_date, end_date);

