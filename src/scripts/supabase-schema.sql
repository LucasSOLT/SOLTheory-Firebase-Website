-- ============================================================================
-- SOLTheory — Supabase PostgreSQL Schema (Firebase → Postgres Migration)
-- ============================================================================
-- Model: text-embedding-3-small (1536 dimensions) — LOCKED
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  company_name  TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  website       TEXT,
  branding      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Users (merged Firebase Auth + Firestore profile)
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid          TEXT UNIQUE NOT NULL,
  email                 TEXT,
  display_name          TEXT,
  first_name            TEXT,
  last_name             TEXT,
  bio                   TEXT,
  location              TEXT,
  access_level          TEXT DEFAULT 'User-Level',
  avatar_url            TEXT,
  twilio_phone_number   TEXT,
  walkthrough_completed BOOLEAN DEFAULT false,
  email_verified        BOOLEAN DEFAULT false,
  disabled              BOOLEAN DEFAULT false,
  raw_firebase_auth     JSONB,
  raw_firebase_profile  JSONB,
  last_login            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- 3. Org Members (junction: users ↔ organizations with role)
CREATE TABLE IF NOT EXISTS org_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- 4. Chat Sessions (from Firestore users/{uid}/jarvis_sessions)
CREATE TYPE chat_scope AS ENUM ('user', 'org');

CREATE TABLE IF NOT EXISTS chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID REFERENCES organizations(id) ON DELETE SET NULL,
  session_name    TEXT,
  scope           chat_scope DEFAULT 'user',
  token_count     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 5. Messages (flattened from jarvis_sessions.messages array)
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content     TEXT NOT NULL,
  tokens      INTEGER,
  embedding   vector(1536),
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 6. Timesheet Customers
CREATE TABLE IF NOT EXISTS timesheet_customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  rate            NUMERIC(10,2),
  status          TEXT DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 7. Timesheet Services
CREATE TABLE IF NOT EXISTS timesheet_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  default_rate    NUMERIC(10,2),
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 8. Timesheet Entries
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES timesheet_customers(id) ON DELETE SET NULL,
  service_id      UUID REFERENCES timesheet_services(id) ON DELETE SET NULL,
  date            DATE NOT NULL,
  duration_hours  NUMERIC(6,2) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 9. Grants
CREATE TABLE IF NOT EXISTS grants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  grantor         TEXT,
  description     TEXT,
  funding_amount  TEXT,
  match_score     INTEGER,
  deadline        TEXT,
  url             TEXT,
  status          TEXT DEFAULT 'saved',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 10. Grant Sessions
CREATE TABLE IF NOT EXISTS grant_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status          TEXT DEFAULT 'in_progress',
  summary         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 11. Action Board Tasks
CREATE TABLE IF NOT EXISTS action_board_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  assigned_to     TEXT,
  status          TEXT DEFAULT 'todo',
  priority        TEXT DEFAULT 'medium',
  due_date        DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 12. Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  user_name       TEXT,
  details         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 13. AI Usage Telemetry
CREATE TABLE IF NOT EXISTS ai_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id   TEXT UNIQUE,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature           TEXT,
  model             TEXT,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  cost_estimate     NUMERIC(10,6),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- BETA FEATURE TABLES (JSONB-flexible for unstructured legacy data)
-- ============================================================================

-- 14. Beta CRM Contacts (from users/{uid}/contacts subcollection)
CREATE TABLE IF NOT EXISTS beta_crm_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       TEXT,
  email           TEXT,
  phone           TEXT,
  company         TEXT,
  job_title       TEXT,
  lead_status     TEXT,
  deal_value      NUMERIC(12,2),
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 15. Beta Campaigning (IG posts + connections + future platforms)
CREATE TABLE IF NOT EXISTS beta_campaigning (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_doc_id TEXT UNIQUE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  status          TEXT,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 16. Legacy Data (catch-all for small/obsolete collections)
CREATE TABLE IF NOT EXISTS legacy_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_name TEXT NOT NULL,
  firebase_doc_id TEXT NOT NULL,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collection_name, firebase_doc_id)
);

-- ============================================================================
-- INDEXES (High-frequency lookup columns for <150ms RAG query latency)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_members_user       ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org        ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user     ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org      ON chat_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_session       ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_role          ON messages(role);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_user ON timesheet_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_org  ON timesheet_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON timesheet_entries(date);
CREATE INDEX IF NOT EXISTS idx_grants_org             ON grants(org_id);
CREATE INDEX IF NOT EXISTS idx_grants_status          ON grants(status);
CREATE INDEX IF NOT EXISTS idx_grant_sessions_user    ON grant_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_action_board_org       ON action_board_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_action_board_status    ON action_board_tasks(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_user      ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_org       ON activity_log(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created   ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user          ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_org           ON ai_usage(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature       ON ai_usage(feature);
CREATE INDEX IF NOT EXISTS idx_beta_crm_user          ON beta_crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_crm_org           ON beta_crm_contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_beta_crm_lead_status   ON beta_crm_contacts(lead_status);
CREATE INDEX IF NOT EXISTS idx_beta_campaign_org       ON beta_campaigning(org_id);
CREATE INDEX IF NOT EXISTS idx_legacy_collection      ON legacy_data(collection_name);

-- HNSW index for vector cosine similarity search on messages
CREATE INDEX IF NOT EXISTS idx_messages_embedding_hnsw
  ON messages USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- RPC: Vector Similarity Search Function
-- ============================================================================

CREATE OR REPLACE FUNCTION match_messages(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  role text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.session_id,
    m.role,
    m.content,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM messages m
  JOIN chat_sessions cs ON cs.id = m.session_id
  WHERE m.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR cs.user_id = filter_user_id)
    AND (1 - (m.embedding <=> query_embedding)) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
