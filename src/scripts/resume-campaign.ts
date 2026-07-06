/**
 * Resume Campaign Script — Uses Firebase Client SDK with email/password or anonymous auth
 * Falls back to direct REST with API key
 */

const API_KEY = "AIzaSyCAJWBLJ1GTXtELpKFubBlENBq0eroUyCM";
const PROJECT_ID = "studio-5711990008-7ac2c";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const CUTOFF_NAME = "justin";

// Try signing in anonymously to get a valid auth token
async function getAuthToken(): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) {
    console.log("Anonymous auth failed, trying without auth...");
    return "";
  }
  const data = await res.json();
  return data.idToken || "";
}

function getHeaders(token: string) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function firestoreList(path: string, token: string, pageSize = 300) {
  let allDocs: any[] = [];
  let pageToken = "";
  while (true) {
    let url = `${BASE}/${path}?key=${API_KEY}&pageSize=${pageSize}`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url, { headers: getHeaders(token) });
    if (!res.ok) throw new Error(`LIST ${path}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (data.documents) allDocs.push(...data.documents);
    if (data.nextPageToken) pageToken = data.nextPageToken;
    else break;
  }
  return allDocs;
}

async function firestoreSet(path: string, data: Record<string, any>, token: string) {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined) fields[k] = toFV(v);
  const res = await fetch(`${BASE}/${path}?key=${API_KEY}`, {
    method: "PATCH",
    headers: getHeaders(token),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`SET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function toFV(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFV) } };
  if (typeof v === "object") {
    const f: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) if (val !== undefined) f[k] = toFV(val);
    return { mapValue: { fields: f } };
  }
  return { stringValue: String(v) };
}

function fromFV(v: any): any {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fromFV);
  if (v.mapValue) {
    const o: Record<string, any> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) o[k] = fromFV(val);
    return o;
  }
  return v;
}

function fromDoc(doc: any) {
  const r: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields || {})) r[k] = fromFV(v);
  return r;
}

async function main() {
  console.log("🔑 Authenticating...");
  const token = await getAuthToken();
  console.log(token ? "✅ Got auth token" : "⚠️  No auth token, using API key only");

  console.log("\n🔍 Looking for the mass email campaign...\n");
  const userDocs = await firestoreList("users", token, 50);
  console.log(`Found ${userDocs.length} users.`);

  let ownerUid = "";
  let originalCampaign: any = null;

  for (const userDoc of userDocs) {
    const uid = userDoc.name.split("/").pop()!;
    try {
      const campDocs = await firestoreList(`users/${uid}/campaigns`, token, 20);
      for (const cd of campDocs) {
        const data = fromDoc(cd);
        if ((data.recipients?.length || 0) > 500) {
          console.log(`✅ Found: "${data.name}" — ${data.recipients.length} recipients (user: ${uid})`);
          ownerUid = uid;
          originalCampaign = data;
          break;
        }
      }
      if (ownerUid) break;
    } catch (e) { /* skip */ }
  }

  if (!ownerUid || !originalCampaign) {
    console.error("❌ Could not find the campaign.");
    process.exit(1);
  }

  const allRecipients: any[] = originalCampaign.recipients || [];
  console.log(`\n📋 "${originalCampaign.name}"`);
  console.log(`📧 Subject: "${originalCampaign.subject}"`);
  console.log(`👥 ${allRecipients.length} total recipients`);

  // Sort alphabetically
  const sorted = [...allRecipients].sort((a, b) => {
    const na = (a.name || a.firstName || a.email || "").toLowerCase();
    const nb = (b.name || b.firstName || b.email || "").toLowerCase();
    return na.localeCompare(nb);
  });

  // Cutoff
  let cutoff = sorted.length;
  for (let i = 0; i < sorted.length; i++) {
    const n = (sorted[i].name || sorted[i].firstName || sorted[i].email || "").toLowerCase();
    if (n.localeCompare(CUTOFF_NAME) >= 0) { cutoff = i; break; }
  }

  console.log(`\n✂️  Cutoff at [${cutoff}]:`);
  for (let i = Math.max(0, cutoff - 3); i < Math.min(sorted.length, cutoff + 5); i++) {
    const r = sorted[i];
    const n = r.name || r.firstName || r.email || "?";
    const m = i < cutoff ? "✅" : (i === cutoff ? "← CUTOFF" : "📬");
    console.log(`  [${i}] ${m} ${n} (${r.email})`);
  }

  const remaining = sorted.slice(cutoff);
  console.log(`\n📬 Remaining: ${remaining.length}`);

  const triggerAt = "2026-07-07T12:00:00.000Z";
  const newId = `camp-resume-${Date.now()}`;

  const newCampaign: Record<string, any> = {
    id: newId,
    name: `Resume: NXT Chapter Grand Opening (${remaining.length} remaining)`,
    subject: originalCampaign.subject,
    body: originalCampaign.body || "",
    recipients: remaining,
    status: "active",
    triggerAt,
    createdAt: new Date().toISOString(),
    sent: 0,
    repeatDays: 0,
  };
  if (originalCampaign.htmlContent) newCampaign.htmlContent = originalCampaign.htmlContent;
  if (originalCampaign.senderName) newCampaign.senderName = originalCampaign.senderName;
  if (originalCampaign.senderEmail) newCampaign.senderEmail = originalCampaign.senderEmail;
  if (originalCampaign.channel) newCampaign.channel = originalCampaign.channel;

  if (!process.argv.includes("--execute")) {
    console.log("\n🏃 DRY RUN:");
    console.log(`  Name: ${newCampaign.name}`);
    console.log(`  Recipients: ${remaining.length}`);
    console.log(`  Trigger: 6:00 AM MT tomorrow`);
    console.log(`\n  First 5:`);
    remaining.slice(0, 5).forEach((r: any, i: number) => console.log(`    ${i+1}. ${r.name||"?"} — ${r.email}`));
    console.log(`  Last 3:`);
    remaining.slice(-3).forEach((r: any, i: number) => console.log(`    ${remaining.length-2+i}. ${r.name||"?"} — ${r.email}`));
    console.log(`\n✅ Run with --execute to create.`);
  } else {
    console.log("\n🚀 Writing to Firestore...");
    await firestoreSet(`users/${ownerUid}/campaigns/${newId}`, newCampaign, token);
    console.log(`\n✅ Campaign created! Check Josie's dashboard now!`);
    console.log(`📬 ${remaining.length} recipients → 6:00 AM MT tomorrow`);
  }
}

main().catch(console.error);
