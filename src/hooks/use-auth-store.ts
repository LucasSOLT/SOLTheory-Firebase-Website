import { create } from 'zustand';

interface AuthStore {
  isAuthDialogOpen: boolean;
  isProfileSetupDialogOpen: boolean;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
  openProfileSetupDialog: () => void;
  closeProfileSetupDialog: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthDialogOpen: false,
  isProfileSetupDialogOpen: false,
  openAuthDialog: () => set({ isAuthDialogOpen: true }),
  closeAuthDialog: () => set({ isAuthDialogOpen: false }),
  openProfileSetupDialog: () => set({ isProfileSetupDialogOpen: true }),
  closeProfileSetupDialog: () => set({ isProfileSetupDialogOpen: false }),
}));
