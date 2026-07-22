import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getAuth } from "firebase-admin/auth";
import { runSystemDiagnostics } from "@/lib/diagnostics/health";
import { getRecentDiagnosticLogs, DiagnosticLog } from "@/lib/diagnostics/logger";

/**
 * SECURITY: This endpoint is restricted to lucas@soltheory.com ONLY.
 * It also requires a secondary password verification.
 * No API key names, masked values, or env var identifiers are returned.
 */

const DEVELOPER_EMAIL = "lucas@soltheory.com";
const SYSTEM_HEALTH_PASSWORD = "65688998";

/** Verify the requesting user is the developer (lucas@soltheory.com) */
async function verifyDeveloper(uid: string): Promise<{ ok: boolean; response?: NextResponse }> {
  try {
    await initAdmin();
    const userRecord = await getAuth().getUser(uid);
    const email = userRecord.email || "";
    if (email !== DEVELOPER_EMAIL) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Access denied — this panel is restricted to the system developer only" },
          { status: 403 }
        ),
      };
    }
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to verify developer identity" },
        { status: 500 }
      ),
    };
  }
}

/** Sanitize diagnostic logs before sending to client — strip errorDetails that may contain env var names */
function sanitizeLogs(logs: DiagnosticLog[]): Omit<DiagnosticLog, "errorDetails">[] {
  return logs.map(({ errorDetails, ...rest }) => rest);
}

export async function GET(req: NextRequest) {
  // Step 1: Firebase auth
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  // Step 2: Developer-only restriction
  const dev = await verifyDeveloper(auth.uid);
  if (!dev.ok) return dev.response!;

  // Step 3: Password verification via header
  const password = req.headers.get("x-system-health-password") || "";
  if (password !== SYSTEM_HEALTH_PASSWORD) {
    return NextResponse.json(
      { error: "Invalid system health password", requiresPassword: true },
      { status: 401 }
    );
  }

  try {
    const report = await runSystemDiagnostics();
    const recentLogs = await getRecentDiagnosticLogs(30);

    return NextResponse.json({
      success: true,
      report,
      logs: sanitizeLogs(recentLogs),
    });
  } catch (error: any) {
    console.error("[System Health API Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to run system health diagnostics" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Step 1: Firebase auth
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  // Step 2: Developer-only restriction
  const dev = await verifyDeveloper(auth.uid);
  if (!dev.ok) return dev.response!;

  // Step 3: Password from request body
  let password = "";
  try {
    const body = await req.json();
    password = body.password || "";
  } catch {
    // If body parsing fails, password stays empty
  }

  if (password !== SYSTEM_HEALTH_PASSWORD) {
    return NextResponse.json(
      { error: "Invalid system health password", requiresPassword: true },
      { status: 401 }
    );
  }

  try {
    const report = await runSystemDiagnostics();
    const recentLogs = await getRecentDiagnosticLogs(30);

    return NextResponse.json({
      success: true,
      message: "Diagnostics run completed successfully",
      report,
      logs: sanitizeLogs(recentLogs),
    });
  } catch (error: any) {
    console.error("[System Health API Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to run system health diagnostics" },
      { status: 500 }
    );
  }
}
