-- ============================================================================
-- SOLTheory — Working Memories (Dual-Scope P.A.C.T.) Schema
-- ============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- Prerequisites: supabase-schema.sql (organizations, users, org_members, chat_scope enum)
-- ============================================================================

-- ============================================================================
-- TABLE: working_memories
-- ============================================================================
-- Stores facts extracted from AI conversations in two isolated scopes:
--   'user'  → Private to a single user (My Assistant)
--   'org'   → Shared across all org members (Org Hub)
-- ============================================================================

CREATE TABLE IF NOT EXISTS working_memories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope             chat_scope NOT NULL DEFAULT 'user',
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  question          TEXT NOT NULL,
  answer            TEXT NOT NULL,
  category          TEXT DEFAULT 'preference'
                    CHECK (category IN (
                      'identity', 'work', 'relationship', 'goal',
                      'preference', 'temporal', 'habit', 'opinion',
                      'location', 'contact', 'project', 'team', 'process'
                    )),
  confidence        TEXT DEFAULT 'medium'
                    CHECK (confidence IN ('high', 'medium', 'low')),
  source            TEXT DEFAULT 'chat_extraction'
                    CHECK (source IN (
                      'chat_extraction', 'manual', 'promoted', 'server_background'
                    )),
  marked_for_deletion TIMESTAMPTZ,
  deletion_reason   TEXT,
  review_count      INTEGER DEFAULT 0,
  last_reviewed_at  TIMESTAMPTZ,
  last_review_result TEXT,
  last_review_reason TEXT,
  user_restored     BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES (optimised for the two query patterns)
-- ============================================================================

-- Personal memory lookup: WHERE user_id = ? AND scope = 'user' AND org_id = ?
CREATE INDEX IF NOT EXISTS idx_wm_user_scope
  ON working_memories(user_id, scope, org_id);

-- Org memory lookup: WHERE org_id = ? AND scope = 'org'
CREATE INDEX IF NOT EXISTS idx_wm_org_scope
  ON working_memories(org_id, scope);

-- Heartbeat purge: WHERE marked_for_deletion IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_wm_marked_deletion
  ON working_memories(marked_for_deletion)
  WHERE marked_for_deletion IS NOT NULL;

-- Category filter
CREATE INDEX IF NOT EXISTS idx_wm_category
  ON working_memories(category);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE working_memories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own personal memories
CREATE POLICY wm_user_select ON working_memories
  FOR SELECT USING (
    (scope = 'user' AND user_id = current_user_id())
    OR
    (scope = 'org' AND is_org_member(org_id))
  );

-- Policy: Users can insert personal memories for themselves,
--         or org memories if they are a member of the org
CREATE POLICY wm_user_insert ON working_memories
  FOR INSERT WITH CHECK (
    user_id = current_user_id()
    AND (
      (scope = 'user')
      OR
      (scope = 'org' AND is_org_member(org_id))
    )
  );

-- Policy: Users can update their own personal memories,
--         or org memories if they have manager+ role
CREATE POLICY wm_user_update ON working_memories
  FOR UPDATE USING (
    (scope = 'user' AND user_id = current_user_id())
    OR
    (scope = 'org' AND is_org_member(org_id))
  );

-- Policy: Users can delete their own personal memories,
--         or org memories if they have manager+ role
CREATE POLICY wm_user_delete ON working_memories
  FOR DELETE USING (
    (scope = 'user' AND user_id = current_user_id())
    OR
    (scope = 'org' AND has_org_role(org_id, 'manager'))
  );

-- Service role bypasses RLS automatically (used by background extractors)
