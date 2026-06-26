"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFirestore, useUser, useStorage } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, updateDoc, doc, deleteDoc, arrayUnion } from "firebase/firestore";
import { Send, UserCircle, Plus, Search, MessageSquareX, Paperclip, X, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { playMessageSendSound } from "@/lib/send-sound";
import { logActivity } from '@/lib/activity-logger';

function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const t = localStorage.getItem('insight_theme');
    setIsDarkMode(t === 'dark');
    const handleStorage = () => {
      setIsDarkMode(localStorage.getItem('insight_theme') === 'dark');
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 500);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);
  return isDarkMode;
}

interface Chat {
  id: string;
  participants: string[];
  updatedAt?: any;
}

interface Message {
  id: string;
  text: string;
  senderEmail: string;
  createdAt: any;
  imageUrl?: string;
  hiddenFor?: string[];
}

const ChatToolsMenu = ({ onInsertList, isDarkMode }: { onInsertList: (rows: number, isCheckbox: boolean) => void; isDarkMode: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'listForm'>('menu');
  const [rows, setRows] = useState(5);
  const [isCheckbox, setIsCheckbox] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`w-12 h-12 rounded-full transition-colors flex items-center justify-center cursor-pointer shrink-0 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`} title="Herramientas">
        <Wrench className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
      </button>
      {isOpen && (
        <div className={`absolute bottom-16 left-0 w-64 rounded-xl shadow-xl border p-2 z-50 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          {view === 'menu' ? (
            <div className="flex flex-col gap-1">
              <button onClick={() => setView('listForm')} className={`text-left px-3 py-2 text-sm font-medium rounded-md ${isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'}`}>Crear Lista</button>
              <button disabled className={`text-left px-3 py-2 text-sm font-medium opacity-50 cursor-not-allowed ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Crear Encuesta</button>
              <button disabled className={`text-left px-3 py-2 text-sm font-medium opacity-50 cursor-not-allowed ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Crear Hilo</button>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Nueva Lista</span>
                <button onClick={() => { setView('menu'); setIsOpen(false); }}><X className={`w-4 h-4 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`} /></button>
              </div>
              <div>
                <label className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Filas (Máx 50)</label>
                <input type="number" min="1" max="50" value={rows} onChange={e => setRows(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))} className={`w-full mt-1 border rounded-md p-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-3">
                <input type="checkbox" checked={isCheckbox} onChange={e => setIsCheckbox(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-all cursor-pointer" />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Agregar Casillas</span>
              </label>
              <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2 text-white font-medium" onClick={() => {
                onInsertList(rows, isCheckbox);
                setIsOpen(false);
                setView('menu');
              }}>Enviar Lista</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InteractiveMessageBody = ({ text, isMe, onUpdate }: { text: string, isMe: boolean, onUpdate: (text: string) => void }) => {
  const [localLines, setLocalLines] = useState<string[]>(text.split('\n'));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(text);

  // Sync from Firestore prop ONLY when text changes from an external source
  useEffect(() => {
    if (text !== lastSavedRef.current) {
      setLocalLines(text.split('\n'));
      lastSavedRef.current = text;
    }
  }, [text]);

  const saveToFirestore = useCallback((newLines: string[]) => {
    const joined = newLines.join('\n');
    lastSavedRef.current = joined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { onUpdate(joined); }, 500);
  }, [onUpdate]);

  const isListMessage = localLines.some(l => /^- \[[ x]\]/.test(l.trimStart()) || l.trimStart().startsWith('- •'));
  if (!isListMessage) {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  const handleCheckToggle = (idx: number) => {
    const newLines = [...localLines];
    const ln = newLines[idx];
    if (/^\s*- \[ \]/.test(ln)) newLines[idx] = ln.replace('- [ ]', '- [x]');
    else if (/^\s*- \[x\]/.test(ln)) newLines[idx] = ln.replace('- [x]', '- [ ]');
    setLocalLines(newLines);
    const joined = newLines.join('\n');
    lastSavedRef.current = joined;
    onUpdate(joined);
  };

  const handleTextChange = (idx: number, val: string) => {
    const newLines = [...localLines];
    const m = newLines[idx].trimStart().match(/^(- \[[ x]\]\s?|- •\s?)/);
    const pfx = m ? (m[1].endsWith(' ') ? m[1] : m[1] + ' ') : '- • ';
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
        const isBullet = t.startsWith('- •');
        if (!(isUnchecked || isChecked || isBullet)) return <span key={i} className="block">{line}</span>;
        const content = getContent(line);
        return (
          <div key={i} className="flex items-start gap-2 group">
            {isBullet ? (
              <span className="w-4 h-4 mt-0.5 flex items-center justify-center text-current opacity-60 text-lg leading-none shrink-0">•</span>
            ) : (
              <input type="checkbox" checked={isChecked} onChange={() => handleCheckToggle(i)} onClick={e => e.stopPropagation()} className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer bg-white shrink-0" />
            )}
            {isMe ? (
              <textarea
                value={content}
                onChange={e => handleTextChange(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault(); // Prevent breaking list format
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
                rows={1}
                className={`flex-1 bg-transparent border-none outline-none focus:ring-0 p-0 m-0 text-sm resize-none overflow-hidden leading-snug ${isChecked ? 'line-through opacity-60' : 'text-current placeholder-white/50'}`}
                placeholder="Type a task..."
              />
            ) : (
              <span className={`flex-1 text-sm leading-snug ${isChecked ? 'line-through opacity-60' : ''}`}>{content || <span className="opacity-40 italic">Empty</span>}</span>
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
  const [lightboxImage, setLightboxImage] = useState<{url: string, name: string} | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, msgId: string, isMe: boolean} | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const [justSentIds, setJustSentIds] = useState<Set<string>>(new Set());
  const [pendingAttachments, setPendingAttachments] = useState<{ file: File; preview: string }[]>([]);

  // Fetch contacts
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const q = query(collection(firestore, `users/${user.uid}/contacts`));
    const unsub = onSnapshot(q, (snap) => {
      const fetched: Contact[] = [];
      snap.forEach(doc => {
         fetched.push({ id: doc.id, ...doc.data() } as Contact);
      });
      setContacts(fetched);
    });

    return () => unsub();
  }, [firestore, user?.uid]);

  const getContactName = (email: string): string => {
    const contact = contacts.find(c => c.email === email);
    return (contact?.name || email || "?");
  };

  // Auto scroll to bottom of messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch list of chats where this user is a participant
  useEffect(() => {
    if (!firestore || !user?.email) return;

    const q = query(
      collection(firestore, "dms"),
      where("participants", "array-contains", user.email)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetched: Chat[] = [];
      snap.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Chat);
      });
      // Sort client-side mostly since we don't have composite indexes guaranteed
      fetched.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setChats(fetched);
    });

    return () => unsub();
  }, [firestore, user?.email]);

  // Fetch messages for the currently active chat
  useEffect(() => {
    if (!firestore || !activeChatId) return;

    const q = query(
      collection(firestore, `dms/${activeChatId}/messages`),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = [];
      snap.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    return () => unsub();
  }, [firestore, activeChatId]);

  const handleStartChat = async () => {
    if (!firestore || !user?.email || !newContactEmail.trim()) return;
    const targetEmail = newContactEmail.trim().toLowerCase();
    
    if (targetEmail === user.email) {
      alert("You cannot DM yourself.");
      return;
    }

    // Check if chat exists locally
    const existingChat = chats.find(c => c.participants.includes(targetEmail));
    if (existingChat) {
      setActiveChatId(existingChat.id);
      setNewContactEmail("");
      return;
    }

    // Create new chat
    try {
      const docRef = await addDoc(collection(firestore, "dms"), {
        participants: [user.email, targetEmail],
        updatedAt: serverTimestamp()
      });
      setActiveChatId(docRef.id);
      setNewContactEmail("");
    } catch(e) {
      console.error(e);
      alert("Failed to create chat. Security rules might prevent this if authentication is stale.");
    }
  };

  const handleSendMessage = async (customImageUrl?: string, customFileName?: string) => {
    if (!firestore || !user?.email || !activeChatId) return;
    
    const textToSend = customImageUrl ? `Uploaded image: ${customFileName}` : inputText.trim();
    if (!textToSend && !customImageUrl && pendingAttachments.length === 0) return;
    setInputText("");

    // Play send sound
    playMessageSendSound();

    // Send any pending paste attachments (image-only sends with no text)
    if (!customImageUrl && pendingAttachments.length > 0) {
      const toProcess = [...pendingAttachments];
      setPendingAttachments([]);
      for (const att of toProcess) {
        if (att.preview) URL.revokeObjectURL(att.preview);
        if (att.file.type.startsWith('image/')) {
          processImageFile(att.file);
        }
      }
    }

    // Send text message (or the customImageUrl message)
    if (textToSend || customImageUrl) {
      try {
        const payload: any = {
          text: textToSend,
          senderEmail: user.email,
          createdAt: serverTimestamp()
        };
        if (customImageUrl) payload.imageUrl = customImageUrl;
        const docRef = await addDoc(collection(firestore, `dms/${activeChatId}/messages`), payload);
        logActivity(firestore, 'item_created', { email: user?.email || '', displayName: user?.displayName }, 'Sent DM message', { messagePreview: textToSend.substring(0, 200) });
        // Track sent message for animation
        setJustSentIds(prev => new Set(prev).add(docRef.id));
        setTimeout(() => {
          setJustSentIds(prev => { const next = new Set(prev); next.delete(docRef.id); return next; });
        }, 500);
      } catch(e) {
        console.error(e);
        alert("Failed to send message.");
      }
    }
  };

  const processImageFile = async (file: File) => {
    if (!storage || !user?.email || !activeChatId) return;
    try {
      // Upload to Firebase Storage instead of base64 (avoids Firestore 1MB doc limit)
      const path = `dm_attachments/${user.uid}/${activeChatId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      handleSendMessage(downloadUrl, file.name || "uploaded-image.jpg");
    } catch (err) {
      console.error("Upload failed:", err);
      // Fallback: use base64 with canvas resize (compresses to JPEG 0.7 quality)
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const MAX = 800;
            if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
            else if (height > MAX) { width *= MAX / height; height = MAX; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            handleSendMessage(dataUrl, file.name || "pasted-image.jpg");
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        alert("Failed to upload file. Please try again.");
      }
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
    } catch (e) { console.error(e); }
    setContextMenu(null);
  };

  const handleDeleteForEveryone = async (msgId: string) => {
    if (!firestore || !activeChatId) return;
    try {
      await deleteDoc(doc(firestore, `dms/${activeChatId}/messages`, msgId));
    } catch (e) { console.error(e); }
    setContextMenu(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = "";
  };

  // Global paste listener — catches image pastes regardless of which element has focus
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        const previews = files.map(f => ({
          file: f,
          preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
        }));
        setPendingAttachments(prev => [...prev, ...previews]);
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const removePendingAttachment = (idx: number) => {
    setPendingAttachments(prev => {
      const removed = prev[idx];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const contactEmail = activeChat?.participants.find(p => p !== user?.email) || "Unknown User";
  const contactDisplayName = getContactName(contactEmail);

  return (
    <div className={`flex h-full w-full rounded-3xl overflow-hidden border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      {/* Left Pane: Chat List */}
      <div className={`w-80 flex flex-col border-r relative z-10 transition-all shrink-0 ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
        <div className={`p-4 border-b space-y-4 backdrop-blur-sm ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-white/50'}`}>
          <h2 className={`text-sm font-bold tracking-wide uppercase px-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Contactos</h2>
          
          <div className="flex flex-col gap-2 relative">
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Buscar contacto o ingresar correo..." 
                value={newContactEmail}
                onChange={e => {
                  setNewContactEmail(e.target.value);
                  setShowContactsDropdown(true);
                }}
                onFocus={() => setShowContactsDropdown(true)}
                onBlur={() => setTimeout(() => setShowContactsDropdown(false), 200)}
                className={`h-9 text-xs flex-1 rounded-xl focus-visible:ring-indigo-100 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                onKeyDown={e => e.key === 'Enter' && handleStartChat()}
              />
              <Button size="icon" onClick={handleStartChat} className="w-9 h-9 rounded-xl bg-indigo-500 hover:bg-indigo-600 shadow-sm shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {showContactsDropdown && contacts.length > 0 && (
              <div className={`absolute top-10 left-0 right-10 border shadow-lg rounded-xl z-50 max-h-48 overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                {contacts.filter(c => c.name.toLowerCase().includes(newContactEmail.toLowerCase()) || c.email.includes(newContactEmail.toLowerCase())).map(contact => (
                  <div 
                    key={contact.id} 
                    className={`p-2 cursor-pointer flex flex-col ${isDarkMode ? 'hover:bg-indigo-900/30' : 'hover:bg-indigo-50'}`}
                    onMouseDown={() => {
                      setNewContactEmail(contact.email);
                      setShowContactsDropdown(false);
                    }}
                  >
                    <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{contact.name}</span>
                    <span className="text-[10px] text-slate-500">{contact.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {chats.map(chat => {
            const otherEmail = chat.participants.find(p => p !== user?.email) || "Unknown";
            const displayName = getContactName(otherEmail);
            const isActive = chat.id === activeChatId;
            return (
              <div 
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${isActive ? (isDarkMode ? 'bg-indigo-900/30 border border-indigo-800 shadow-sm shadow-indigo-900/50' : 'bg-indigo-50 border border-indigo-100 shadow-sm shadow-indigo-100/50') : (isDarkMode ? 'hover:bg-slate-700 border border-transparent' : 'hover:bg-slate-100 border border-transparent')}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-200 text-indigo-700' : (isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-500')}`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm font-semibold truncate ${isActive ? (isDarkMode ? 'text-indigo-300' : 'text-indigo-900') : (isDarkMode ? 'text-slate-200' : 'text-slate-700')}`}>
                    {displayName}
                  </span>
                  <span className="text-xs text-slate-400 truncate">Mensaje Directo</span>
                </div>
              </div>
            );
          })}
          {chats.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Search className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs font-medium">Aún no hay contactos</p>
            </div>
          )}
        </div>
        
        {/* Current User Profile Summary Bottom Left */}
        <div className={`p-4 border-t flex items-center gap-3 shrink-0 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isDarkMode ? 'bg-slate-600 text-white' : 'bg-slate-800 text-white'}`}>
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Yo</span>
            <span className="text-[10px] text-slate-500 truncate">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Right Pane: Main Chat */}
      <div className={`flex-1 flex flex-col relative min-w-0 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {activeChatId ? (
          <>
            {/* Header */}
            <div className={`h-16 border-b px-6 flex items-center shrink-0 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <UserCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{contactDisplayName}</h3>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" onClick={() => setContextMenu(null)}>
              {messages.filter(m => !(m.hiddenFor || []).includes(user?.email || '')).map((msg, idx) => {
                const isMe = msg.senderEmail === user?.email;
                const isJustSent = justSentIds.has(msg.id);
                return (
                  <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id, isMe }); }}
                    style={isJustSent ? {
                      animation: 'dm-bubble-rise 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                    } : undefined}
                  >
                    <div className={`max-w-[75%] rounded-3xl px-5 py-3 shadow-sm ${
                      isMe 
                        ? 'bg-green-500 text-white rounded-br-sm' 
                        : (isDarkMode ? 'bg-slate-700 text-slate-100 rounded-bl-sm' : 'bg-slate-200 text-slate-800 rounded-bl-sm')
                    }`}>
                      {msg.imageUrl ? (
                        <div className="flex flex-col mt-2 mb-2">
                          <span className={`text-xs font-semibold mb-2 truncate max-w-[200px] ${isMe ? 'text-green-100' : 'text-slate-500'}`}>{msg.text.replace('Uploaded image: ', '')}</span>
                          <img 
                            src={msg.imageUrl} 
                            alt="Uploaded Preview" 
                            className="max-w-[250px] max-h-[250px] object-cover rounded shadow-md cursor-pointer hover:opacity-90 transition-opacity" 
                            onClick={() => setLightboxImage({ url: msg.imageUrl!, name: msg.text.replace('Uploaded image: ', '') })}
                          />
                        </div>
                      ) : (
                        <InteractiveMessageBody text={msg.text} isMe={isMe} onUpdate={(t) => handleToggleCheckbox(msg.id, t)} />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} className="h-1" />
            </div>

            {/* Right-click Context Menu */}
            {contextMenu && (
              <div className={`fixed z-[9999] rounded-xl shadow-2xl border py-1 w-48 overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} style={{ left: contextMenu.x, top: contextMenu.y }}>
                <button onClick={() => handleDeleteForMe(contextMenu.msgId)} className={`w-full text-left px-4 py-2.5 text-sm font-medium ${isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'}`}>Eliminar para mí</button>
                {contextMenu.isMe && <button onClick={() => handleDeleteForEveryone(contextMenu.msgId)} className={`w-full text-left px-4 py-2.5 text-sm text-red-600 font-medium ${isDarkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-50'}`}>Eliminar para todos</button>}
              </div>
            )}

            {/* Input Footer */}
            <div className={`p-4 border-t shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
               <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                 {pendingAttachments.length > 0 && (
                    <div className={`flex items-center gap-2 px-3 py-2 border rounded-xl ${isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-50'}`}>
                      {pendingAttachments.map((att, idx) => (
                        <div key={idx} className="relative shrink-0 group">
                          {att.preview ? (
                            <img src={att.preview} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-sm" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
                              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
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
                 <div className="flex items-center gap-2 relative">
                   <ChatToolsMenu isDarkMode={isDarkMode} onInsertList={async (rows, isCheckbox) => {
                     const payload = Array.from({length:rows}).fill(isCheckbox ? '- [ ] ' : '- • ').join('\n');
                     const msgData = {
                       text: payload,
                       senderEmail: user?.email,
                       createdAt: serverTimestamp()
                     };
                     await addDoc(collection(firestore!, `dms/${activeChatId}/messages`), msgData);
                     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                   }} />
                   <label className={`w-12 h-12 rounded-full transition-colors flex items-center justify-center cursor-pointer shrink-0 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`} title="Subir Foto">
                     <Paperclip className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                     <input type="file" accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx" className="hidden" onChange={handleImageUpload} />
                   </label>
                   <Input 
                     value={inputText}
                     onChange={e => setInputText(e.target.value)}
                     placeholder={`Mensaje a ${contactDisplayName}...`}
                     className={`flex-1 border-transparent focus-visible:ring-indigo-100 rounded-full h-12 px-6 shadow-none ${isDarkMode ? 'bg-slate-700 text-white placeholder:text-slate-400' : 'bg-slate-100 text-slate-900'}`}
                     onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (inputText.trim() || pendingAttachments.length > 0) && handleSendMessage()}
                   />
                   <Button onClick={() => handleSendMessage()} disabled={!inputText.trim() && pendingAttachments.length === 0} size="icon" className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600 shadow-md shrink-0">
                     <Send className="w-5 h-5 ml-0.5" />
                   </Button>
                 </div>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className={`w-20 h-20 rounded-full shadow-sm flex items-center justify-center mb-6 border ${isDarkMode ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-white text-slate-300 border-slate-100'}`}>
               <MessageSquareX className="w-10 h-10" />
            </div>
            <h2 className={`text-2xl font-extrabold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Sin Chat Seleccionado</h2>
            <p className="text-slate-400 mt-2 max-w-sm">
              Selecciona un contacto existente del menú izquierdo o escribe un correo electrónico para iniciar un nuevo hilo de mensajes directos.
            </p>
          </div>
        )}
      </div>

      {lightboxImage && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-full max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="w-full flex justify-between items-center mb-4">
              <span className="text-white text-lg font-semibold drop-shadow-md">{lightboxImage.name}</span>
            </div>
            <img src={lightboxImage.url} alt="Expanded Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
          </div>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setLightboxImage(null)}>
            <X className="w-6 h-6" />
          </Button>
        </div>
      )}

    </div>
  );
}
