import { create } from 'zustand';

interface AuthStore {
  isAuthDialogOpen: boolean;
  isProfileSetupDialogOpen: boolean;
  redirectPath: string | null;
  defaultToRegister: boolean;
  openAuthDialog: (redirectPath?: string, defaultToRegister?: boolean) => void;
  closeAuthDialog: () => void;
  openProfileSetupDialog: () => void;
  closeProfileSetupDialog: () => void;
  setRedirectPath: (path: string | null) => void;
  setDefaultToRegister: (isDefault: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthDialogOpen: false,
  isProfileSetupDialogOpen: false,
  redirectPath: null,
  defaultToRegister: false,
  openAuthDialog: (redirectPath, defaultToRegister = false) => set({ isAuthDialogOpen: true, redirectPath: redirectPath || null, defaultToRegister }),
  closeAuthDialog: () => set({ isAuthDialogOpen: false }),
  openProfileSetupDialog: () => set({ isProfileSetupDialogOpen: true }),
  closeProfileSetupDialog: () => set({ isProfileSetupDialogOpen: false }),
  setRedirectPath: (path) => set({ redirectPath: path }),
  setDefaultToRegister: (isDefault) => set({ defaultToRegister: isDefault }),
}));
