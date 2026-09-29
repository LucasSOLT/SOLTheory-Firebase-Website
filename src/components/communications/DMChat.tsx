"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFirestore, useUser, useStorage } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection, query, where, onSnapshot, addDoc, serverTimestamp,
  orderBy, updateDoc, doc, deleteDoc, arrayUnion, arrayRemove
} from "firebase/firestore";
import {
  Send, UserCircle, Plus, Search, MessageSquareX, Paperclip, X, Wrench,
  Smile, Reply, Mic, Check, CheckCheck, Clock, ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { playMessageSendSound } from "@/lib/send-sound";
import { logActivity } from "@/lib/activity-logger";
import { useTranslation } from "@/lib/i18n";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { VoiceNotePlayer } from "./VoiceNotePlayer";
import { VoiceNoteRecorder } from "./VoiceNoteRecorder";
import { QuickReactionPicker, ReactionBadges } from "./ReactionBar";

function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const t = localStorage.getItem("insight_theme");
    setIsDarkMode(t === "dark");
    const handleStorage = () => {
      setIsDarkMode(localStorage.getItem("insight_theme") === "dark");
    };
    window.addEventListener("storage", handleStorage);
    const interval = setInterval(handleStorage, 500);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);
  return isDarkMode;
}

function formatMessageTime(val: any): string {
  if (!val) return "";
  try {
    const date = val?.toDate ? val.toDate() : (val instanceof Date ? val : new Date(val));
    if (isNaN(date.getTime())) return "";
    return format(date, "h:mm a");
  } catch {
    return "";
  }
}

interface Chat {
  id: string;
  participants: string[];
  updatedAt?: any;
  typing?: Record<string, any>;
  lastMessageText?: string;
  lastMessageBy?: string;
}

export interface MessageReplyTo {
  id: string;
  text: string;
  senderEmail: string;
}

interface Message {
  id: string;
  text: string;
  senderEmail: string;
  createdAt: any;
  imageUrl?: string;
  voiceNoteUrl?: string;
  voiceDuration?: number;
  hiddenFor?: string[];
  replyTo?: MessageReplyTo;
  reactions?: Record<string, string[]>;
  readBy?: Record<string, any>;
  read?: boolean;
  status?: "sending" | "sent" | "delivered" | "read";
}

const ChatToolsMenu = ({
  onInsertList,
  isDarkMode,
}: {
  onInsertList: (rows: number, isCheckbox: boolean) => void;
  isDarkMode: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"menu" | "listForm">("menu");
  const [rows, setRows] = useState(5);
  const [isCheckbox, setIsCheckbox] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-11 h-11 rounded-full transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
          isDarkMode ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-100 hover:bg-slate-200"
        }`}
        title="Tools"
      >
        <Wrench className={`w-4 h-4 ${isDarkMode ? "text-slate-300" : "text-slate-500"}`} />
      </button>
      {isOpen && (
        <div
          className={`absolute bottom-14 left-0 w-64 rounded-2xl shadow-2xl border p-2 z-50 ${
            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
          }`}
        >
          {view === "menu" ? (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setView("listForm")}
                className={`text-left px-3 py-2 text-sm font-medium rounded-xl ${
                  isDarkMode ? "text-slate-200 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Create List
              </button>
              <button
                disabled
                className={`text-left px-3 py-2 text-sm font-medium opacity-50 cursor-not-allowed ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Create Poll
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                  New List
                </span>
                <button onClick={() => { setView("menu"); setIsOpen(false); }}>
                  <X className={`w-4 h-4 ${isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"}`} />
                </button>
              </div>
              <div>
                <label className={`text-xs font-medium ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Rows (Max 50)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={rows}
                  onChange={(e) => setRows(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  className={`w-full mt-1 border rounded-md p-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDarkMode ? "border-slate-600 bg-slate-700 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={isCheckbox}
                  onChange={(e) => setIsCheckbox(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-all cursor-pointer"
                />
                <span className={`text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                  Add Checkboxes
                </span>
              </label>
              <Button
                size="sm"
                className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2 text-white font-medium"
                onClick={() => {
                  onInsertList(rows, isCheckbox);
                  setIsOpen(false);
                  setView("menu");
                }}
              >
                Send List
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InteractiveMessageBody = ({
  text,
  isMe,
  onUpdate,
}: {
  text: string;
  isMe: boolean;
  onUpdate: (text: string) => void;
}) => {
  const [localLines, setLocalLines] = useState<string[]>(text.split("\n"));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(text);

  useEffect(() => {
    if (text !== lastSavedRef.current) {
      setLocalLines(text.split("\n"));
      lastSavedRef.current = text;
    }
  }, [text]);

  const saveToFirestore = useCallback(
    (newLines: string[]) => {
      const joined = newLines.join("\n");
      lastSavedRef.current = joined;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(joined);
      }, 500);
    },
    [onUpdate]
  );

  const isListMessage = localLines.some((l) => /^- \[[ x]\]/.test(l.trimStart()) || l.trimStart().startsWith("- •"));
  if (!isListMessage) {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{text}</p>;
  }

  const handleCheckToggle = (idx: number) => {
    const newLines = [...localLines];
    const ln = newLines[idx];
    if (/^\s*- \[ \]/.test(ln)) newLines[idx] = ln.replace("- [ ]", "- [x]");
    else if (/^\s*- \[x\]/.test(ln)) newLines[idx] = ln.replace("- [x]", "- [ ]");
    setLocalLines(newLines);
    const joined = newLines.join("\n");
    lastSavedRef.current = joined;
    onUpdate(joined);
  };

  const handleTextChange = (idx: number, val: string) => {
    const newLines = [...localLines];
    const m = newLines[idx].trimStart().match(/^(- \[[ x]\]\s?|- •\s?)/);
    const pfx = m ? (m[1].endsWith(" ") ? m[1] : m[1] + " ") : "- • ";
    newLines[idx] = pfx + val;
    setLocalLines(newLines);
    saveToFirestore(newLines);
  };

  const getContent = (line: string) => {
    const m = line.trimStart().match(/^(- \[[ x]\]\s?|- •\s?)/);
    return m ? line.trimStart().substring(m[1].length) : line.trimStart();
  };

  return (
    <div className="space-y-1 mt-0.5 text-sm leading-relaxed flex flex-col">
      {localLines.map((line, i) => {
        const t = line.trimStart();
        const isUnchecked = /^- \[ \]/.test(t);
        const isChecked = /^- \[x\]/.test(t);
        const isBullet = t.startsWith("- •");
        if (!(isUnchecked || isChecked || isBullet)) return <span key={i} className="block">{line}</span>;
        const content = getContent(line);
        return (
          <div key={i} className="flex items-start gap-2 group">
            {isBullet ? (
              <span className="w-4 h-4 mt-0.5 flex items-center justify-center text-current opacity-60 text-lg leading-none shrink-0">•</span>
            ) : (
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleCheckToggle(i)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer bg-white shrink-0"
              />
            )}
            {isMe ? (
              <textarea
                value={content}
                onChange={(e) => handleTextChange(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
                rows={1}
                className={`flex-1 bg-transparent border-none outline-none focus:ring-0 p-0 m-0 text-sm resize-none overflow-hidden leading-snug ${
                  isChecked ? "line-through opacity-60" : "text-current placeholder-white/50"
                }`}
                placeholder="Type a task..."
              />
            ) : (
              <span className={`flex-1 text-sm leading-snug ${isChecked ? "line-through opacity-60" : ""}`}>
                {content || <span className="opacity-40 italic">Empty</span>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface Contact {
  id: string;
  name: string;
  aliases: string;
  email: string;
  ignore: boolean;
}

export function DMChat() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const isDarkMode = useDarkMode();
  const { lang } = useTranslation();

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("st_active_dm");
    if (saved) setActiveChatId(saved);
  }, []);

  useEffect(() => {
    if (activeChatId) sessionStorage.setItem("st_active_dm", activeChatId);
    else sessionStorage.removeItem("st_active_dm");
  }, [activeChatId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactsDropdown, setShowContactsDropdown] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string; isMe: boolean } | null>(null);

  // WhatsApp-grade state
  const [replyingTo, setReplyingTo] = useState<MessageReplyTo | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [justSentIds, setJustSentIds] = useState<Set<string>>(new Set());
  const [pendingAttachments, setPendingAttachments] = useState<{ file: File; preview: string }[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch contacts
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const q = query(collection(firestore, `users/${user.uid}/contacts`));
    const unsub = onSnapshot(q, (snap) => {
      const fetched: Contact[] = [];
      snap.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Contact);
      });
      setContacts(fetched);
    });

    return () => unsub();
  }, [firestore, user?.uid]);

  const getContactName = (email: string): string => {
    const contact = contacts.find((c) => c.email?.toLowerCase() === email?.toLowerCase());
    return contact?.name || email || "?";
  };

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch list of chats
  useEffect(() => {
    if (!firestore || !user?.email) return;

    const q = query(
      collection(firestore, "dms"),
      where("participants", "array-contains", user.email)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetched: Chat[] = [];
      snap.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Chat);
      });
      fetched.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setChats(fetched);
    });

    return () => unsub();
  }, [firestore, user?.email]);

  // Fetch messages for active chat & auto mark unread inbound messages as read
  useEffect(() => {
    if (!firestore || !activeChatId || !user?.email) return;

    const q = query(
      collection(firestore, `dms/${activeChatId}/messages`),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = [];
      snap.forEach((docSnap) => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as Message);
      });
      setMessages(msgs);

      // Mark inbound unread messages as read
      const safeKey = user.email!.replace(/[\.\$\[\]\#\/]/g, "_");
      const unreadInbound = msgs.filter((m) => m.senderEmail !== user.email && !m.read);
      if (unreadInbound.length > 0) {
        unreadInbound.forEach((m) => {
          updateDoc(doc(firestore, `dms/${activeChatId}/messages`, m.id), {
            read: true,
            status: "read",
            [`readBy.${safeKey}`]: Date.now(),
          }).catch(() => {});
        });
      }
    });

    return () => unsub();
  }, [firestore, activeChatId, user?.email]);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const contactEmail = activeChat?.participants.find((p) => p !== user?.email) || "Unknown User";
  const contactDisplayName = getContactName(contactEmail);

  // Check if contact is typing
  const safeOtherKey = contactEmail ? contactEmail.replace(/[\.\$\[\]\#\/]/g, "_") : "";
  const otherTypingTimestamp = activeChat?.typing?.[safeOtherKey];
  const isOtherTyping = Boolean(
    otherTypingTimestamp && Date.now() - Number(otherTypingTimestamp) < 4000
  );

  const dispatchPushNotification = async (bodyText: string) => {
    if (!contactEmail || contactEmail === "Unknown User") return;
    try {
      const headers = await getAuthHeaders();
      await fetch("/api/notifications/dispatch", {
        method: "POST",
        headers,
        body: JSON.stringify({
          recipientEmails: [contactEmail],
          payload: {
            title: user?.displayName || user?.email || "New Message",
            body: bodyText,
            url: window.location.pathname,
            chatId: activeChatId || undefined,
            type: "dm",
          },
        }),
      });
    } catch {
      // Non-critical, swallow offline/network error
    }
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (!firestore || !activeChatId || !user?.email) return;

    // Send typing heartbeat to Firestore
    const safeKey = user.email.replace(/[\.\$\[\]\#\/]/g, "_");
    updateDoc(doc(firestore, "dms", activeChatId), {
      [`typing.${safeKey}`]: Date.now(),
    }).catch(() => {});

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(doc(firestore, "dms", activeChatId), {
        [`typing.${safeKey}`]: null,
      }).catch(() => {});
    }, 3000);
  };

  const handleStartChat = async () => {
    if (!firestore || !user?.email || !newContactEmail.trim()) return;
    const targetEmail = newContactEmail.trim().toLowerCase();

    if (targetEmail === user.email) {
      alert("You cannot DM yourself.");
      return;
    }

    const existingChat = chats.find((c) => c.participants.includes(targetEmail));
    if (existingChat) {
      setActiveChatId(existingChat.id);
      setNewContactEmail("");
      return;
    }

    try {
      const docRef = await addDoc(collection(firestore, "dms"), {
        participants: [user.email, targetEmail],
        updatedAt: serverTimestamp(),
      });
      setActiveChatId(docRef.id);
      setNewContactEmail("");
    } catch (e) {
      console.error(e);
      alert("Failed to create chat.");
    }
  };

  const handleSendMessage = async (customImageUrl?: string, customFileName?: string) => {
    if (!firestore || !user?.email || !activeChatId) return;

    const textToSend = customImageUrl ? `Uploaded image: ${customFileName}` : inputText.trim();
    if (!textToSend && !customImageUrl && pendingAttachments.length === 0) return;

    setInputText("");
    const currentReply = replyingTo;
    setReplyingTo(null);

    // Clear typing status immediately
    const safeKey = user.email.replace(/[\.\$\[\]\#\/]/g, "_");
    updateDoc(doc(firestore, "dms", activeChatId), {
      [`typing.${safeKey}`]: null,
    }).catch(() => {});

    playMessageSendSound();

    // Process attachments
    if (!customImageUrl && pendingAttachments.length > 0) {
      const toProcess = [...pendingAttachments];
      setPendingAttachments([]);
      for (const att of toProcess) {
        if (att.preview) URL.revokeObjectURL(att.preview);
        if (att.file.type.startsWith("image/")) {
          processImageFile(att.file);
        }
      }
    }

    if (textToSend || customImageUrl) {
      try {
        const payload: any = {
          text: textToSend,
          senderEmail: user.email,
          createdAt: serverTimestamp(),
          read: false,
          status: "sent",
        };
        if (customImageUrl) payload.imageUrl = customImageUrl;
        if (currentReply) payload.replyTo = currentReply;

        const docRef = await addDoc(collection(firestore, `dms/${activeChatId}/messages`), payload);

        // Update chat metadata
        await updateDoc(doc(firestore, "dms", activeChatId), {
          updatedAt: serverTimestamp(),
          lastMessageText: textToSend,
          lastMessageBy: user.email,
        });

        logActivity(
          firestore,
          "item_created",
          { email: user?.email || "", displayName: user?.displayName },
          "Sent DM message",
          { messagePreview: textToSend.substring(0, 200) }
        );

        dispatchPushNotification(textToSend);

        setJustSentIds((prev) => new Set(prev).add(docRef.id));
        setTimeout(() => {
          setJustSentIds((prev) => {
            const next = new Set(prev);
            next.delete(docRef.id);
            return next;
          });
        }, 500);
      } catch (e) {
        console.error(e);
        alert("Failed to send message.");
      }
    }
  };

  const handleSendVoiceNote = async (audioBlob: Blob, durationSeconds: number) => {
    if (!storage || !user?.email || !activeChatId || !firestore) return;
    setIsRecordingVoice(false);
    playMessageSendSound();

    const currentReply = replyingTo;
    setReplyingTo(null);

    try {
      const filePath = `voice_notes/${user.uid}/${activeChatId}/${Date.now()}.webm`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, audioBlob, { contentType: audioBlob.type || "audio/webm" });
      const downloadUrl = await getDownloadURL(storageRef);

      const payload: any = {
        text: "🎤 Voice note",
        voiceNoteUrl: downloadUrl,
        voiceDuration: durationSeconds,
        senderEmail: user.email,
        createdAt: serverTimestamp(),
        read: false,
        status: "sent",
      };
      if (currentReply) payload.replyTo = currentReply;

      const docRef = await addDoc(collection(firestore, `dms/${activeChatId}/messages`), payload);

      await updateDoc(doc(firestore, "dms", activeChatId), {
        updatedAt: serverTimestamp(),
        lastMessageText: "🎤 Voice note",
        lastMessageBy: user.email,
      });

      logActivity(
        firestore,
        "item_created",
        { email: user.email, displayName: user?.displayName },
        "Sent DM voice note"
      );

      dispatchPushNotification("🎤 Voice note");

      setJustSentIds((prev) => new Set(prev).add(docRef.id));
      setTimeout(() => {
        setJustSentIds((prev) => {
          const next = new Set(prev);
          next.delete(docRef.id);
          return next;
        });
      }, 500);
    } catch (err) {
      console.error("Voice note upload failed:", err);
      alert("Failed to send voice note. Please try again.");
    }
  };

  const handleToggleReaction = async (msgId: string, emoji: string) => {
    if (!firestore || !activeChatId || !user?.email) return;
    const targetMsg = messages.find((m) => m.id === msgId);
    const currentReactions = targetMsg?.reactions || {};
    const usersWhoReacted = currentReactions[emoji] || [];
    const hasReacted = usersWhoReacted.includes(user.email);

    try {
      await updateDoc(doc(firestore, `dms/${activeChatId}/messages`, msgId), {
        [`reactions.${emoji}`]: hasReacted ? arrayRemove(user.email) : arrayUnion(user.email),
      });
    } catch (err) {
      console.error("Failed to update reaction:", err);
    }
    setActiveReactionMsgId(null);
  };

  const processImageFile = async (file: File) => {
    if (!user?.email || !activeChatId) return;
    const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, "_") : `file_${Date.now()}`;
    
    // 1. Try Firebase Storage upload
    if (storage && user.uid) {
      try {
        const path = `dm_attachments/${user.uid}/${activeChatId}/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });
        const downloadUrl = await getDownloadURL(storageRef);
        handleSendMessage(downloadUrl, safeName);
        return;
      } catch (err) {
        console.warn("Storage upload failed, attempting fallback:", err);
      }
    }

    // 2. Client-side data URL fallback
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (!result) return;
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const MAX = 1200;
            if (width > height && width > MAX) {
              height *= MAX / width;
              width = MAX;
            } else if (height > MAX) {
              width *= MAX / height;
              height = MAX;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            handleSendMessage(dataUrl, safeName);
          } catch {
            handleSendMessage(result, safeName);
          }
        };
        img.onerror = () => handleSendMessage(result, safeName);
        img.src = result;
      };
      reader.readAsDataURL(file);
    } else if (file.size <= 2 * 1024 * 1024) {
      // Small documents/files fallback
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) handleSendMessage(result, safeName);
      };
      reader.readAsDataURL(file);
    } else {
      alert("Failed to upload file. Please ensure file is under 50MB and try again.");
    }
  };

  const handleToggleCheckbox = async (msgId: string, newText: string) => {
    if (!firestore || !activeChatId) return;
    try {
      await updateDoc(doc(firestore, `dms/${activeChatId}/messages`, msgId), { text: newText });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteForMe = async (msgId: string) => {
    if (!firestore || !activeChatId || !user?.email) return;
    try {
      await updateDoc(doc(firestore, `dms/${activeChatId}/messages`, msgId), { hiddenFor: arrayUnion(user.email) });
    } catch (e) {
      console.error(e);
    }
    setContextMenu(null);
  };

  const handleDeleteForEveryone = async (msgId: string) => {
    if (!firestore || !activeChatId) return;
    try {
      await deleteDoc(doc(firestore, `dms/${activeChatId}/messages`, msgId));
    } catch (e) {
      console.error(e);
    }
    setContextMenu(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = "";
  };

  // Global paste listener
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        const previews = files.map((f) => ({
          file: f,
          preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
        }));
        setPendingAttachments((prev) => [...prev, ...previews]);
      }
    };
    document.addEventListener("paste", handleGlobalPaste);
    return () => document.removeEventListener("paste", handleGlobalPaste);
  }, []);

  const removePendingAttachment = (idx: number) => {
    setPendingAttachments((prev) => {
      const removed = prev[idx];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  return (
    <div
      className={`flex h-full w-full rounded-3xl overflow-hidden border shadow-sm ${
        isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
      }`}
    >
      {/* Left Pane: Chat List */}
      <div
        className={`w-full md:w-80 flex flex-col border-r relative z-10 transition-all shrink-0 ${
          activeChatId ? "hidden md:flex" : "flex"
        } ${isDarkMode ? "border-slate-700 bg-slate-800/50" : "border-slate-100 bg-slate-50/50"}`}
      >
        <div
          className={`p-4 border-b space-y-4 backdrop-blur-sm ${
            isDarkMode ? "border-slate-700 bg-slate-800/50" : "border-slate-100 bg-white/50"
          }`}
        >
          <div className="flex items-center justify-between px-2">
            <h2 className={`text-sm font-bold tracking-wide uppercase ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
              Direct Messages
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">
              {chats.length}
            </span>
          </div>

          <div className="flex flex-col gap-2 relative">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search contact or enter email..."
                value={newContactEmail}
                onChange={(e) => {
                  setNewContactEmail(e.target.value);
                  setShowContactsDropdown(true);
                }}
                onFocus={() => setShowContactsDropdown(true)}
                onBlur={() => setTimeout(() => setShowContactsDropdown(false), 200)}
                className={`h-9 text-xs flex-1 rounded-xl focus-visible:ring-indigo-100 ${
                  isDarkMode
                    ? "bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                }`}
                onKeyDown={(e) => e.key === "Enter" && handleStartChat()}
              />
              <Button
                size="icon"
                onClick={handleStartChat}
                className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4 text-white" />
              </Button>
            </div>

            {showContactsDropdown && contacts.length > 0 && (
              <div
                className={`absolute top-10 left-0 right-10 border shadow-lg rounded-xl z-50 max-h-48 overflow-y-auto ${
                  isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                }`}
              >
                {contacts
                  .filter(
                    (c) =>
                      c.name?.toLowerCase().includes(newContactEmail.toLowerCase()) ||
                      c.email?.toLowerCase().includes(newContactEmail.toLowerCase())
                  )
                  .map((contact) => (
                    <div
                      key={contact.id}
                      className={`p-2.5 cursor-pointer flex flex-col ${
                        isDarkMode ? "hover:bg-indigo-900/30" : "hover:bg-indigo-50"
                      }`}
                      onMouseDown={() => {
                        setNewContactEmail(contact.email);
                        setShowContactsDropdown(false);
                      }}
                    >
                      <span className={`text-xs font-bold ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                        {contact.name}
                      </span>
                      <span className="text-[10px] text-slate-500">{contact.email}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {chats.map((chat) => {
            const otherEmail = chat.participants.find((p) => p !== user?.email) || "Unknown";
            const displayName = getContactName(otherEmail);
            const isActive = chat.id === activeChatId;
            return (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                  isActive
                    ? isDarkMode
                      ? "bg-indigo-950/60 border border-indigo-800 shadow-sm"
                      : "bg-indigo-50 border border-indigo-100 shadow-sm"
                    : isDarkMode
                    ? "hover:bg-slate-800 border border-transparent"
                    : "hover:bg-slate-100 border border-transparent"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : isDarkMode
                      ? "bg-slate-700 text-slate-200"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold truncate ${
                        isActive
                          ? isDarkMode
                            ? "text-indigo-300"
                            : "text-indigo-900"
                          : isDarkMode
                          ? "text-slate-200"
                          : "text-slate-700"
                      }`}
                    >
                      {displayName}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 truncate mt-0.5">
                    {chat.lastMessageText || "Direct Message"}
                  </span>
                </div>
              </div>
            );
          })}
          {chats.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Search className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs font-medium">No direct messages yet</p>
            </div>
          )}
        </div>

        {/* Current User Profile Summary */}
        <div
          className={`p-3.5 border-t flex items-center gap-3 shrink-0 ${
            isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-100 bg-white"
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              isDarkMode ? "bg-slate-700 text-white" : "bg-slate-800 text-white"
            }`}
          >
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-xs font-bold truncate ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {user?.displayName || "Me"}
            </span>
            <span className="text-[10px] text-slate-500 truncate">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Right Pane: Main Chat */}
      <div
        className={`flex-1 flex flex-col relative min-w-0 ${
          !activeChatId ? "hidden md:flex" : "flex"
        } ${isDarkMode ? "bg-slate-900" : "bg-slate-50/60"}`}
      >
        {activeChatId ? (
          <>
            {/* Header */}
            <div
              className={`h-16 border-b px-4 md:px-6 flex items-center justify-between shrink-0 ${
                isDarkMode ? "border-slate-700 bg-slate-800/90" : "border-slate-200 bg-white/90 backdrop-blur-md"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveChatId(null)}
                  className="md:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Back to contacts"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                  {contactDisplayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className={`text-sm font-bold truncate ${isDarkMode ? "text-white" : "text-slate-800"}`}>
                    {contactDisplayName}
                  </h3>
                  {isOtherTyping ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                      <span>typing</span>
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:0ms]"></span>
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:150ms]"></span>
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:300ms]"></span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 truncate">{contactEmail}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
              onClick={() => {
                setContextMenu(null);
                setActiveReactionMsgId(null);
              }}
            >
              {messages
                .filter((m) => !(m.hiddenFor || []).includes(user?.email || ""))
                .map((msg, idx) => {
                  const isMe = msg.senderEmail === user?.email;
                  const isJustSent = justSentIds.has(msg.id);
                  const isPickerOpen = activeReactionMsgId === msg.id;

                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"} group relative`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id, isMe });
                      }}
                      style={
                        isJustSent
                          ? { animation: "dm-bubble-rise 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both" }
                          : undefined
                      }
                    >
                      <div className="relative max-w-[85%] sm:max-w-[70%]">
                        {/* Reaction Picker floating popover */}
                        {isPickerOpen && (
                          <div
                            className={`absolute -top-12 z-30 ${isMe ? "right-0" : "left-0"}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <QuickReactionPicker
                              onReact={(emoji: string) => handleToggleReaction(msg.id, emoji)}
                              onClose={() => setActiveReactionMsgId(null)}
                              isDarkMode={isDarkMode}
                            />
                          </div>
                        )}

                        {/* Hover Quick Actions (Reply & React) */}
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-20 ${
                            isMe ? "-left-16" : "-right-16"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setActiveReactionMsgId(isPickerOpen ? null : msg.id)}
                            className={`p-1.5 rounded-full shadow-sm hover:scale-110 transition-transform ${
                              isDarkMode
                                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                            }`}
                            title="React"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setReplyingTo({
                                id: msg.id,
                                text: msg.voiceNoteUrl
                                  ? "🎤 Voice note"
                                  : msg.imageUrl
                                  ? "📷 Photo"
                                  : msg.text,
                                senderEmail: msg.senderEmail,
                              })
                            }
                            className={`p-1.5 rounded-full shadow-sm hover:scale-110 transition-transform ${
                              isDarkMode
                                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                            }`}
                            title="Reply"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Message Bubble */}
                        <div
                          className={`rounded-2xl px-4 py-2.5 shadow-sm transition-all ${
                            isMe
                              ? "bg-emerald-600 text-white rounded-br-xs"
                              : isDarkMode
                              ? "bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700/60"
                              : "bg-white text-slate-800 rounded-bl-xs border border-slate-200/80 shadow-xs"
                          }`}
                        >
                          {/* Quoted Reply Banner inside bubble */}
                          {msg.replyTo && (
                            <div
                              className={`mb-2 p-2 rounded-xl text-xs border-l-4 ${
                                isMe
                                  ? "bg-emerald-700/70 border-emerald-300 text-emerald-100"
                                  : isDarkMode
                                  ? "bg-slate-900/80 border-indigo-500 text-slate-300"
                                  : "bg-slate-100 border-indigo-500 text-slate-700"
                              }`}
                            >
                              <p className="font-bold text-[11px] truncate">
                                {msg.replyTo.senderEmail === user?.email
                                  ? "You"
                                  : getContactName(msg.replyTo.senderEmail)}
                              </p>
                              <p className="truncate opacity-80 mt-0.5">{msg.replyTo.text}</p>
                            </div>
                          )}

                          {/* Message Body Content */}
                          {msg.voiceNoteUrl ? (
                            <VoiceNotePlayer
                              audioUrl={msg.voiceNoteUrl}
                              duration={msg.voiceDuration}
                              isMe={isMe}
                              isDarkMode={isDarkMode}
                            />
                          ) : msg.imageUrl ? (
                            <div className="flex flex-col mt-1 mb-1">
                              <span
                                className={`text-xs font-semibold mb-2 truncate max-w-[200px] ${
                                  isMe ? "text-emerald-100" : "text-slate-500"
                                }`}
                              >
                                {msg.text.replace("Uploaded image: ", "")}
                              </span>
                              <img
                                src={msg.imageUrl}
                                alt="Attachment"
                                className="max-w-[260px] max-h-[260px] object-cover rounded-xl shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() =>
                                  setLightboxImage({
                                    url: msg.imageUrl!,
                                    name: msg.text.replace("Uploaded image: ", ""),
                                  })
                                }
                              />
                            </div>
                          ) : (
                            <InteractiveMessageBody
                              text={msg.text}
                              isMe={isMe}
                              onUpdate={(t) => handleToggleCheckbox(msg.id, t)}
                            />
                          )}

                          {/* Timestamp and Delivery Receipts */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
                              isMe ? "text-emerald-100/80" : isDarkMode ? "text-slate-400" : "text-slate-500"
                            }`}
                          >
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            {isMe && (
                              <span title={msg.read ? "Read" : msg.status === "sending" ? "Sending" : "Delivered"}>
                                {msg.read ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-sky-300 inline shrink-0" />
                                ) : msg.status === "sending" ? (
                                  <Clock className="w-3.5 h-3.5 text-white/60 inline shrink-0" />
                                ) : (
                                  <CheckCheck className="w-3.5 h-3.5 text-white/70 inline shrink-0" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reaction Badges Below Bubble */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`mt-1 flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <ReactionBadges
                              reactions={msg.reactions}
                              currentEmail={user?.email || ""}
                              onToggle={(emoji: string) => handleToggleReaction(msg.id, emoji)}
                              isDarkMode={isDarkMode}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              <div ref={bottomRef} className="h-1" />
            </div>

            {/* Context Menu */}
            {contextMenu && (
              <div
                className={`fixed z-[9999] rounded-2xl shadow-2xl border py-1.5 w-48 overflow-hidden backdrop-blur-md ${
                  isDarkMode ? "bg-slate-800/95 border-slate-700" : "bg-white/95 border-slate-200"
                }`}
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                <button
                  onClick={() => handleDeleteForMe(contextMenu.msgId)}
                  className={`w-full text-left px-4 py-2 text-sm font-medium ${
                    isDarkMode ? "text-slate-200 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Delete for me
                </button>
                {contextMenu.isMe && (
                  <button
                    onClick={() => handleDeleteForEveryone(contextMenu.msgId)}
                    className={`w-full text-left px-4 py-2 text-sm text-red-600 font-medium ${
                      isDarkMode ? "hover:bg-red-900/30" : "hover:bg-red-50"
                    }`}
                  >
                    Delete for everyone
                  </button>
                )}
              </div>
            )}

            {/* Input Footer */}
            <div
              className={`p-3 md:p-4 border-t shrink-0 ${
                isDarkMode ? "bg-slate-800/80 border-slate-700" : "bg-white border-slate-200"
              }`}
            >
              <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                {/* Replying Banner */}
                {replyingTo && (
                  <div
                    className={`flex items-center justify-between p-2.5 px-4 rounded-2xl border-l-4 border-emerald-500 shadow-sm ${
                      isDarkMode ? "bg-slate-850 text-slate-200" : "bg-emerald-50/80 text-slate-800"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-3">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Replying to {replyingTo.senderEmail === user?.email ? "yourself" : getContactName(replyingTo.senderEmail)}
                      </span>
                      <span className="text-xs truncate text-slate-600 dark:text-slate-300">
                        {replyingTo.text}
                      </span>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Pending Attachments */}
                {pendingAttachments.length > 0 && (
                  <div
                    className={`flex items-center gap-2 px-3 py-2 border rounded-2xl ${
                      isDarkMode ? "border-slate-600 bg-slate-700" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {pendingAttachments.map((att, idx) => (
                      <div key={idx} className="relative shrink-0 group">
                        {att.preview ? (
                          <img
                            src={att.preview}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
                            <Paperclip className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <button
                          onClick={() => removePendingAttachment(idx)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Row or Voice Recorder */}
                {isRecordingVoice ? (
                  <VoiceNoteRecorder
                    isDarkMode={isDarkMode}
                    onRecorded={handleSendVoiceNote}
                    onCancel={() => setIsRecordingVoice(false)}
                  />
                ) : (
                  <div className="flex items-center gap-2 relative">
                    <ChatToolsMenu
                      isDarkMode={isDarkMode}
                      onInsertList={async (rows, isCheckbox) => {
                        const payload = Array.from({ length: rows })
                          .fill(isCheckbox ? "- [ ] " : "- • ")
                          .join("\n");
                        const msgData: any = {
                          text: payload,
                          senderEmail: user?.email,
                          createdAt: serverTimestamp(),
                          read: false,
                          status: "sent",
                        };
                        if (replyingTo) {
                          msgData.replyTo = replyingTo;
                          setReplyingTo(null);
                        }
                        await addDoc(collection(firestore!, `dms/${activeChatId}/messages`), msgData);
                        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                      }}
                    />
                    <label
                      className={`w-11 h-11 rounded-full transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
                        isDarkMode ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-100 hover:bg-slate-200"
                      }`}
                      title="Upload File"
                    >
                      <Paperclip className={`w-4 h-4 ${isDarkMode ? "text-slate-300" : "text-slate-500"}`} />
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>

                    <Input
                      value={inputText}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder={`Message ${contactDisplayName}...`}
                      className={`flex-1 border-transparent focus-visible:ring-indigo-100 rounded-full h-11 px-5 shadow-none text-sm ${
                        isDarkMode ? "bg-slate-700 text-white placeholder:text-slate-400" : "bg-slate-100 text-slate-900"
                      }`}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        (inputText.trim() || pendingAttachments.length > 0) &&
                        handleSendMessage()
                      }
                    />

                    {inputText.trim() || pendingAttachments.length > 0 ? (
                      <Button
                        onClick={() => handleSendMessage()}
                        size="icon"
                        className="h-11 w-11 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-md shrink-0 text-white"
                      >
                        <Send className="w-4 h-4 ml-0.5" />
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setIsRecordingVoice(true)}
                        size="icon"
                        className={`h-11 w-11 rounded-full transition-colors shrink-0 shadow-sm ${
                          isDarkMode
                            ? "bg-slate-700 hover:bg-slate-600 text-emerald-400"
                            : "bg-slate-100 hover:bg-slate-200 text-emerald-600"
                        }`}
                        title="Record voice note"
                      >
                        <Mic className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div
              className={`w-20 h-20 rounded-full shadow-sm flex items-center justify-center mb-6 border ${
                isDarkMode ? "bg-slate-800 text-slate-500 border-slate-700" : "bg-white text-slate-300 border-slate-100"
              }`}
            >
              <MessageSquareX className="w-10 h-10" />
            </div>
            <h2 className={`text-2xl font-extrabold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
              No Chat Selected
            </h2>
            <p className="text-slate-400 mt-2 max-w-sm">
              Select an existing contact from the left menu or type an email to start a new direct message thread.
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex justify-between items-center mb-4">
              <span className="text-white text-lg font-semibold drop-shadow-md">{lightboxImage.name}</span>
            </div>
            <img
              src={lightboxImage.url}
              alt="Expanded Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
