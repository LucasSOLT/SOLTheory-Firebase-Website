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
