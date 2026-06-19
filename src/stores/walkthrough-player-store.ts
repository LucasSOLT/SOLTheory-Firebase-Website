'use client';

import { create } from 'zustand';

export type Corner = 'br' | 'bl' | 'tr' | 'tl';

interface WalkthroughPlayerState {
  /** Currently playing video info, or null if no video is active */
  video: { url: string; title: string; thumbnailUrl: string } | null;
  /** Whether the player is in mini PiP mode */
  isMinimized: boolean;
  /** Which corner the mini player snaps to */
  corner: Corner;
  /** Open the player with a video */
  playVideo: (url: string, title: string, thumbnailUrl: string) => void;
  /** Close the player entirely */
  closeVideo: () => void;
  /** Toggle between full-size and mini mode */
  toggleMinimize: () => void;
  /** Set which corner the PiP snaps to */
  setCorner: (corner: Corner) => void;
}

export const useWalkthroughPlayerStore = create<WalkthroughPlayerState>((set) => ({
  video: null,
  isMinimized: false,
  corner: 'br',
  playVideo: (url, title, thumbnailUrl) =>
    set({ video: { url, title, thumbnailUrl }, isMinimized: false }),
  closeVideo: () => set({ video: null, isMinimized: false, corner: 'br' }),
  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),
  setCorner: (corner) => set({ corner }),
}));
