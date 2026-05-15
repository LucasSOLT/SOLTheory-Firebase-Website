import { create } from "zustand";
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, Unsubscribe, Firestore,
} from "firebase/firestore";

/* ─────────────── TYPES ─────────────── */

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthday: string;
  leadStatus: "Cold Lead" | "Warm Lead" | "Interested" | "Sale Completed";
  tags: string[];
  totalRevenue: number;
  aiNotes: string;
  transactions: Transaction[];
  outstandingBalance: number;
}

export interface Meeting {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  date: string;
  time: string;
  syncToGoogle: boolean;
  createdBy: "user" | "jarvis";
}

export interface CrmNotification {
  id: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: "meeting" | "status" | "info";
}

export type InboxChannel = "email" | "imessage" | "whatsapp";
export type TicketStatus = "Open Issue" | "Pending" | "Resolved";

export interface InboxMessage {
  id: string;
  sender: "customer" | "agent";
  text: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  customerName: string;
  channel: InboxChannel;
  lastMessage: string;
  lastTimestamp: Date;
  unread: boolean;
  ticketStatus: TicketStatus;
  messages: InboxMessage[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "jarvis";
  content: string;
  timestamp: Date;
}

export interface CrmTag {
  name: string;
  color: string;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

/* ─────────────── HELPERS ─────────────── */

/** Get the Firestore sub-collection path for a user */
const crmPath = (uid: string, sub: string) => `users/${uid}/${sub}`;

/** Convert Firestore doc data to typed object, handling Timestamps */
function docToCustomer(data: Record<string, unknown>, id: string): Customer {
  return {
    id,
    firstName: (data.firstName as string) || "",
    lastName: (data.lastName as string) || "",
    phone: (data.phone as string) || "",
    email: (data.email as string) || "",
    birthday: (data.birthday as string) || "",
    leadStatus: (data.leadStatus as Customer["leadStatus"]) || "Cold Lead",
    tags: (data.tags as string[]) || [],
    totalRevenue: (data.totalRevenue as number) || 0,
    aiNotes: (data.aiNotes as string) || "",
    transactions: (data.transactions as Transaction[]) || [],
    outstandingBalance: (data.outstandingBalance as number) || 0,
  };
}

/* ─────────────── INITIAL DATA ─────────────── */

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1", customerName: "John Doe", channel: "email",
    lastMessage: "Hi, I wanted to follow up on our proposal. Are we still on for Tuesday?",
    lastTimestamp: new Date(Date.now() - 1000 * 60 * 12), unread: true, ticketStatus: "Open Issue",
    messages: [
      { id: "m1", sender: "customer", text: "Hi there! I received the quote you sent over. Looks great.", timestamp: new Date(Date.now() - 1000 * 60 * 60) },
      { id: "m2", sender: "agent", text: "Glad to hear it, John! Let me know if you have any questions.", timestamp: new Date(Date.now() - 1000 * 60 * 45) },
      { id: "m3", sender: "customer", text: "Hi, I wanted to follow up on our proposal. Are we still on for Tuesday?", timestamp: new Date(Date.now() - 1000 * 60 * 12) },
    ]
  },
  {
    id: "conv-2", customerName: "Sarah Miller", channel: "whatsapp",
    lastMessage: "Thanks for the quick response! 🙏",
    lastTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), unread: true, ticketStatus: "Pending",
    messages: [
      { id: "m4", sender: "customer", text: "Hey, I'm having trouble with the onboarding process.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) },
      { id: "m5", sender: "agent", text: "I'm sorry to hear that! Can you tell me what step you're stuck on?", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.5) },
      { id: "m6", sender: "customer", text: "Thanks for the quick response! 🙏", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    ]
  },
  {
    id: "conv-3", customerName: "Mike Johnson", channel: "imessage",
    lastMessage: "Perfect, see you then.",
    lastTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), unread: false, ticketStatus: "Resolved",
    messages: [
      { id: "m7", sender: "agent", text: "Hi Mike, just confirming our meeting for tomorrow at 3pm.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25) },
      { id: "m8", sender: "customer", text: "Perfect, see you then.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) },
    ]
  },
];

const INITIAL_TAGS: CrmTag[] = [
  { name: "VIP", color: "#f59e0b" },
  { name: "Enterprise", color: "#8b5cf6" },
  { name: "Inbound", color: "#0ea5e9" },
  { name: "Referral", color: "#10b981" },
  { name: "High-Value", color: "#f43f5e" },
];

const JARVIS_WELCOME: ChatMessage = {
  id: "welcome", role: "jarvis",
  content: "Hello! I'm Jarvis, your CRM Copilot. I can look up contacts, create new ones, change statuses, delete records, add AI notes, and schedule meetings. Try something like:\n\n• \"Show me all contacts\"\n• \"Add contact Jane Doe jane@test.com\"\n• \"Set Jane Doe to Interested\"\n• \"Delete Jane Doe\"\n• \"Analyze Jane Doe: Highly engaged with product demos\"\n• \"Schedule a meeting with Jane Doe for 2026-06-01 at 6pm\"",
  timestamp: new Date()
};

/* ─────────────── STORE INTERFACE ─────────────── */

interface CrmStore {
  /* ── Data ── */
  customers: Customer[];
  meetings: Meeting[];
  notifications: CrmNotification[];
  conversations: Conversation[];
  chatMessages: ChatMessage[];
  customTags: CrmTag[];
  integrations: { googleCalendar: string; mailProvider: string; whatsapp: string };
  toasts: Toast[];

  /* ── Firebase refs ── */
  _db: Firestore | null;
  _uid: string | null;
  _unsubContacts: Unsubscribe | null;
  _unsubMeetings: Unsubscribe | null;

  /* ── Loading flags ── */
  isLoading: boolean;
  isAddingContact: boolean;
  isUpdatingStatus: boolean;
  isDeducing: boolean;
  isSendingReply: boolean;

  /* ── Lifecycle ── */
  initializeStore: (db: Firestore, uid: string) => Promise<void>;
  teardown: () => void;

  /* ── Async Actions ── */
  addContact: (customer: Customer) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  updateStatus: (id: string, status: Customer["leadStatus"]) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;

  addMeeting: (meeting: Omit<Meeting, "id">) => Promise<Meeting>;
  addNotification: (message: string, type?: CrmNotification["type"]) => void;
  markNotificationsRead: () => void;

  sendInboxReply: (convId: string, text: string) => Promise<void>;
  updateTicketStatus: (convId: string, status: TicketStatus) => void;
  markConversationRead: (convId: string) => void;

  addJarvisMessage: (msg: ChatMessage) => void;
  runDeduction: (customerId: string) => Promise<void>;

  setCustomTags: (tags: CrmTag[] | ((prev: CrmTag[]) => CrmTag[])) => void;
  setIntegrations: (integrations: { googleCalendar: string; mailProvider: string; whatsapp: string }) => void;

  /* Direct setters (for Jarvis command compat) */
  setCustomers: (fn: (prev: Customer[]) => Customer[]) => void;

  /* ── Toasts ── */
  showToast: (message: string, type?: Toast["type"]) => void;
  dismissToast: (id: string) => void;
}

/* ─────────────── STORE IMPLEMENTATION ─────────────── */

export const useCRMStore = create<CrmStore>((set, get) => ({
  /* ── Initial State ── */
  customers: [],
  meetings: [],
  notifications: [],
  conversations: INITIAL_CONVERSATIONS,
  chatMessages: [JARVIS_WELCOME],
  customTags: INITIAL_TAGS,
  integrations: { googleCalendar: "", mailProvider: "", whatsapp: "" },
  toasts: [],

  _db: null,
  _uid: null,
  _unsubContacts: null,
  _unsubMeetings: null,

  isLoading: true,
  isAddingContact: false,
  isUpdatingStatus: false,
  isDeducing: false,
  isSendingReply: false,

  /* ── Initialize with real Firestore ── */
  initializeStore: async (db, uid) => {
    // Teardown previous listeners if re-initializing
    get().teardown();
    set({ isLoading: true, _db: db, _uid: uid });
    console.log("[CRM Store] Initializing Firestore for UID:", uid);

    try {
      // Set up real-time listener for contacts
      const contactsRef = collection(db, crmPath(uid, "contacts"));
      const unsubContacts = onSnapshot(
        query(contactsRef),
        (snapshot) => {
          const customers = snapshot.docs.map(d => docToCustomer(d.data(), d.id));
          set({ customers, isLoading: false });
        },
        (error) => {
          console.error("CRM contacts snapshot error:", error);
          set({ isLoading: false });
          get().showToast("⚠️ Error loading contacts", "error");
        }
      );

      // Set up real-time listener for meetings
      const meetingsRef = collection(db, crmPath(uid, "meetings"));
      const unsubMeetings = onSnapshot(
        query(meetingsRef),
        (snapshot) => {
          const meetings = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              customerId: data.customerId || "",
              customerName: data.customerName || "",
              title: data.title || "",
              date: data.date || "",
              time: data.time || "",
              syncToGoogle: data.syncToGoogle || false,
              createdBy: data.createdBy || "user",
            } as Meeting;
          });
          set({ meetings });
        },
        (error) => {
          console.error("CRM meetings snapshot error:", error);
        }
      );

      set({ _unsubContacts: unsubContacts, _unsubMeetings: unsubMeetings });
    } catch (error) {
      console.error("CRM initializeStore error:", error);
      set({ isLoading: false });
      get().showToast("⚠️ Failed to connect to database", "error");
    }
  },

  teardown: () => {
    const { _unsubContacts, _unsubMeetings } = get();
    if (_unsubContacts) _unsubContacts();
    if (_unsubMeetings) _unsubMeetings();
    set({ _unsubContacts: null, _unsubMeetings: null });
  },

  /* ── Contact CRUD (Firestore) ── */
  addContact: async (customer) => {
    const { _db, _uid } = get();
    if (!_db || !_uid) {
      console.error("addContact: Firestore not initialized", { _db: !!_db, _uid });
      get().showToast("⚠️ Database not connected. Please refresh.", "error");
      return;
    }
    set({ isAddingContact: true });
    try {
      await setDoc(doc(_db, crmPath(_uid, "contacts"), customer.id), {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        birthday: customer.birthday,
        leadStatus: customer.leadStatus,
        tags: customer.tags,
        totalRevenue: customer.totalRevenue,
        aiNotes: customer.aiNotes,
        transactions: customer.transactions,
        outstandingBalance: customer.outstandingBalance,
      });
      // onSnapshot will update local state automatically
      get().showToast(`✅ ${customer.firstName} ${customer.lastName} added successfully`);
    } catch (error) {
      console.error("addContact error:", error);
      get().showToast("⚠️ Failed to add contact", "error");
    }
    set({ isAddingContact: false });
  },

  updateCustomer: async (id, updates) => {
    const { _db, _uid } = get();
    if (!_db || !_uid) return;
    try {
      await updateDoc(doc(_db, crmPath(_uid, "contacts"), id), updates as Record<string, unknown>);
    } catch (error) {
      console.error("updateCustomer error:", error);
      get().showToast("⚠️ Failed to update contact", "error");
    }
  },

  deleteContact: async (id) => {
    const { _db, _uid } = get();
    if (!_db || !_uid) return;
    const customer = get().customers.find(c => c.id === id);
    try {
      await deleteDoc(doc(_db, crmPath(_uid, "contacts"), id));
      if (customer) get().showToast(`🗑️ ${customer.firstName} ${customer.lastName} removed`);
    } catch (error) {
      console.error("deleteContact error:", error);
      get().showToast("⚠️ Failed to delete contact", "error");
    }
  },

  updateStatus: async (id, status) => {
    const { _db, _uid } = get();
    if (!_db || !_uid) return;
    set({ isUpdatingStatus: true });
    try {
      await updateDoc(doc(_db, crmPath(_uid, "contacts"), id), { leadStatus: status });
      get().showToast(`📊 Status updated to ${status}`);
    } catch (error) {
      console.error("updateStatus error:", error);
      get().showToast("⚠️ Failed to update status", "error");
    }
    set({ isUpdatingStatus: false });
  },

  bulkDelete: async (ids) => {
    const { _db, _uid } = get();
    if (!_db || !_uid) return;
    try {
      await Promise.all(ids.map(id => deleteDoc(doc(_db, crmPath(_uid, "contacts"), id))));
      get().showToast(`🗑️ ${ids.length} contact(s) deleted`);
    } catch (error) {
      console.error("bulkDelete error:", error);
      get().showToast("⚠️ Failed to delete contacts", "error");
    }
  },

  /* Direct setter for Jarvis compat — also persists to Firestore */
  setCustomers: (fn) => {
    const { _db, _uid, customers } = get();
    const updated = fn(customers);
    set({ customers: updated });
    // Persist any changes to Firestore
    if (_db && _uid) {
      updated.forEach(c => {
        const original = customers.find(o => o.id === c.id);
        if (!original || JSON.stringify(original) !== JSON.stringify(c)) {
          const { id, ...data } = c;
          setDoc(doc(_db, crmPath(_uid, "contacts"), id), data).catch(console.error);
        }
      });
    }
  },

  /* ── Meetings (Firestore) ── */
  addMeeting: async (meetingData) => {
    const { _db, _uid } = get();
    const meeting: Meeting = { ...meetingData, id: `MTG-${Date.now()}` };
    if (_db && _uid) {
      try {
        const { id, ...data } = meeting;
        await setDoc(doc(_db, crmPath(_uid, "meetings"), id), data);
      } catch (error) {
        console.error("addMeeting error:", error);
        // Still add locally even if Firestore fails
        set(state => ({ meetings: [...state.meetings, meeting] }));
      }
    } else {
      set(state => ({ meetings: [...state.meetings, meeting] }));
    }
    get().addNotification(
      `📅 ${meeting.title} with ${meeting.customerName} scheduled for ${meeting.date} at ${meeting.time}${meeting.syncToGoogle ? " (synced to Google Calendar)" : ""}`,
      "meeting"
    );
    get().showToast(`📅 Meeting scheduled with ${meeting.customerName}`);
    return meeting;
  },

  /* ── Notifications (local — will persist when we add Firestore collection later) ── */
  addNotification: (message, type = "info") => {
    set(state => ({
      notifications: [{ id: `n-${Date.now()}`, message, timestamp: new Date(), read: false, type }, ...state.notifications],
    }));
  },

  markNotificationsRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
    }));
  },

  /* ── Inbox (local for now — real API integration later) ── */
  sendInboxReply: async (convId, text) => {
    set({ isSendingReply: true });
    await new Promise<void>(res => setTimeout(res, 300));
    const msg: InboxMessage = { id: `im-${Date.now()}`, sender: "agent", text, timestamp: new Date() };
    set(state => ({
      conversations: state.conversations.map(c =>
        c.id === convId ? { ...c, messages: [...c.messages, msg], lastMessage: text, lastTimestamp: msg.timestamp } : c
      ),
      isSendingReply: false,
    }));
  },

  updateTicketStatus: (convId, status) => {
    set(state => ({
      conversations: state.conversations.map(c => c.id === convId ? { ...c, ticketStatus: status } : c),
    }));
    get().showToast(`🎫 Ticket status updated to ${status}`);
  },

  markConversationRead: (convId) => {
    set(state => ({
      conversations: state.conversations.map(c => c.id === convId ? { ...c, unread: false } : c),
    }));
  },

  /* ── Jarvis ── */
  addJarvisMessage: (msg) => {
    set(state => ({ chatMessages: [...state.chatMessages, msg] }));
  },

  runDeduction: async (customerId) => {
    set({ isDeducing: true });
    await new Promise<void>(res => setTimeout(res, 1500));
    const c = get().customers.find(x => x.id === customerId);
    if (!c) { set({ isDeducing: false }); return; }

    const statusInsight = c.leadStatus === "Sale Completed"
      ? "This is a closed deal — consider upselling or referral outreach."
      : c.leadStatus === "Interested"
        ? "Client is actively interested. High probability of closing if followed up this week."
        : c.leadStatus === "Warm Lead"
          ? "Engagement signals are positive. Recommend scheduling a demo or consultation."
          : "Lead is cold — consider a re-engagement email campaign or personalized outreach.";
    const revenueInsight = c.totalRevenue > 5000
      ? `High-value client ($${c.totalRevenue.toFixed(2)} lifetime). Prioritize retention.`
      : c.totalRevenue > 0
        ? `Client has spent $${c.totalRevenue.toFixed(2)}. Moderate engagement — room for growth.`
        : "No revenue recorded yet. Focus on conversion and first purchase.";
    const tagInsight = c.tags.length > 0
      ? `Tagged as ${c.tags.join(", ")} — ${c.tags.includes("VIP") ? "VIP treatment recommended." : "standard engagement track."}`
      : "No tags assigned. Consider segmenting this contact.";
    const txCount = c.transactions.length;
    const txInsight = txCount > 3
      ? `${txCount} transactions recorded — highly active buyer pattern.`
      : txCount > 0
        ? `${txCount} transaction(s) on record. Moderate purchase activity.`
        : "No transaction history. Nurture with targeted offers.";
    const balanceInsight = c.outstandingBalance > 0
      ? `⚠️ Outstanding balance of $${c.outstandingBalance.toFixed(2)} needs attention.`
      : "No outstanding balances — account in good standing.";

    const deduction = `Jarvis Deduction (${new Date().toLocaleDateString()}):\n📊 ${revenueInsight}\n🎯 ${statusInsight}\n🏷️ ${tagInsight}\n💳 ${txInsight}\n${balanceInsight}`;

    // Update locally + persist to Firestore
    const { _db, _uid } = get();
    const newNotes = c.aiNotes ? c.aiNotes + "\n\n" + deduction : deduction;
    set(state => ({
      customers: state.customers.map(x => x.id === customerId
        ? { ...x, aiNotes: newNotes }
        : x
      ),
      isDeducing: false,
    }));
    if (_db && _uid) {
      updateDoc(doc(_db, crmPath(_uid, "contacts"), customerId), { aiNotes: newNotes }).catch(console.error);
    }
    get().showToast("🧠 Jarvis deduction complete");
  },

  /* ── Settings ── */
  setCustomTags: (tags) => {
    if (typeof tags === "function") {
      set(state => ({ customTags: tags(state.customTags) }));
    } else {
      set({ customTags: tags });
    }
  },
  setIntegrations: (integrations) => set({ integrations }),

  /* ── Toasts ── */
  showToast: (message, type = "success") => {
    const id = `toast-${Date.now()}`;
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },

  dismissToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
}));
