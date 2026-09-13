/**
 * feature-flags.ts — Centralized Feature Flag Configuration
 * 
 * Controls which features are active (Tier 1 Core) vs gated (Tier 2 Beta).
 * Tier 1 features are always enabled. Tier 2 features default to enabled
 * but can be disabled via environment variables.
 * 
 * Usage:
 *   import { FEATURE_FLAGS } from '@/lib/feature-flags';
 *   if (FEATURE_FLAGS.crm) { ... }
 */

export interface FeatureFlagConfig {
  /** ─── Tier 1: Core Pilot Features (Always Enabled) ─── */
  aiChat: boolean;
  grantProspecting: boolean;
  timesheets: boolean;
  actionBoard: boolean;
  aiBrain: boolean;
  walkthroughs: boolean;

  /** ─── Tier 2: Beta Features (Controllable) ─── */
  crm: boolean;
  socialCampaigning: boolean;
  youtubeDirector: boolean;
  gmail: boolean;
  businessIntelligence: boolean;

  /** ─── Legacy / Disabled ─── */
  googleWorkspaceTools: boolean;
  surveys: boolean;
  googleAds: boolean;

  /** ─── Migration & INSiGHT Flags ─── */
  /** When true, signals that all INSiGHT features are live on Supabase
   *  and Firebase can be fully severed. Set NEXT_PUBLIC_FIREBASE_TEARDOWN_READY=true
   *  in .env.local when ready. */
  firebaseTeardownReady: boolean;
  /** INSiGHT Dual Chat UI (User-scope vs Org-scope) */
  insightDualChat: boolean;
}

export const FEATURE_FLAGS: FeatureFlagConfig = {
  // ─── Tier 1: Always On ───
  aiChat: true,
  grantProspecting: true,
  timesheets: true,
  actionBoard: true,
  aiBrain: true,
  walkthroughs: true,

  // ─── Tier 2: Beta (env-controllable, default ON) ───
  crm: process.env.NEXT_PUBLIC_ENABLE_CRM !== 'false',
  socialCampaigning: process.env.NEXT_PUBLIC_ENABLE_CAMPAIGNING !== 'false',
  youtubeDirector: process.env.NEXT_PUBLIC_ENABLE_YOUTUBE !== 'false',
  gmail: process.env.NEXT_PUBLIC_ENABLE_GMAIL !== 'false',
  businessIntelligence: process.env.NEXT_PUBLIC_ENABLE_BI !== 'false',

  // ─── Legacy: Always Off ───
  googleWorkspaceTools: false,
  surveys: false,
  googleAds: false,

  // ─── Migration & INSiGHT ───
  firebaseTeardownReady: process.env.NEXT_PUBLIC_FIREBASE_TEARDOWN_READY === 'true',
  insightDualChat: process.env.NEXT_PUBLIC_ENABLE_INSIGHT_DUAL_CHAT === 'true',
};

/** Helper: Check if a feature is in beta (Tier 2) */
export function isBetaFeature(key: keyof FeatureFlagConfig): boolean {
  return ['crm', 'socialCampaigning', 'youtubeDirector', 'gmail', 'businessIntelligence'].includes(key);
}

/** Helper: Get all enabled features */
export function getEnabledFeatures(): (keyof FeatureFlagConfig)[] {
  return (Object.keys(FEATURE_FLAGS) as (keyof FeatureFlagConfig)[]).filter(
    (key) => FEATURE_FLAGS[key]
  );
}
