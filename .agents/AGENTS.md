# Agent Rules — SOLTheory.com

## Security Rules

1. **Never** prefix secret/sensitive environment variables with `NEXT_PUBLIC_`. Only public identifiers (app URLs, public IDs) may use this prefix.
2. **Never** reference `process.env.*_SECRET`, `process.env.*_TOKEN`, `process.env.*_AUTH_TOKEN`, or `process.env.*_API_KEY` in `"use client"` components. These must only be accessed in server-side code (API routes, server components, server actions).
3. **Always** add authentication (`verifyRequest` or `verifyAdmin` from `@/lib/api-auth`) to new API routes. No API route should be publicly accessible without authentication unless it is a webhook receiver (e.g., Twilio inbound SMS).
4. **Never** commit `.env.local`, `.env.production`, `.gcloud-adc.json`, or any file containing credentials to git.
5. **Never** hardcode API keys, secrets, or tokens directly in source code files. Always use `process.env.VARIABLE_NAME` and define the variable in `.env.local`.
6. **Always** use the existing `getAuthHeaders()` helper from `@/lib/api-auth-client` when making authenticated API calls from client components.

## Code Style
- Preserve all existing comments and docstrings unrelated to your changes.
- Use the existing project patterns (e.g., `verifyRequest`, `showToast`, `isDarkMode` theming pattern).

## ⚠️ FROZEN CODE — Instagram Creative Assistant (DO NOT MODIFY) ⚠️

**Effective: July 24, 2026 — INDEFINITELY**

The entire Instagram Creative Assistant feature is **PRODUCTION-FROZEN**. This integration is live for all users and organizations and must work indefinitely. **Do NOT modify, refactor, rename, delete, or restructure** any of the following 15 files under ANY circumstances unless the project owner (Lucas) explicitly requests it:

### Frozen Files (15 total):

**UI Components (8 files):**
- `src/app/portal/dashboard/[orgId]/agentic-campaigning/instagram/page.tsx`
- `src/app/portal/dashboard/[orgId]/agentic-campaigning/instagram/__tests__/instagram.test.ts`
- `src/app/portal/dashboard/[orgId]/agentic-campaigning/instagram/_components/CampaignLanding.tsx`
- `src/app/portal/dashboard/[orgId]/agentic-campaigning/instagram/_components/CampaignPlanner.tsx`
- `src/app/portal/dashboard/[orgId]/agentic-campaigning/instagram/_components/CaptionEditor.tsx`
- `src/app/portal/dashboard/[orgId]/agentic-campaigning/instagram/_components/ErrorAlertHandler.tsx`
- `src/app/portal/dashboard/[orgId]/agentic-campaigning/instagram/_components/OnboardingView.tsx`
- `src/app/portal/dashboard/[orgId]/agentic-campaigning/instagram/_components/WorkspaceLayout.tsx`

**API Routes (4 files):**
- `src/app/api/auth/instagram/callback/route.ts`
- `src/app/api/campaigning/instagram/cron/route.ts`
- `src/app/api/campaigning/instagram/publish/route.ts`
- `src/app/api/campaigning/instagram/trigger-cron/route.ts`

**AI Route (1 file):**
- `src/app/api/campaigning/instagram-ai/route.ts`

**Data Layer (2 files):**
- `src/stores/instagramStore.ts`
- `src/firebase/firestore/instagram.ts`

### Rules:
1. **Never** edit these files during unrelated refactors (e.g., white-label migrations, theming changes, dependency upgrades).
2. **Never** rename, move, or delete any of these files.
3. **Never** change the exports, interfaces, or function signatures in these files.
4. **Never** update imports in other files that would require changes to these frozen files.
5. If a bug is found in these files, **only fix the specific bug** — do not refactor surrounding code.
6. If a new feature requires changes to Instagram code, **create new files** rather than modifying frozen ones when possible.

---

## ⚠️ FROZEN CODE — Business Intelligence Dashboard (DO NOT MODIFY) ⚠️

**Effective: September 10, 2026 — INDEFINITELY**

The entire Business Intelligence Dashboard feature is **PRODUCTION-FROZEN**. **Do NOT modify, refactor, rename, delete, or restructure** any of the following 15 files under ANY circumstances unless the project owner (Lucas) explicitly requests it:

### Frozen Files (15 total):

**Page:**
- `src/app/portal/dashboard/[orgId]/business-intelligence/page.tsx`

**Components (13 files):**
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/BillableRevenueChart.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/BusinessIntelligenceDashboard.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/GrantPipelineChart.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/GrantScoreDistribution.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/GrantWinRateCard.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/InstagramOverviewCard.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/PipelineBreakdownChart.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/PostActivityChart.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/RequestBIPanelModal.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/RevenueByContactChart.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/RevenueForecastChart.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/ServiceBreakdownChart.tsx`
- `src/app/portal/dashboard/[orgId]/business-intelligence/_components/TeamProductivityChart.tsx`

**Hooks (1 file):**
- `src/app/portal/dashboard/[orgId]/business-intelligence/_hooks/useBIData.ts`

### Rules:
1. **Never** edit these files during unrelated refactors.
2. **Never** rename, move, or delete any of these files.
3. **Never** change the exports, interfaces, or function signatures in these files.
4. If a bug is found in these files, **only fix the specific bug** — do not refactor surrounding code.
5. If a new feature requires changes to BI code, **create new files** rather than modifying frozen ones when possible.

---

## ⚠️ FROZEN CODE — CRM Module (DO NOT MODIFY) ⚠️

**Effective: September 10, 2026 — INDEFINITELY**

The entire CRM (Customer Relationship Management) module is **PRODUCTION-FROZEN**. **Do NOT modify, refactor, rename, delete, or restructure** any of the following files under ANY circumstances unless the project owner (Lucas) explicitly requests it:

### Frozen Files (27 total):

**Page (1 file):**
- `src/app/portal/dashboard/[orgId]/crm/page.tsx`

**Components (20 files):**
- `src/components/crm/AIInsightsPanel.tsx`
- `src/components/crm/BulkActionsBar.tsx`
- `src/components/crm/CRMCommandPalette.tsx`
- `src/components/crm/CSVFieldMergeDialog.tsx`
- `src/components/crm/CampaignCalendar.tsx`
- `src/components/crm/DuplicateDetector.tsx`
- `src/components/crm/ExportModal.tsx`
- `src/components/crm/FilterBuilder.tsx`
- `src/components/crm/InlineEditCell.tsx`
- `src/components/crm/KPIHeaderStrip.tsx`
- `src/components/crm/ManageFieldsSidebar.tsx`
- `src/components/crm/PipelineSetup.tsx`
- `src/components/crm/Skeletons.tsx`
- `src/components/crm/Toast.tsx`
- `src/components/crm/contact-profile/ActivityTimeline.tsx`
- `src/components/crm/contact-profile/ContactProfilePanel.tsx`
- `src/components/crm/views/CRMFollowUps.tsx`
- `src/components/crm/views/CRMSettingsView.tsx`
- `src/components/crm/views/CRMTasksView.tsx`
- `src/components/crm/views/PipelineBoard.tsx`

**Portal Widget (1 file):**
- `src/components/portal/CRMPipelineWidget.tsx`

**Store (1 file):**
- `src/stores/crm-store.ts`

**Tools & Libraries (1 file):**
- `src/lib/jarvis-crm-tools.ts`

**API Routes (4 files):**
- `src/app/api/crm/contact-chat/route.ts`
- `src/app/api/crm/enrich/route.ts`
- `src/app/api/crm/migrate-org-to-company/route.ts`
- `src/app/api/crm/send-campaign/route.ts`

### Rules:
1. **Never** edit these files during unrelated refactors.
2. **Never** rename, move, or delete any of these files.
3. **Never** change the exports, interfaces, or function signatures in these files.
4. If a bug is found in these files, **only fix the specific bug** — do not refactor surrounding code.
5. If a new feature requires changes to CRM code, **create new files** rather than modifying frozen ones when possible.

---

## ⚠️ FROZEN CODE — Gmail UI (DO NOT MODIFY) ⚠️

**Effective: September 10, 2026 — INDEFINITELY**

The Gmail UI screen is **PRODUCTION-FROZEN**. **Do NOT modify, refactor, rename, delete, or restructure** the following files. **NOTE**: Jarvis's email/calendar tools in `src/app/api/chat/route.ts` remain ACTIVE and are NOT frozen — only the Gmail UI page and panel are frozen.

### Frozen Files (2 total):

- `src/app/portal/dashboard/[orgId]/gmail/page.tsx`
- `src/components/portal/GmailAIPanel.tsx`

### Rules:
1. **Never** edit these files during unrelated refactors.
2. **Never** rename, move, or delete any of these files.
3. **Never** change the exports, interfaces, or function signatures in these files.
4. The email tools (`search_emails`, `email`, `delete_email`, `block_sender`, `create_folder`) in `src/app/api/chat/route.ts` are **NOT frozen** and remain fully functional.
5. If a bug is found in these files, **only fix the specific bug** — do not refactor surrounding code.


---

## ⚠️ ACTIVE BUILD PLAN — Onboarding Document System (DO NOT DEVIATE) ⚠️

**Effective: October 2, 2026 — Until all 5 phases are complete**

The following is the APPROVED implementation plan for the Onboarding Document System upgrade. **Do NOT deviate from this plan, invent new features, or redesign the architecture differently than specified below.** The full specification artifact is at: `onboarding-full-specification.md` in the conversation artifacts.

### Approved Decisions (LOCKED):
1. **PDF Embedding: Option A (PDF.js)** — Use Mozilla's `pdfjs-dist` to render PDF pages as `<canvas>` with interactive HTML field overlays positioned at native PDF `/Rect` coordinates. Do NOT use iframe/embed or HTML-only approaches.
2. **Email Delivery: Manual "Send & Archive"** — Never auto-send completed documents. Always require admin/supervisor to manually click "Send & Archive" to trigger SendGrid delivery. This allows Re-Request before sending.
3. **Signing Order: Configurable** — Flowchart-style card chain UI in BlueprintEditor with searchable org member dropdowns. Boxes can be added/removed/reordered. First box defaults to "Employee" (auto-assigned). Each box shows user name, role, avatar.
4. **Re-Request / Redo** — Supervisors can click "Re-Request" on any completed item to reset it to `todo` state with notes. Employee sees the notes and resubmits.
5. **Supervisor Visibility** — Supervisors see their assigned employees' blueprint progress in real-time (page refresh). They can drill into any item to see uploads, form responses, quiz answers, signatures, PDFs.
6. **Multi-Party Signing** — Documents route from signer to signer in configured order. Partial filling (no flatten until ALL signers done). Each signer sees previous signers' fields as read-only.

### Phase Order (FOLLOW EXACTLY):
- **Phase 1:** Supervisor Assignment & Progress Visibility (Steps 1.1–1.4)
- **Phase 2:** PDF.js Visual Document Embedding (Steps 2.1–2.5)
- **Phase 3:** Multi-Party Signing Workflow (Steps 3.1–3.5)
- **Phase 4:** Send & Archive + Email Delivery (Steps 4.1–4.3)
- **Phase 5:** Polish, Testing & Edge Cases (Steps 5.1–5.4)

### Rules:
1. **Always** follow the Split-Model Workflow (Opus for architecture, Flash for polish).
2. **Never** skip phases or steps. Complete each step fully before moving to the next.
3. **Never** flatten a multi-signer PDF until ALL signers have completed their portions.
4. **Always** use `supervisorUid`/`supervisorEmail` (not `mentorUid`/`mentorEmail`) for new supervisor assignment code.
5. **Always** ask for deployment approval before pushing to main.


---

## ⚠️ ACTIVE BUILD PLAN — Onboarding Phase 6: Signing Reliability & Reuse (DO NOT DEVIATE) ⚠️

**Effective: October 3, 2026 — Until all steps are complete.** Approved by Lucas ("go with your recommendations"). Full plan: `whats-next-phase-6-plan.md` in the conversation artifacts. Phases 1–5 of the Onboarding Document System remain locked as written above (Step 5.4 live verification is pending the owner).

### Step order (FOLLOW EXACTLY):
- **6.1** Stalled-signature reminders + escalation (reminder after 2 days, then every 3 days, max 4; escalate to supervisor/admin at 5 days; signer who left the org → escalate, never remind)
- **6.2** Smart auto-fill (today's date / signer name / signer email, filled server-side)
- **6.3** Org Document Library (upload + detect fields once; copy-on-use into blueprints)
- **6.4** Carry-over hardening (login `?next=` across orgs; explicit Firestore deny rule for `email_dispatch_log`)
- **6.5** Admin "Stuck documents" panel
- **6.6** Verify (local E2E + tsc + build) → ask deployment approval → one combined live checklist (Phases 4 + 5 + 6)
- *Optional parallel track:* Jarvis recall-evaluation script

### Rules:
1. **Never** skip or reorder steps; finish and locally verify each before the next.
2. **Never** auto-send a document. Reminders and escalations carry links only, never the PDF.
3. Cron routes **must fail closed** (no `CRON_SECRET` configured ⇒ no access).
4. **Always** ask for deployment approval before pushing to main.
