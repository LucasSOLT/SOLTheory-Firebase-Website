import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("\n=======================================================");
  console.log(" 🛡️ SOLTheory Agent & System Health Verification CLI");
  console.log("=======================================================\n");

  const requiredVars = [
    { name: "GEMINI_API_KEY",               label: "Gemini AI Engine",             agent: "YouTube Creative Director, Genkit Flows" },
    { name: "GROQ_API_KEY",                 label: "Groq LLM Engine",             agent: "Agentic Campaigning, AI Chat, Email Assembly" },
    { name: "ELEVENLABS_API_KEY",           label: "Voice & TTS Engine",           agent: "Voice Chat, Text-to-Speech" },
    { name: "TAVILY_API_KEY",               label: "Web Search Engine",            agent: "AI Chat Web Search" },
    { name: "TWILIO_ACCOUNT_SID",           label: "SMS Gateway (Account)",        agent: "SMS & iMessage Agent" },
    { name: "TWILIO_AUTH_TOKEN",            label: "SMS Gateway (Auth)",           agent: "Twilio REST API" },
    { name: "TWILIO_MESSAGING_SERVICE_SID", label: "SMS Messaging Service",        agent: "Outbound SMS" },
    { name: "SENDGRID_API_KEY",             label: "Email Delivery Service",       agent: "Transactional Emails, Gmail AI, Campaign Emails" },
    { name: "SENDGRID_FROM_EMAIL",          label: "Email Sender Address",         agent: "Email From Address" },
    { name: "GOOGLE_CLIENT_ID",             label: "Google OAuth (Client)",        agent: "YouTube, Calendar, Drive, Gmail" },
    { name: "GOOGLE_CLIENT_SECRET",         label: "Google OAuth (Secret)",        agent: "YouTube, Calendar, Drive, Gmail" },
    { name: "META_APP_ID",                  label: "Meta Platform (App ID)",       agent: "Instagram Agent" },
    { name: "META_APP_SECRET",              label: "Meta Platform (Secret)",       agent: "Instagram Agent" },
    { name: "FIREBASE_SERVICE_ACCOUNT_KEY", label: "Firebase Admin SDK",           agent: "Firestore, Auth, All Server Routes" },
    { name: "ENCRYPTION_KEY",               label: "Data Encryption Key",          agent: "OAuth Token Encryption" },
    { name: "CRON_SECRET",                  label: "Cron Job Auth Secret",         agent: "Scheduled Campaign Crons" },
    { name: "SAM_GOV_API_KEY",              label: "SAM.gov Grants API",           agent: "Grant Finder" },
    { name: "QUICKBOOKS_CLIENT_ID",         label: "QuickBooks (Client)",          agent: "QuickBooks Integration" },
    { name: "QUICKBOOKS_CLIENT_SECRET",     label: "QuickBooks (Secret)",          agent: "QuickBooks Integration" },
  ];

  let missingCount = 0;
  let configuredCount = 0;

  console.log("Checking Environment Configuration:\n");
  for (const v of requiredVars) {
    const val = process.env[v.name];
    if (val && val.trim().length > 0) {
      configuredCount++;
      console.log(`  ✅ [OK]      ${v.label.padEnd(30)} -> Used by: ${v.agent}`);
    } else {
      missingCount++;
      console.log(`  ❌ [MISSING] ${v.label.padEnd(30)} -> Required by: ${v.agent}`);
    }
  }

  console.log("\n-------------------------------------------------------");
  if (missingCount === 0) {
    console.log(` 🎉 All ${configuredCount} required credentials present!`);
  } else {
    console.log(` ⚠️  ${missingCount} credential(s) missing, ${configuredCount} configured.`);
    console.log("    Add missing credentials to .env.local before deploying.");
  }
  console.log("-------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("CLI Health Check Failed:", err);
  process.exit(1);
});
