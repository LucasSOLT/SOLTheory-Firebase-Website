import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";

// ---------------------------------------------------------------------------
// Contact Data Migration: Move org names from firstName → company
// ---------------------------------------------------------------------------
// GET  /api/admin/fix-contacts?mode=dry-run&secret=<CRON_SECRET>  → preview
// POST /api/admin/fix-contacts?mode=execute&secret=<CRON_SECRET>  → migrate
// ---------------------------------------------------------------------------

const CRON_SECRET = process.env.CRON_SECRET || "";

// ---------------------------------------------------------------------------
// Auth — accept secret via query param OR Authorization: Bearer header
// ---------------------------------------------------------------------------
function verifyAuth(req: NextRequest): boolean {
  const fromQuery = req.nextUrl.searchParams.get("secret") || "";
  const authHeader = req.headers.get("authorization");
  const fromHeader = authHeader ? authHeader.replace("Bearer ", "") : "";

  const token = fromQuery || fromHeader;
  if (!CRON_SECRET || !token) return false;

  try {
    const a = Buffer.from(token);
    const b = Buffer.from(CRON_SECRET);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Business-name suffixes (case-insensitive matching)
// ---------------------------------------------------------------------------
const BUSINESS_SUFFIXES = [
  "inc", "llc", "corp", "ltd", "foundation", "association",
  "organization", "organisation", "group", "partners", "co.",
  "institute", "university", "church", "ministry", "center", "centre",
  "society", "council", "network", "alliance", "academy",
  "consulting", "solutions", "services", "technologies", "enterprises",
  "holdings", "international", "global", "media", "studio", "labs",
  "ventures", "capital", "properties", "realty", "agency",
  "clinic", "hospital", "pharmacy", "restaurant", "bistro", "cafe",
  "hotel", "resort", "school", "college",
];

// ---------------------------------------------------------------------------
// Detection heuristics
// ---------------------------------------------------------------------------
interface DetectionResult {
  isOrg: boolean;
  reason: string;
}

function looksLikeOrganization(firstName: string): DetectionResult {
  const trimmed = firstName.trim();
  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/);

  // Safety: too short — skip
  if (trimmed.length < 3) {
    return { isOrg: false, reason: "" };
  }

  // 1. Contains a business suffix
  for (const suffix of BUSINESS_SUFFIXES) {
    // Match as a whole word (or at end preceded by space/punctuation)
    const regex = new RegExp(`(?:^|\\s|\\.)${suffix.replace(".", "\\.")}(?:\\s|\\.|,|$)`, "i");
    if (regex.test(trimmed)) {
      return { isOrg: true, reason: `Contains business suffix '${suffix}'` };
    }
  }

  // 2. Starts with "The " (e.g. "The NXT Chapter")
  if (lower.startsWith("the ") && words.length >= 2) {
    return { isOrg: true, reason: "Starts with 'The'" };
  }

  // 3. Contains '&' or ' and ' between words AND has 3+ words
  if (words.length >= 3) {
    if (trimmed.includes("&") || / \band\b /i.test(trimmed)) {
      return { isOrg: true, reason: "Contains '&' or 'and' with 3+ words" };
    }
  }

  // 4. All UPPERCASE and has 2+ words (likely acronym/org name)
  if (words.length >= 2 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return { isOrg: true, reason: "All UPPERCASE with 2+ words" };
  }

  return { isOrg: false, reason: "" };
}

// ---------------------------------------------------------------------------
// Safety checks — returns true if we should SKIP (not migrate)
// ---------------------------------------------------------------------------
function shouldSkip(
  firstName: string,
  lastName: string,
  company: string
): { skip: boolean; reason: string } {
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const trimmedCompany = company.trim();

  // Company field already has a value — don't overwrite
  if (trimmedCompany.length > 0) {
    return { skip: true, reason: "company field already populated" };
  }

  // firstName too short
  if (trimmedFirst.length < 3) {
    return { skip: true, reason: "firstName is less than 3 characters" };
  }

  // Both first and last name populated — likely a real person
  if (trimmedFirst.length > 0 && trimmedLast.length > 0) {
    return { skip: true, reason: "both firstName and lastName are populated" };
  }

  return { skip: false, reason: "" };
}

// ---------------------------------------------------------------------------
// Core migration logic
// ---------------------------------------------------------------------------
interface ChangeRecord {
  id: string;
  currentFirstName: string;
  movedToCompany: string;
  reason: string;
}

interface MigrationResult {
  mode: "dry-run" | "execute";
  scanned: number;
  identified: number;
  changes: ChangeRecord[];
  errors?: string[];
}

async function runMigration(execute: boolean): Promise<MigrationResult> {
  initAdmin();
  const db = getFirestore();

  const contactsRef = db.collection("shared/crm/contacts");
  const snapshot = await contactsRef.get();

  const changes: ChangeRecord[] = [];
  const errors: string[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const firstName = typeof data.firstName === "string" ? data.firstName : "";
    const lastName = typeof data.lastName === "string" ? data.lastName : "";
    const company = typeof data.company === "string" ? data.company : "";

    // Skip if no firstName
    if (!firstName.trim()) continue;

    // Safety checks
    const safety = shouldSkip(firstName, lastName, company);
    if (safety.skip) continue;

    // Detection
    const detection = looksLikeOrganization(firstName);
    if (!detection.isOrg) continue;

    changes.push({
      id: doc.id,
      currentFirstName: firstName,
      movedToCompany: firstName,
      reason: detection.reason,
    });

    // Actually write if executing
    if (execute) {
      try {
        await doc.ref.update({
          company: firstName,
          firstName: "",
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Failed to update ${doc.id}: ${msg}`);
      }
    }
  }

  const result: MigrationResult = {
    mode: execute ? "execute" : "dry-run",
    scanned: snapshot.size,
    identified: changes.length,
    changes,
  };

  if (errors.length > 0) {
    result.errors = errors;
  }

  return result;
}

// ---------------------------------------------------------------------------
// GET handler — dry-run preview
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = req.nextUrl.searchParams.get("mode");
  if (mode !== "dry-run") {
    return NextResponse.json(
      { error: "GET only supports mode=dry-run. Use POST for mode=execute." },
      { status: 400 }
    );
  }

  try {
    const result = await runMigration(false);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST handler — execute migration
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = req.nextUrl.searchParams.get("mode");
  if (mode !== "execute") {
    return NextResponse.json(
      { error: "POST only supports mode=execute. Use GET for mode=dry-run." },
      { status: 400 }
    );
  }

  try {
    const result = await runMigration(true);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
