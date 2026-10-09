# Implementation Plan: AI Brain Document Listing

## Root Cause Analysis
The failure to list and count documents when asked "how many items are in the org Ai brain rn?" is caused by a cascade of four distinct issues. Previous investigations correctly identified the keyword filtering and plaintext caps, but completely missed the primary routing failure and a hidden architectural limit.

1. **Routing Failure (Primary Cause):** When the user asked about "items", Jarvis guessed `section="operations"`. Inside `executeSearchOrgBrain`, if the explicit section is not "all" or "documents", the `searchDocuments` function is intentionally bypassed. Jarvis never even queried the database for documents, rendering the `score = 0` bug irrelevant in this specific instance.
2. **In-Memory Query Limit (Hidden Bug):** Even if Jarvis correctly used `section="documents"`, `searchDocuments` uses a hardcoded `db.collection(...).limit(30).get()` query without any server-side keyword filtering. It only fetches the first 30 documents from the collection. If an org uploads more than 30 documents, the rest are permanently invisible to filename searches and listing operations.
3. **Conversational Query Filtering:** When Jarvis passes a conversational query (e.g., "how many items"), `searchDocuments` scores documents based on exact keyword matches in their plaintext. Documents without those exact words score `0` and are filtered out.
4. **Plaintext Size Cap:** `searchDocuments` caps the total returned plaintext at `24,000` characters. With ~6,000 characters appended per document, the loop `break`s after ~4 documents, entirely discarding the remaining files from the returned list.

## Implementation Steps

To fix this reliably while adhering to the FROZEN CODE rule ("only fix the specific bug, no surrounding refactors"), we must introduce a designated listing mode to bypass text limits and scoring, and explicitly guide the LLM to use it.

### Step 1: Update Tool Definitions (`src/lib/jarvis-org-brain-tools.ts`)
- Add an optional `list_only: boolean` parameter to both `ORG_BRAIN_TOOL_DEFINITIONS` and `PERSONAL_BRAIN_TOOL_DEFINITIONS`.
- Update the tool `description` to explicitly instruct the agent: *"To list or count all uploaded documents, use section='documents', set list_only=true, and leave the query EMPTY."*
- Update the `KEYWORD_HINTS` array to include `\b(item|items|list)\b` mapped to the `documents` section to prevent misrouting to `operations`.

### Step 2: Pass the Parameter
- Update the signatures of `executeSearchOrgBrain` and `executeSearchPersonalBrain` to accept `list_only?: boolean` in their `args` object.
- Pass this boolean down to the `searchDocuments` function call.

### Step 3: Modify `searchDocuments` Logic
Update `searchDocuments` to handle `list_only: true`:
1. **Fix the Limit:** Change `.limit(30)` to `.limit(listOnly ? 100 : 30)`. When listing, we can safely fetch more metadata without memory or LLM context-window issues.
2. **Fix the Scoring:** If `listOnly` is true, explicitly assign `score = 1` to all documents. This bypasses the `score > 0` filter, preventing documents from being dropped if Jarvis accidentally includes a conversational query while listing.
3. **Fix the Cap:** In the final assembly loop, if `listOnly` is true, emit ONLY the document metadata (name, size, vector chunk count) and `continue`. Do NOT append `plaintext` and do NOT increment `totalChars`, completely bypassing the `break` that discards files.
