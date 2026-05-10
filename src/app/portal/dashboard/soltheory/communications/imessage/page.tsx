"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, setDoc, addDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import {
  Send,
  MessageCircle,
  Search,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Circle,
  CheckCheck,
  Phone,
  Plus,
  Wifi,
  AlertTriangle,
  Smartphone,
} from "lucide-react";

type Conversation = {
  contact: string;
  lastMessage: string;
  lastTime: string;
  direction: string;
  unreadCount: number;
  messageCount: number;
};

type Message = {
  id: string;
  from: string;
  to: string;
  body: string;
  direction: string;
  createdAt: string;
  read: boolean;
  mediaUrls?: string[];
};

export default function IMessagePage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isProvisioned, setIsProvisioned] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newContactNumber, setNewContactNumber] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingConvos, setIsLoadingConvos] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState("");
  const [setupNumber, setSetupNumber] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user has a Twilio number
  useEffect(() => {
    if (!user?.uid || !firestore) return;
    getDoc(doc(firestore, "users", user.uid)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.twilioPhoneNumber) {
          setPhoneNumber(data.twilioPhoneNumber);
          setIsProvisioned(true);
        } else {
          setIsProvisioned(false);
        }
      } else {
        setIsProvisioned(false);
      }
    });
  }, [user?.uid, firestore]);

  // Load conversations from client-side Firestore
  const loadConversations = useCallback(async () => {
    if (!user?.uid || !firestore) return;
    setIsLoadingConvos(true);
    setError("");
    try {
      const q = query(
        collection(firestore, "users", user.uid, "sms_messages"),
        orderBy("createdAt", "desc"),
        limit(500)
      );
      const snapshot = await getDocs(q);
      const convMap = new Map<string, Conversation>();
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const contact = data.direction === "inbound" ? data.from : data.to;
        if (!convMap.has(contact)) {
          convMap.set(contact, {
            contact,
            lastMessage: data.body || (data.mediaUrls?.length ? "📎 Media" : ""),
            lastTime: data.createdAt,
            direction: data.direction,
            unreadCount: 0,
            messageCount: 0,
          });
        }
        const conv = convMap.get(contact)!;
        conv.messageCount++;
        if (data.direction === "inbound" && !data.read) conv.unreadCount++;
      });
      const sorted = Array.from(convMap.values()).sort(
        (a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
      );
      setConversations(sorted);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingConvos(false);
    }
  }, [user?.uid, firestore]);

  useEffect(() => {
    if (isProvisioned) loadConversations();
  }, [isProvisioned, loadConversations]);

  // Load messages for a contact from client-side Firestore
  const loadMessages = useCallback(async (contact: string) => {
    if (!user?.uid || !firestore) return;
    setIsLoadingMessages(true);
    try {
      const q = query(
        collection(firestore, "users", user.uid, "sms_messages"),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const normalizedContact = contact.replace(/[^+\d]/g, "");
      let msgs: Message[] = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as Message))
        .filter((m) => m.from?.includes(normalizedContact) || m.to?.includes(normalizedContact))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(msgs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user?.uid, firestore]);

  useEffect(() => {
    if (activeContact) loadMessages(activeContact);
  }, [activeContact, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message — calls Twilio API, then saves to client-side Firestore
  const handleSend = async () => {
    const targetNumber = activeContact || (showNewConversation ? newContactNumber : null);
    if (!newMessage.trim() || !targetNumber || !user?.uid || !phoneNumber || !firestore) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: phoneNumber, to: targetNumber, message: newMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Save to Firestore client-side
      await addDoc(collection(firestore, "users", user.uid, "sms_messages"), {
        sid: data.sid,
        from: phoneNumber,
        to: data.to || targetNumber,
        body: newMessage,
        direction: "outbound",
        status: "sent",
        createdAt: new Date().toISOString(),
      });

      setNewMessage("");
      if (showNewConversation) {
        setShowNewConversation(false);
        const normalized = targetNumber.startsWith("+") ? targetNumber : "+1" + targetNumber.replace(/\D/g, "");
        setActiveContact(normalized);
        setNewContactNumber("");
      }
      if (activeContact) await loadMessages(activeContact);
      await loadConversations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  // Save a manually-entered Twilio number to Firestore
  const handleProvision = async () => {
    if (!user?.uid || !firestore || !setupNumber.trim()) return;
    setIsProvisioning(true);
    setError("");
    try {
      // Normalize: strip non-digits, add +1 if needed
      let normalized = setupNumber.replace(/[^+\d]/g, "");
      if (!normalized.startsWith("+")) normalized = "+1" + normalized;

      await setDoc(doc(firestore, "users", user.uid), {
        twilioPhoneNumber: normalized,
        twilioProvisionedAt: new Date().toISOString(),
      }, { merge: true });

      setPhoneNumber(normalized);
      setIsProvisioned(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProvisioning(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    return c.contact.includes(searchQuery) || c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const ONE_DAY = 86400000;
    if (diff < ONE_DAY) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 7 * ONE_DAY) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  // Not provisioned — setup screen
  if (isProvisioned === false) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Card className="bg-white border border-slate-200 shadow-xl max-w-lg w-full rounded-2xl">
          <CardContent className="p-10 text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Set Up Messaging</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Enter your Twilio phone number to start sending and receiving texts. Jarvis will be able to text people on your behalf.
              </p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-5 text-left space-y-3 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5" /> What You Get
              </p>
              <ul className="text-sm text-emerald-900 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>Send and receive texts from the <strong>dashboard</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>Ask <strong>Jarvis</strong> to text people by voice or chat</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>Works with <strong>any phone</strong> — iPhone or Android</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Your Twilio Phone Number</label>
              <Input
                placeholder="(720) 460-6822"
                value={setupNumber}
                onChange={(e) => setSetupNumber(e.target.value)}
                className="h-12 text-center text-lg font-mono !bg-white border-slate-200 rounded-xl !text-slate-900 placeholder:!text-slate-400"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              onClick={handleProvision}
              disabled={isProvisioning || !setupNumber.trim()}
              className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 text-base"
            >
              {isProvisioning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Phone className="w-5 h-5 mr-2" />
                  Activate Messaging
                </>
              )}
            </Button>
            <p className="text-[11px] text-slate-400">Enter the number from your Twilio console. Contact your admin if you don't have one.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isProvisioned === null) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-500">
      {/* Header — WhatsApp style */}
      <div className="flex items-center justify-between pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <span className="bg-gradient-to-r from-[#075E54] to-[#128C7E] bg-clip-text text-transparent">Messages</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
            Your number: <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">{formatPhoneDisplay(phoneNumber || "")}</span>
            <button onClick={() => { setIsProvisioned(false); setPhoneNumber(null); setSetupNumber(""); }} className="text-[11px] text-slate-400 hover:text-slate-600 underline">Change</button>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowNewConversation(true); setActiveContact(null); }}
            className="h-9 border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <Plus className="w-4 h-4 mr-1" /> New Message
          </Button>
          <div className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <Wifi className="w-3 h-3" />
            Active
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 font-bold">×</button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* Conversation List */}
        <Card className={`lg:col-span-4 bg-white border border-slate-200 flex flex-col overflow-hidden shadow-sm rounded-2xl ${(activeContact || showNewConversation) ? "hidden lg:flex" : "flex"}`}>
          <CardHeader className="border-b border-slate-100 pb-3 pt-4 px-4 space-y-3 bg-[#F0F2F5]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                Chats
                {conversations.length > 0 && (
                  <span className="text-xs bg-white text-slate-500 px-2 py-0.5 rounded-full">{conversations.length}</span>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={loadConversations} disabled={isLoadingConvos} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700">
                <RefreshCw className={`w-4 h-4 ${isLoadingConvos ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="Search or start new chat" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 !bg-white border-slate-200 rounded-lg text-sm !text-slate-900 placeholder:!text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto p-0">
            {isLoadingConvos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-6 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 mx-auto flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-400 text-sm">
                  {searchQuery ? "No matching conversations" : "No conversations yet"}
                </p>
                <Button variant="outline" size="sm" onClick={() => { setShowNewConversation(true); setActiveContact(null); }} className="text-slate-500 border-slate-300 hover:bg-slate-100 hover:text-slate-700">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Send your first message
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.contact}
                    onClick={() => { setActiveContact(conv.contact); setShowNewConversation(false); }}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-all cursor-pointer flex items-start gap-3 ${
                      activeContact === conv.contact ? "bg-emerald-50/60 border-l-2 border-emerald-500" : "border-l-2 border-transparent"
                    }`}
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-[#DFE5E7] text-[#54656F] text-xs font-bold">
                        {conv.contact.slice(-2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "text-slate-900" : "text-slate-700"}`}>
                          {formatPhoneDisplay(conv.contact)}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatTime(conv.lastTime)}</span>
                      </div>
                      <p className={`text-xs truncate leading-relaxed ${conv.unreadCount > 0 ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                        {conv.direction === "outbound" ? "You: " : ""}
                        {conv.lastMessage || "No messages"}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="bg-[#25D366] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-1">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className={`lg:col-span-8 bg-white border border-slate-200 flex flex-col overflow-hidden shadow-sm rounded-2xl ${(!activeContact && !showNewConversation) ? "hidden lg:flex" : "flex"}`}>
          {activeContact || showNewConversation ? (
            <>
              {/* Thread header — WhatsApp teal */}
              <div className="bg-[#F0F2F5] border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                <button onClick={() => { setActiveContact(null); setShowNewConversation(false); }} className="lg:hidden p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {showNewConversation ? (
                  <div className="flex-1 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Enter phone number (e.g. 555-123-4567)"
                        value={newContactNumber}
                        onChange={(e) => setNewContactNumber(e.target.value)}
                        className="h-9 border-slate-200 text-sm !bg-white !text-slate-900 placeholder:!text-slate-400"
                        autoFocus
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-[#DFE5E7] text-[#54656F] text-xs font-bold">
                        {activeContact?.slice(-2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{formatPhoneDisplay(activeContact || "")}</h3>
                      <p className="text-[10px] text-slate-400">SMS · {phoneNumber ? `from ${formatPhoneDisplay(phoneNumber)}` : ""}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => loadMessages(activeContact!)} disabled={isLoadingMessages} className="h-8 w-8 p-0 text-slate-400">
                      <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? "animate-spin" : ""}`} />
                    </Button>
                  </>
                )}
              </div>

              {/* Messages */}
              <div className="flex-grow overflow-y-auto p-4 space-y-3" style={{ backgroundColor: '#ECE5DD', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'1\' fill=\'%23d5cec3\' opacity=\'.3\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'200\' height=\'200\' fill=\'url(%23p)\'/%3E%3C/svg%3E")' }}>
                {showNewConversation ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2 py-12">
                    <MessageCircle className="w-10 h-10 text-emerald-300" />
                    <p className="text-sm font-medium">Start a new conversation</p>
                    <p className="text-xs">Enter a phone number above, type your message below</p>
                  </div>
                ) : isLoadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No messages in this conversation</div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.direction === "outbound";
                    const showTimestamp = i === 0 || new Date(msg.createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime() > 3600000;
                    return (
                      <div key={msg.id}>
                        {showTimestamp && (
                          <div className="text-center py-2">
                            <span className="text-[10px] bg-white/80 text-slate-400 px-3 py-1 rounded-full border border-slate-100 font-medium">
                              {new Date(msg.createdAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}{" "}
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] px-3 py-2 rounded-lg text-sm leading-relaxed shadow-sm ${
                            isMe
                              ? "bg-[#DCF8C6] text-slate-900 rounded-tr-none"
                              : "bg-white text-slate-900 rounded-tl-none"
                          }`}>
                            {msg.body || "📎 Media"}
                            <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : ""}`}>
                              <span className="text-[9px] text-slate-500">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isMe && <CheckCheck className="w-3 h-3 text-[#53BDEB]" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} className="h-1" />
              </div>

              {/* Send bar */}
              <div className="border-t border-slate-200 p-3 bg-[#F0F2F5]">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 !bg-white border-slate-200 rounded-full h-11 text-sm !text-slate-900 placeholder:!text-slate-400 px-5"
                    disabled={isSending}
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || isSending || (showNewConversation && !newContactNumber.trim())}
                    className="h-11 w-11 p-0 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full shadow-sm"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3 p-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-sm font-medium">Select a conversation to view messages</p>
              <p className="text-xs text-slate-400">Or ask Jarvis to send a text for you</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
