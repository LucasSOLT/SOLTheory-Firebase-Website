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
