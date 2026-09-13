-- ============================================================
-- Prompt 3: Multi-Tenant Row-Level Security (RLS)
-- SOLTheory INSiGHT — Supabase
-- Run this ENTIRE script in the Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- STEP 1: Helper Functions
-- ─────────────────────────────────────────────

-- Returns the current user's Supabase UUID from session variable
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

-- RPC callable from application code to set user context
CREATE OR REPLACE FUNCTION public.set_user_context(user_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is a member of an org
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.user_id = public.current_user_id()
      AND org_members.org_id = check_org_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user has a minimum role level in an org
-- Role hierarchy: admin > manager > member > viewer
CREATE OR REPLACE FUNCTION public.has_org_role(check_org_id UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.user_id = public.current_user_id()
      AND org_members.org_id = check_org_id
      AND (
        -- Admin can do everything
        org_members.role = 'admin'
        -- Manager can do manager, member, viewer tasks
        OR (required_role IN ('manager', 'member', 'viewer') AND org_members.role = 'manager')
        -- Member can do member, viewer tasks
        OR (required_role IN ('member', 'viewer') AND org_members.role = 'member')
        -- Viewer can only do viewer tasks
        OR (required_role = 'viewer' AND org_members.role = 'viewer')
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ─────────────────────────────────────────────
-- STEP 2: Enable RLS on All 16 Tables
-- ─────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_board_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_campaigning ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_data ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────
-- STEP 3: RLS Policies
-- ─────────────────────────────────────────────

-- ── GROUP A: User-Owned Table ──

-- users: Can only see/edit own row
CREATE POLICY users_select_own ON users
  FOR SELECT USING (id = current_user_id());
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (id = current_user_id());


-- ── GROUP B: Org Membership ──

-- organizations: Viewable if you're a member
CREATE POLICY orgs_select_member ON organizations
  FOR SELECT USING (is_org_member(id));

-- org_members: See own memberships + fellow members in your orgs
CREATE POLICY org_members_select ON org_members
  FOR SELECT USING (
    user_id = current_user_id()
    OR is_org_member(org_id)
  );
CREATE POLICY org_members_insert ON org_members
  FOR INSERT WITH CHECK (has_org_role(org_id, 'admin'));
CREATE POLICY org_members_delete ON org_members
  FOR DELETE USING (has_org_role(org_id, 'admin'));


-- ── GROUP C: Scope-Aware Chat (Core of INSiGHT) ──

-- chat_sessions: Private = owner only, Org = all org members
CREATE POLICY chat_sessions_select ON chat_sessions
  FOR SELECT USING (
    CASE scope
      WHEN 'user' THEN user_id = current_user_id()
      WHEN 'org'  THEN is_org_member(org_id)
    END
  );
CREATE POLICY chat_sessions_insert ON chat_sessions
  FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY chat_sessions_update ON chat_sessions
  FOR UPDATE USING (user_id = current_user_id());
CREATE POLICY chat_sessions_delete ON chat_sessions
  FOR DELETE USING (user_id = current_user_id());

-- messages: Inherits access from parent chat_session
CREATE POLICY messages_select ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = messages.session_id
        AND (
          (cs.scope = 'user' AND cs.user_id = current_user_id())
          OR (cs.scope = 'org' AND is_org_member(cs.org_id))
        )
    )
  );
CREATE POLICY messages_insert ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = messages.session_id
        AND cs.user_id = current_user_id()
    )
  );
CREATE POLICY messages_delete ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = messages.session_id
        AND cs.user_id = current_user_id()
    )
  );


-- ── GROUP D: Org-Scoped Data Tables ──

-- grants
CREATE POLICY grants_select ON grants
  FOR SELECT USING (is_org_member(org_id));
CREATE POLICY grants_insert ON grants
  FOR INSERT WITH CHECK (has_org_role(org_id, 'member'));
CREATE POLICY grants_update ON grants
  FOR UPDATE USING (has_org_role(org_id, 'member'));
CREATE POLICY grants_delete ON grants
  FOR DELETE USING (has_org_role(org_id, 'manager'));

-- grant_sessions
CREATE POLICY grant_sessions_select ON grant_sessions
  FOR SELECT USING (
    user_id = current_user_id()
    OR is_org_member(org_id)
  );
CREATE POLICY grant_sessions_insert ON grant_sessions
  FOR INSERT WITH CHECK (user_id = current_user_id() AND is_org_member(org_id));
CREATE POLICY grant_sessions_delete ON grant_sessions
  FOR DELETE USING (user_id = current_user_id());

-- timesheet_customers
CREATE POLICY ts_customers_select ON timesheet_customers
  FOR SELECT USING (is_org_member(org_id));
CREATE POLICY ts_customers_insert ON timesheet_customers
  FOR INSERT WITH CHECK (has_org_role(org_id, 'member'));
CREATE POLICY ts_customers_update ON timesheet_customers
  FOR UPDATE USING (has_org_role(org_id, 'member'));

-- timesheet_services
CREATE POLICY ts_services_select ON timesheet_services
  FOR SELECT USING (is_org_member(org_id));
CREATE POLICY ts_services_insert ON timesheet_services
  FOR INSERT WITH CHECK (has_org_role(org_id, 'member'));
CREATE POLICY ts_services_update ON timesheet_services
  FOR UPDATE USING (has_org_role(org_id, 'member'));

-- timesheet_entries (users see own + org managers see all)
CREATE POLICY ts_entries_select ON timesheet_entries
  FOR SELECT USING (
    user_id = current_user_id()
    OR has_org_role(org_id, 'manager')
  );
CREATE POLICY ts_entries_insert ON timesheet_entries
  FOR INSERT WITH CHECK (user_id = current_user_id() AND is_org_member(org_id));
CREATE POLICY ts_entries_update ON timesheet_entries
  FOR UPDATE USING (user_id = current_user_id() OR has_org_role(org_id, 'manager'));
CREATE POLICY ts_entries_delete ON timesheet_entries
  FOR DELETE USING (user_id = current_user_id() OR has_org_role(org_id, 'manager'));

-- action_board_tasks
CREATE POLICY abt_select ON action_board_tasks
  FOR SELECT USING (is_org_member(org_id));
CREATE POLICY abt_insert ON action_board_tasks
  FOR INSERT WITH CHECK (has_org_role(org_id, 'member'));
CREATE POLICY abt_update ON action_board_tasks
  FOR UPDATE USING (has_org_role(org_id, 'member'));
CREATE POLICY abt_delete ON action_board_tasks
  FOR DELETE USING (has_org_role(org_id, 'manager'));

-- beta_crm_contacts (owner or org member)
CREATE POLICY crm_select ON beta_crm_contacts
  FOR SELECT USING (
    user_id = current_user_id()
    OR is_org_member(org_id)
  );
CREATE POLICY crm_insert ON beta_crm_contacts
  FOR INSERT WITH CHECK (user_id = current_user_id() AND is_org_member(org_id));
CREATE POLICY crm_update ON beta_crm_contacts
  FOR UPDATE USING (user_id = current_user_id() OR has_org_role(org_id, 'manager'));
CREATE POLICY crm_delete ON beta_crm_contacts
  FOR DELETE USING (user_id = current_user_id() OR has_org_role(org_id, 'manager'));

-- beta_campaigning
CREATE POLICY campaign_select ON beta_campaigning
  FOR SELECT USING (is_org_member(org_id));
CREATE POLICY campaign_insert ON beta_campaigning
  FOR INSERT WITH CHECK (has_org_role(org_id, 'member'));
CREATE POLICY campaign_update ON beta_campaigning
  FOR UPDATE USING (has_org_role(org_id, 'member'));
CREATE POLICY campaign_delete ON beta_campaigning
  FOR DELETE USING (has_org_role(org_id, 'manager'));


-- ── GROUP E: Audit / Telemetry Tables ──

-- activity_log (org members can read + insert)
CREATE POLICY activity_log_select ON activity_log
  FOR SELECT USING (is_org_member(org_id));
CREATE POLICY activity_log_insert ON activity_log
  FOR INSERT WITH CHECK (is_org_member(org_id));

-- ai_usage (own usage or org admin)
CREATE POLICY ai_usage_select ON ai_usage
  FOR SELECT USING (
    user_id = current_user_id()
    OR has_org_role(org_id, 'admin')
  );
CREATE POLICY ai_usage_insert ON ai_usage
  FOR INSERT WITH CHECK (is_org_member(org_id));


-- ── GROUP F: Legacy / System Table ──

-- legacy_data (admin-only access)
CREATE POLICY legacy_select ON legacy_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = current_user_id()
        AND org_members.role = 'admin'
    )
  );


-- ─────────────────────────────────────────────
-- STEP 4: Updated match_messages RPC
-- with scope, org, and user filtering
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_messages(
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  filter_user_id UUID DEFAULT NULL,
  filter_org_id UUID DEFAULT NULL,
  filter_scope chat_scope DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  content TEXT,
  role TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id, m.session_id, m.content, m.role,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM messages m
  JOIN chat_sessions cs ON cs.id = m.session_id
  WHERE m.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR cs.user_id = filter_user_id)
    AND (filter_org_id IS NULL OR cs.org_id = filter_org_id)
    AND (filter_scope IS NULL OR cs.scope = filter_scope)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ─────────────────────────────────────────────
-- DONE! All 16 tables now have RLS enabled
-- with 40+ policies enforcing multi-tenant security.
--
-- Note: createServiceClient() (service_role) still
-- bypasses RLS — this is by design. The policies
-- act as defense-in-depth and will be enforced
-- when we switch to RLS-aware query paths.
-- ─────────────────────────────────────────────
