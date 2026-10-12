import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks: capture waitUntil promises and fake the Supabase service client ──
const h = vi.hoisted(() => {
  const waited: Promise<unknown>[] = [];
  type Call = { table: string; op: string; rows?: any; opts?: any; filters: Record<string, unknown> };
  const calls: Call[] = [];
  const state = {
    users: {} as Record<string, string>, // firebase_uid -> supabase id
    sessions: {} as Record<string, { id: string; user_id: string; scope: string; org_id: string | null }>,
    members: [] as Array<{ user_id: string; org_id: string }>,
    upsertError: null as null | { message: string },
  };

  function query(table: string) {
    const filters: Record<string, unknown> = {};
    let op = "select";
    let rows: any;
    let opts: any;
    const api: any = {
      select: () => api,
      eq: (col: string, val: unknown) => { filters[col] = val; return api; },
      update: (r: any) => { op = "update"; rows = r; return api; },
      upsert: (r: any, o: any) => {
        op = "upsert"; rows = r; opts = o;
        calls.push({ table, op, rows, opts, filters });
        return Promise.resolve({ error: state.upsertError });
      },
      single: async () => {
        if (table === "users") {
          const id = state.users[filters["firebase_uid"] as string];
          return { data: id ? { id } : null };
        }
        if (table === "chat_sessions") {
          return { data: state.sessions[filters["id"] as string] || null };
        }
        if (table === "org_members") {
          const m = state.members.find((x) => x.user_id === filters["user_id"] && x.org_id === filters["org_id"]);
          return { data: m ? { id: "m1" } : null };
        }
        return { data: null };
      },
      then: (resolve: any) => {
        // awaited update(...).eq(...)
        calls.push({ table, op, rows, opts, filters });
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return api;
  }
  return { waited, calls, state, client: { from: (t: string) => query(t) } };
});

vi.mock("next/server", () => ({
  after: (p: Promise<unknown>) => { h.waited.push(p); },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => h.client,
}));
vi.mock("@/lib/api-auth-client", () => ({ getAuthHeaders: async () => ({}) }));
vi.mock("@/firebase/admin", () => ({ initAdmin: () => {}, getFirestore: () => ({}) }));

import {
  deriveMessageRowId,
  isUuid,
  splitUserApiContent,
  createChatTurnPersister,
  createBackgroundSSEStream,
} from "@/lib/chat-session-persist";
import { isInFlightReply } from "@/stores/chat-store";
import { isBrainImageRequest } from "@/lib/ai-brain-images";
import { capUploadBatch, MAX_AI_BRAIN_UPLOAD_FILES } from "@/lib/upload-batch-cap";

const SESSION = "11111111-2222-4333-8444-555555555555";
const OTHER_SESSION = "99999999-2222-4333-8444-555555555555";

async function flush() {
  await Promise.allSettled(h.waited.splice(0));
  await Promise.allSettled(h.waited.splice(0));
}

beforeEach(() => {
  h.waited.length = 0;
  h.calls.length = 0;
  h.state.users = { fbOwner: "sb-owner", fbMember: "sb-member", fbStranger: "sb-stranger" };
  h.state.sessions = {
    [SESSION]: { id: SESSION, user_id: "sb-owner", scope: "user", org_id: null },
    [OTHER_SESSION]: { id: OTHER_SESSION, user_id: "sb-owner", scope: "org", org_id: "org-1" },
  };
  h.state.members = [{ user_id: "sb-member", org_id: "org-1" }];
  h.state.upsertError = null;
});

describe("deriveMessageRowId", () => {
  it("is a deterministic, valid UUID bound to the session", () => {
    const a = deriveMessageRowId(SESSION, "1700000000000");
    expect(isUuid(a)).toBe(true);
    expect(deriveMessageRowId(SESSION, "1700000000000")).toBe(a);
    expect(deriveMessageRowId(OTHER_SESSION, "1700000000000")).not.toBe(a);
    expect(deriveMessageRowId(SESSION, "1700000000001")).not.toBe(a);
  });
});

describe("splitUserApiContent", () => {
  it("splits hidden context from the user's comment", () => {
    const r = splitUserApiContent("FILE CONTENTS\n\n[USER COMMENT]: summarize this");
    expect(r).toEqual({ text: "summarize this", hiddenContext: "FILE CONTENTS", imageUrl: undefined });
  });
  it("extracts image url from multimodal content", () => {
    const r = splitUserApiContent([
      { type: "text", text: "what is this?" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
    ]);
    expect(r.text).toBe("what is this?");
    expect(r.imageUrl).toBe("data:image/png;base64,AAA");
  });
  it("handles empty / odd input", () => {
    expect(splitUserApiContent(undefined)).toEqual({ text: "", imageUrl: undefined });
    expect(splitUserApiContent("")).toEqual({ text: "", imageUrl: undefined });
  });
});

describe("createChatTurnPersister", () => {
  const apiMessages = [
    { role: "user", content: "earlier" },
    { role: "assistant", content: "earlier reply" },
    { role: "user", content: "CTX\n\n[USER COMMENT]: new question" },
  ];

  it("is a no-op without a UUID session / uid / assistant id", async () => {
    expect(createChatTurnPersister({ sessionId: "local_123", firebaseUid: "fbOwner", apiMessages, userMessageIds: ["u"], assistantMessageId: "a" }).enabled).toBe(false);
    expect(createChatTurnPersister({ sessionId: SESSION, firebaseUid: null, apiMessages, userMessageIds: ["u"], assistantMessageId: "a" }).enabled).toBe(false);
    expect(createChatTurnPersister({ sessionId: SESSION, firebaseUid: "fbOwner", apiMessages, userMessageIds: ["u"], assistantMessageId: undefined }).enabled).toBe(false);
    await flush();
    expect(h.calls.length).toBe(0);
  });

  it("owner: saves the user prompt then the assistant reply once, with derived ids and serverSaved", async () => {
    const p = createChatTurnPersister({ sessionId: SESSION, firebaseUid: "fbOwner", apiMessages, userMessageIds: ["u1"], assistantMessageId: "a1" });
    expect(p.enabled).toBe(true);
    await p.saveAssistant("the answer", { citations: [{ title: "Doc" }] });
    await p.saveAssistant("a second, different answer"); // must be ignored
    await flush();

    const upserts = h.calls.filter((c) => c.op === "upsert");
    expect(upserts.length).toBe(2);
    const [userRow] = upserts[0].rows;
    expect(userRow.id).toBe(deriveMessageRowId(SESSION, "u1"));
    expect(userRow.role).toBe("user");
    expect(userRow.content).toBe("new question");
    expect(userRow.metadata).toMatchObject({ clientId: "u1", serverSaved: true, hiddenContext: "CTX" });
    expect(upserts[0].opts).toEqual({ onConflict: "id", ignoreDuplicates: true });

    const [botRow] = upserts[1].rows;
    expect(botRow.id).toBe(deriveMessageRowId(SESSION, "a1"));
    expect(botRow.role).toBe("assistant");
    expect(botRow.content).toBe("the answer");
    expect(botRow.metadata).toMatchObject({ clientId: "a1", serverSaved: true, citations: [{ title: "Doc" }] });
    expect(new Date(botRow.created_at).getTime()).toBeGreaterThan(new Date(userRow.created_at).getTime());
    expect(upserts[1].opts).toEqual({ onConflict: "id", ignoreDuplicates: true });
    // no `updated_at` column on messages
    expect(Object.keys(botRow)).not.toContain("updated_at");
    // session bumped
    expect(h.calls.some((c) => c.table === "chat_sessions" && c.op === "update")).toBe(true);
    // fallback title from the prompt, only over the "New Chat" placeholder
    const titleUpdate = h.calls.find((c) => c.table === "chat_sessions" && c.op === "update" && c.rows?.session_name);
    expect(titleUpdate?.rows).toEqual({ session_name: "new question" });
    expect(titleUpdate?.filters).toMatchObject({ id: SESSION, session_name: "New Chat" });
  });

  it("derives a short fallback title", async () => {
    const { deriveFallbackTitle } = await import("@/lib/chat-session-persist");
    expect(deriveFallbackTitle("Research EVERYTHING you can about Stephen W Huff in Colorado")).toBe("Research EVERYTHING you can about Stephen");
    expect(deriveFallbackTitle("  \"quoted\"\n\nprompt ")).toBe("quoted prompt");
    expect(deriveFallbackTitle("")).toBe("");
  });

  it("ignores empty assistant text", async () => {
    const p = createChatTurnPersister({ sessionId: SESSION, firebaseUid: "fbOwner", apiMessages, userMessageIds: ["u1"], assistantMessageId: "a1" });
    await p.saveAssistant("   ");
    await flush();
    expect(h.calls.filter((c) => c.op === "upsert" && c.rows[0].role === "assistant").length).toBe(0);
  });

  it("stranger: never writes into someone else's session", async () => {
    const p = createChatTurnPersister({ sessionId: SESSION, firebaseUid: "fbStranger", apiMessages, userMessageIds: ["u1"], assistantMessageId: "a1" });
    await p.saveAssistant("x");
    await flush();
    expect(h.calls.filter((c) => c.op === "upsert").length).toBe(0);
  });

  it("org member may write into an org-scope session; non-member may not", async () => {
    const ok = createChatTurnPersister({ sessionId: OTHER_SESSION, firebaseUid: "fbMember", apiMessages, userMessageIds: ["u1"], assistantMessageId: "a1" });
    await ok.saveAssistant("team answer");
    await flush();
    expect(h.calls.filter((c) => c.op === "upsert").length).toBe(2);

    h.calls.length = 0;
    const bad = createChatTurnPersister({ sessionId: OTHER_SESSION, firebaseUid: "fbStranger", apiMessages, userMessageIds: ["u1"], assistantMessageId: "a1" });
    await bad.saveAssistant("nope");
    await flush();
    expect(h.calls.filter((c) => c.op === "upsert").length).toBe(0);
  });

  it("skips user rows when the trailing messages don't line up with the ids", async () => {
    const p = createChatTurnPersister({ sessionId: SESSION, firebaseUid: "fbOwner", apiMessages, userMessageIds: ["u0", "u1"], assistantMessageId: "a1" });
    await p.saveAssistant("answer");
    await flush();
    const upserts = h.calls.filter((c) => c.op === "upsert");
    expect(upserts.length).toBe(1);
    expect(upserts[0].rows[0].role).toBe("assistant");
  });
});

describe("createBackgroundSSEStream", () => {
  it("keeps producing after the client cancels and never throws", async () => {
    const enc = new TextEncoder();
    let finished = false;
    let sawGone = false;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const stream = createBackgroundSSEStream({
      async start(c) {
        c.enqueue(enc.encode("data: one\n\n"));
        await gate;
        c.enqueue(enc.encode("data: two\n\n")); // after cancel: must be a no-op, not a throw
        sawGone = c.clientGone;
        c.close();
        finished = true;
      },
    });
    const reader = stream.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe("data: one\n\n");
    await reader.cancel();
    release();
    await flush();
    expect(finished).toBe(true);
    expect(sawGone).toBe(true);
  });

  it("delivers everything to a connected client and closes", async () => {
    const enc = new TextEncoder();
    const stream = createBackgroundSSEStream({
      async start(c) {
        c.enqueue(enc.encode("a"));
        c.enqueue(enc.encode("b"));
      },
    });
    const text = await new Response(stream).text();
    expect(text).toBe("ab");
  });
});

describe("isInFlightReply", () => {
  it("flags only streaming / pending bot bubbles", () => {
    expect(isInFlightReply({ id: "1", text: "hi", isSelf: true } as any)).toBe(false);
    expect(isInFlightReply({ id: "2", text: "", isSelf: false, agentEvents: [{ type: "thinking", timestamp: 1 }] } as any)).toBe(true);
    expect(isInFlightReply({ id: "3", text: "done", isSelf: false, agentEvents: [{ type: "thinking", timestamp: 1 }, { type: "done", timestamp: 2 }] } as any)).toBe(false);
    expect(isInFlightReply({ id: "4", text: "old", isSelf: false } as any)).toBe(false);
    expect(isInFlightReply({ id: "5", text: "", isSelf: false, isPendingImage: true } as any)).toBe(true);
  });
});

describe("isBrainImageRequest", () => {
  it("matches photo + brain phrasing", () => {
    expect(isBrainImageRequest("Can you describe the photos in my AI brain?")).toBe(true);
    expect(isBrainImageRequest("what images are in the media library")).toBe(true);
    expect(isBrainImageRequest("describe the pictures I uploaded to my knowledge base")).toBe(true);
  });
  it("ignores unrelated messages", () => {
    expect(isBrainImageRequest("describe this photo")).toBe(false);
    expect(isBrainImageRequest("what's in my brain about taxes")).toBe(false);
    expect(isBrainImageRequest("")).toBe(false);
  });
});

describe("capUploadBatch", () => {
  it("keeps the first 5 and reports the rest", () => {
    const files = ["a", "b", "c", "d", "e", "f", "g"];
    const r = capUploadBatch(files);
    expect(MAX_AI_BRAIN_UPLOAD_FILES).toBe(5);
    expect(r.accepted).toEqual(["a", "b", "c", "d", "e"]);
    expect(r.dropped).toEqual(["f", "g"]);
  });
  it("passes through batches at or under the cap", () => {
    expect(capUploadBatch(["a", "b", "c", "d", "e"]).dropped).toEqual([]);
    expect(capUploadBatch([])).toEqual({ accepted: [], dropped: [] });
  });
  it("works with array-likes (FileList shape)", () => {
    const fileListLike = { length: 6, 0: "a", 1: "b", 2: "c", 3: "d", 4: "e", 5: "f" } as ArrayLike<string>;
    const r = capUploadBatch(fileListLike);
    expect(r.accepted.length).toBe(5);
    expect(r.dropped).toEqual(["f"]);
  });
});

describe("declared dependencies", () => {
  // Regression: the background-save module imported `@vercel/functions`, which is only present
  // as an extraneous package in one local node_modules — the Vercel build cannot resolve it.
  it("new server modules only import packages declared in package.json", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { builtinModules } = await import("module");
    const root = process.cwd();
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
    const files = ["src/lib/chat-session-persist.ts", "src/lib/ai-brain-images.ts", "src/lib/upload-batch-cap.ts"];
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      const specs = [...src.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
      for (const spec of specs) {
        if (spec.startsWith(".") || spec.startsWith("@/")) continue;
        const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
        if (builtinModules.includes(name) || name.startsWith("node:")) continue;
        expect(declared.has(name), `${f} imports undeclared package "${name}"`).toBe(true);
      }
    }
  });
});
