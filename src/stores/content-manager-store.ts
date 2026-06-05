'use client';

import { create } from 'zustand';
import { ALL_ORGS, OrgId } from '@/lib/admin';

interface ContentManagerState {
  active: boolean;
  selectedOrgs: OrgId[];
  setActive: (active: boolean) => void;
  toggleOrg: (orgId: OrgId) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

export const useContentManagerStore = create<ContentManagerState>((set) => ({
  active: false,
  selectedOrgs: ALL_ORGS.map(o => o.id) as OrgId[],
  setActive: (active) => set({ active }),
  toggleOrg: (orgId) =>
    set((state) => ({
      selectedOrgs: state.selectedOrgs.includes(orgId)
        ? state.selectedOrgs.filter((id) => id !== orgId)
        : [...state.selectedOrgs, orgId],
    })),
  selectAll: () => set({ selectedOrgs: ALL_ORGS.map(o => o.id) as OrgId[] }),
  deselectAll: () => set({ selectedOrgs: [] }),
}));
