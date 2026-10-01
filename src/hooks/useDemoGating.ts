// ============================================================================
// hooks/useDemoGating.ts
//
// Central hook for demo account feature gating.
// Checks if the current user is a demo/personal account and returns
// boolean flags for every gated feature across the dashboard.
//
// Used by: dashboard layout (sidebar locks, watermark), home screen,
//          agent manager (model gating), CRM (contact cap), etc.
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface DemoGatingState {
  /** True while loading the user's accountType from Firestore */
  isLoading: boolean;

  /** True if the user is a demo/personal account */
  isDemo: boolean;

  /** Gated features — true means ALLOWED */
  canUseAgentManager: boolean;     // Yes, but Nemotron only
  canUseCRM: boolean;              // Yes, 100 contact cap
  canUseActionBoard: boolean;      // Yes, no email reminders
  canUseTimesheets: boolean;       // Yes
  canUseAIBrain: boolean;          // Guided profile only
  canUseDocUpload: boolean;        // No (costs tokens)
  canUseOrgBrain: boolean;         // No (needs org)
  canUseGmail: boolean;            // No
  canUseCampaigning: boolean;      // No
  canUseBI: boolean;               // No
  canUseYouTube: boolean;          // No
  canUseGrants: boolean;           // No
  canUseOnboarding: boolean;       // No
  canUseDM: boolean;               // No
  canUseQuickBooks: boolean;       // No
  canUsePremiumModels: boolean;    // No
}

const DEMO_STATE: DemoGatingState = {
  isLoading: false,
  isDemo: true,
  canUseAgentManager: true,
  canUseCRM: true,
  canUseActionBoard: true,
  canUseTimesheets: true,
  canUseAIBrain: true,
  canUseDocUpload: false,
  canUseOrgBrain: false,
  canUseGmail: false,
  canUseCampaigning: false,
  canUseBI: false,
  canUseYouTube: false,
  canUseGrants: false,
  canUseOnboarding: false,
  canUseDM: false,
  canUseQuickBooks: false,
  canUsePremiumModels: false,
};

const FULL_ACCESS_STATE: DemoGatingState = {
  isLoading: false,
  isDemo: false,
  canUseAgentManager: true,
  canUseCRM: true,
  canUseActionBoard: true,
  canUseTimesheets: true,
  canUseAIBrain: true,
  canUseDocUpload: true,
  canUseOrgBrain: true,
  canUseGmail: true,
  canUseCampaigning: true,
  canUseBI: true,
  canUseYouTube: true,
  canUseGrants: true,
  canUseOnboarding: true,
  canUseDM: true,
  canUseQuickBooks: true,
  canUsePremiumModels: true,
};

const LOADING_STATE: DemoGatingState = {
  isLoading: true,
  isDemo: false,
  canUseAgentManager: true,
  canUseCRM: true,
  canUseActionBoard: true,
  canUseTimesheets: true,
  canUseAIBrain: true,
  canUseDocUpload: true,
  canUseOrgBrain: true,
  canUseGmail: true,
  canUseCampaigning: true,
  canUseBI: true,
  canUseYouTube: true,
  canUseGrants: true,
  canUseOnboarding: true,
  canUseDM: true,
  canUseQuickBooks: true,
  canUsePremiumModels: true,
};

/**
 * Central hook for demo account feature gating.
 *
 * Uses the current user's Firestore `accountType` field to determine
 * if they are a demo user. Caches the result in sessionStorage for
 * performance across page navigations.
 */
export function useDemoGating(): DemoGatingState {
  const { user } = useUser();
  const firestore = useFirestore();
  const [state, setState] = useState<DemoGatingState>(LOADING_STATE);

  useEffect(() => {
    if (!user?.uid || !firestore) {
      setState(LOADING_STATE);
      return;
    }

    // Fast path: check sessionStorage cache first
    const cached = sessionStorage.getItem(`demo_gating_${user.uid}`);
    if (cached === 'demo') {
      setState(DEMO_STATE);
      return;
    }
    if (cached === 'org_member') {
      setState(FULL_ACCESS_STATE);
      return;
    }

    // Fetch from Firestore
    getDoc(doc(firestore, 'users', user.uid))
      .then((snap) => {
        const data = snap.data();
        const accountType = data?.accountType;
        const org = data?.organization;

        if (accountType === 'demo' || org === 'personal') {
          sessionStorage.setItem(`demo_gating_${user.uid}`, 'demo');
          setState(DEMO_STATE);
        } else {
          sessionStorage.setItem(`demo_gating_${user.uid}`, 'org_member');
          setState(FULL_ACCESS_STATE);
        }
      })
      .catch(() => {
        // On error, default to full access (don't lock out existing users)
        setState(FULL_ACCESS_STATE);
      });
  }, [user?.uid, firestore]);

  return state;
}

/**
 * Quick check if an orgId represents a demo/personal account.
 * Can be used without the hook in components that already have the orgId.
 */
export function isDemoOrg(orgId: string): boolean {
  return orgId === 'personal' || orgId === 'demo';
}
