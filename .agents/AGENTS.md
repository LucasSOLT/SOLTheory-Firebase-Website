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
