import { create } from 'zustand';

interface AuthStore {
  isAuthDialogOpen: boolean;
  isProfileSetupDialogOpen: boolean;
  redirectPath: string | null;
  openAuthDialog: (redirectPath?: string) => void;
  closeAuthDialog: () => void;
  openProfileSetupDialog: () => void;
  closeProfileSetupDialog: () => void;
  setRedirectPath: (path: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthDialogOpen: false,
  isProfileSetupDialogOpen: false,
  redirectPath: null,
  openAuthDialog: (redirectPath) => set({ isAuthDialogOpen: true, redirectPath: redirectPath || null }),
  closeAuthDialog: () => set({ isAuthDialogOpen: false }),
  openProfileSetupDialog: () => set({ isProfileSetupDialogOpen: true }),
  closeProfileSetupDialog: () => set({ isProfileSetupDialogOpen: false }),
  setRedirectPath: (path) => set({ redirectPath: path }),
}));
