'use client';

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
}

export interface CampaignDraft {
  caption: string;
  scheduledDate: Date | null;
  campaignGoal: string;
  tone: string;
}

export interface ConnectedAccount {
  username: string;
  profilePictureUrl: string;
}

/**
 * Client-side representation of a scheduled post.
 * Mirrors the server-side `ScheduledInstagramPost` but uses `Date` instead of
 * Firestore `Timestamp` since Zustand state must be serialisable / usable in
 * React without Firestore SDK imports.
 */
export type ScheduledPostStatus =
  | 'draft'
  | 'scheduled'
  | 'processing'
  | 'published'
  | 'failed';

export interface ScheduledPost {
  id: string;
  clientId: string;
  mediaItemUrls: string[];
  caption: string;
  scheduledTime: Date;
  status: ScheduledPostStatus;
  metaContainerId: string | null;
  metaMediaId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Store Shape
// ---------------------------------------------------------------------------

interface InstagramState {
  // ── Media selection ──
  selectedMedia: MediaItem[];
  setSelectedMedia: (mediaArray: MediaItem[]) => void;
  toggleMediaSelection: (mediaItem: MediaItem) => void;
  clearSelectedMedia: () => void;

  // ── Campaign draft ──
  campaignDraft: CampaignDraft;
  updateDraft: (updates: Partial<CampaignDraft>) => void;

  // ── Connection ──
  isConnected: boolean;
  connectedAccount: ConnectedAccount | null;
  setConnectionStatus: (connected: boolean, accountData?: ConnectedAccount | null) => void;

  // ── Scheduled posts ──
  scheduledPosts: ScheduledPost[];
  setScheduledPosts: (posts: ScheduledPost[]) => void;

  // ── UI state ──
  isLoading: boolean;
  setLoading: (loadingStatus: boolean) => void;
  error: string | null;
  setError: (message: string | null) => void;
}

// ---------------------------------------------------------------------------
// Default Values
// ---------------------------------------------------------------------------

const DEFAULT_DRAFT: CampaignDraft = {
  caption: '',
  scheduledDate: null,
  campaignGoal: '',
  tone: '',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useInstagramStore = create<InstagramState>((set) => ({
  // ── Media selection ──────────────────────────────────────────────────────
  selectedMedia: [],

  setSelectedMedia: (mediaArray) => set({ selectedMedia: mediaArray }),

  toggleMediaSelection: (mediaItem) =>
    set((state) => {
      const exists = state.selectedMedia.some((m) => m.id === mediaItem.id);
      return {
        selectedMedia: exists
          ? state.selectedMedia.filter((m) => m.id !== mediaItem.id)
          : [...state.selectedMedia, mediaItem],
      };
    }),

  clearSelectedMedia: () => set({ selectedMedia: [] }),

  // ── Campaign draft ───────────────────────────────────────────────────────
  campaignDraft: { ...DEFAULT_DRAFT },

  updateDraft: (updates) =>
    set((state) => ({
      campaignDraft: { ...state.campaignDraft, ...updates },
    })),

  // ── Connection ───────────────────────────────────────────────────────────
  isConnected: false,
  connectedAccount: null,

  setConnectionStatus: (connected, accountData) =>
    set({
      isConnected: connected,
      connectedAccount: connected ? (accountData ?? null) : null,
    }),

  // ── Scheduled posts ──────────────────────────────────────────────────────
  scheduledPosts: [],

  setScheduledPosts: (posts) => set({ scheduledPosts: posts }),

  // ── UI state ─────────────────────────────────────────────────────────────
  isLoading: false,
  setLoading: (loadingStatus) => set({ isLoading: loadingStatus }),

  error: null,
  setError: (message) => set({ error: message }),
}));
