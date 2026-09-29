import { create } from "zustand";

export type CommsTab = "dm" | "channels" | "sms" | "contacts";

interface CommsState {
  // Navigation & Active View
  activeTab: CommsTab;
  setActiveTab: (tab: CommsTab) => void;

  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;

  // Unread badge counters
  unreadDmCount: number;
  unreadChannelCount: number;
  unreadSmsCount: number;
  setUnreadCounts: (counts: Partial<{ dm: number; channels: number; sms: number }>) => void;
  totalUnreadCount: () => number;

  // Real-time typing indicators (chatId -> array of user names/emails typing)
  typingMap: Record<string, string[]>;
  setTyping: (chatId: string, user: string, isTyping: boolean) => void;

  // Per-conversation message drafts (chatId -> text)
  drafts: Record<string, string>;
  setDraft: (chatId: string, text: string) => void;
  clearDraft: (chatId: string) => void;

  // Global search query
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useCommsStore = create<CommsState>((set, get) => ({
  activeTab: "dm",
  setActiveTab: (activeTab) => set({ activeTab }),

  activeChatId: null,
  setActiveChatId: (activeChatId) => set({ activeChatId }),

  unreadDmCount: 0,
  unreadChannelCount: 0,
  unreadSmsCount: 0,
  setUnreadCounts: (counts) =>
    set((state) => ({
      unreadDmCount: counts.dm !== undefined ? counts.dm : state.unreadDmCount,
      unreadChannelCount: counts.channels !== undefined ? counts.channels : state.unreadChannelCount,
      unreadSmsCount: counts.sms !== undefined ? counts.sms : state.unreadSmsCount,
    })),
  totalUnreadCount: () => {
    const { unreadDmCount, unreadChannelCount, unreadSmsCount } = get();
    return unreadDmCount + unreadChannelCount + unreadSmsCount;
  },

  typingMap: {},
  setTyping: (chatId, user, isTyping) =>
    set((state) => {
      const current = state.typingMap[chatId] || [];
      const updated = isTyping
        ? Array.from(new Set([...current, user]))
        : current.filter((u) => u !== user);
      return {
        typingMap: {
          ...state.typingMap,
          [chatId]: updated,
        },
      };
    }),

  drafts: {},
  setDraft: (chatId, text) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [chatId]: text,
      },
    })),
  clearDraft: (chatId) =>
    set((state) => {
      const nextDrafts = { ...state.drafts };
      delete nextDrafts[chatId];
      return { drafts: nextDrafts };
    }),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
