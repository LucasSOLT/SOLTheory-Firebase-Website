"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, updateDoc, doc, deleteDoc, arrayUnion } from "firebase/firestore";
import { Send, UserCircle, Plus, Search, MessageSquareX, Paperclip, X, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { playMessageSendSound } from "@/lib/send-sound";

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

const ChatToolsMenu = ({ onInsertList }: { onInsertList: (rows: number, isCheckbox: boolean) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'listForm'>('menu');
  const [rows, setRows] = useState(5);
  const [isCheckbox, setIsCheckbox] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center cursor-pointer shrink-0" title="Tools">
        <Wrench className="w-5 h-5 text-slate-500" />
      </button>
      {isOpen && (
        <div className="absolute bottom-16 left-0 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50">
          {view === 'menu' ? (
            <div className="flex flex-col gap-1">
              <button onClick={() => setView('listForm')} className="text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md">Create List</button>
              <button disabled className="text-left px-3 py-2 text-sm font-medium text-slate-400 opacity-50 cursor-not-allowed">Create Poll</button>
              <button disabled className="text-left px-3 py-2 text-sm font-medium text-slate-400 opacity-50 cursor-not-allowed">Create Thread</button>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-700">New List</span>
                <button onClick={() => { setView('menu'); setIsOpen(false); }}><X className="w-4 h-4 text-slate-400 hover:text-slate-600" /></button>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Rows (Max 50)</label>
                <input type="number" min="1" max="50" value={rows} onChange={e => setRows(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))} className="w-full mt-1 border border-slate-200 bg-slate-50 rounded-md p-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-3">
                <input type="checkbox" checked={isCheckbox} onChange={e => setIsCheckbox(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-all cursor-pointer" />
                <span className="text-sm text-slate-700 font-medium">Add Checkboxes</span>
              </label>
              <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2 text-white font-medium" onClick={() => {
                onInsertList(rows, isCheckbox);
                setIsOpen(false);
                setView('menu');
              }}>Send List</Button>
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

  const getContactName = (email: string) => {
    const contact = contacts.find(c => c.email === email);
    return contact ? contact.name : email;
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
    if (!textToSend && !customImageUrl) return;
    setInputText("");

    // Play send sound
    playMessageSendSound();

    try {
      const payload: any = {
        text: textToSend,
        senderEmail: user.email,
        createdAt: serverTimestamp()
      };
      if (customImageUrl) payload.imageUrl = customImageUrl;
      const docRef = await addDoc(collection(firestore, `dms/${activeChatId}/messages`), payload);
      // Track sent message for animation
      setJustSentIds(prev => new Set(prev).add(docRef.id));
      setTimeout(() => {
        setJustSentIds(prev => { const next = new Set(prev); next.delete(docRef.id); return next; });
      }, 500);
    } catch(e) {
      console.error(e);
      alert("Failed to send message.");
    }
  };

  const processImageFile = (file: File) => {
    if (file.type === "image/jpeg" || file.type === "image/png") {
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

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) processImageFile(file);
        break;
      }
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const contactEmail = activeChat?.participants.find(p => p !== user?.email) || "Unknown User";
  const contactDisplayName = getContactName(contactEmail);

  return (
    <div className="flex h-full w-full bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Left Pane: Chat List */}
      <div className="w-80 flex flex-col border-r border-slate-100 bg-slate-50/50 relative z-10 transition-all shrink-0">
        <div className="p-4 border-b border-slate-100 space-y-4 bg-white/50 backdrop-blur-sm">
          <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase px-2">Contacts</h2>
          
          <div className="flex flex-col gap-2 relative">
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Search contact or enter email..." 
                value={newContactEmail}
                onChange={e => {
                  setNewContactEmail(e.target.value);
                  setShowContactsDropdown(true);
                }}
                onFocus={() => setShowContactsDropdown(true)}
                onBlur={() => setTimeout(() => setShowContactsDropdown(false), 200)}
                className="h-9 text-xs flex-1 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl focus-visible:ring-indigo-100"
                onKeyDown={e => e.key === 'Enter' && handleStartChat()}
              />
              <Button size="icon" onClick={handleStartChat} className="w-9 h-9 rounded-xl bg-indigo-500 hover:bg-indigo-600 shadow-sm shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {showContactsDropdown && contacts.length > 0 && (
              <div className="absolute top-10 left-0 right-10 bg-white border border-slate-200 shadow-lg rounded-xl z-50 max-h-48 overflow-y-auto">
                {contacts.filter(c => c.name.toLowerCase().includes(newContactEmail.toLowerCase()) || c.email.includes(newContactEmail.toLowerCase())).map(contact => (
                  <div 
                    key={contact.id} 
                    className="p-2 hover:bg-indigo-50 cursor-pointer flex flex-col"
                    onMouseDown={() => {
                      setNewContactEmail(contact.email);
                      setShowContactsDropdown(false);
                    }}
                  >
                    <span className="text-xs font-bold text-slate-800">{contact.name}</span>
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
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${isActive ? 'bg-indigo-50 border border-indigo-100 shadow-sm shadow-indigo-100/50' : 'hover:bg-slate-100 border border-transparent'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                    {displayName}
                  </span>
                  <span className="text-xs text-slate-400 truncate">Direct Message</span>
                </div>
              </div>
            );
          })}
          {chats.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Search className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs font-medium">No contacts yet</p>
            </div>
          )}
        </div>
        
        {/* Current User Profile Summary Bottom Left */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-900 truncate">Me</span>
            <span className="text-[10px] text-slate-500 truncate">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Right Pane: Main Chat */}
      <div className="flex-1 flex flex-col bg-slate-50 relative min-w-0">
        {activeChatId ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-slate-200 px-6 flex items-center shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <UserCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{contactDisplayName}</h3>
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
                        : 'bg-slate-200 text-slate-800 rounded-bl-sm'
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
              <div className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200 py-1 w-48 overflow-hidden" style={{ left: contextMenu.x, top: contextMenu.y }}>
                <button onClick={() => handleDeleteForMe(contextMenu.msgId)} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 font-medium">Delete for me</button>
                {contextMenu.isMe && <button onClick={() => handleDeleteForEveryone(contextMenu.msgId)} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium">Delete for everyone</button>}
              </div>
            )}

            {/* Input Footer */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
               <div className="flex items-center gap-2 max-w-4xl mx-auto relative">
                 <ChatToolsMenu onInsertList={async (rows, isCheckbox) => {
                   const payload = Array.from({length:rows}).fill(isCheckbox ? '- [ ] ' : '- • ').join('\n');
                   const msgData = {
                     text: payload,
                     senderEmail: user?.email,
                     createdAt: serverTimestamp()
                   };
                   await addDoc(collection(firestore!, `dms/${activeChatId}/messages`), msgData);
                   bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                 }} />
                 <label className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center cursor-pointer shrink-0" title="Upload Photo">
                   <Paperclip className="w-5 h-5 text-slate-500" />
                   <input type="file" accept="image/jpeg, image/png" className="hidden" onChange={handleImageUpload} />
                 </label>
                 <Input 
                   value={inputText}
                   onChange={e => setInputText(e.target.value)}
                   onPaste={handlePaste}
                   placeholder={`Message ${contactDisplayName}...`}
                   className="flex-1 bg-slate-100 border-transparent focus-visible:ring-indigo-100 rounded-full h-12 px-6 shadow-none"
                   onKeyDown={e => e.key === 'Enter' && !e.shiftKey && inputText.trim() && handleSendMessage()}
                 />
                 <Button onClick={() => handleSendMessage()} disabled={!inputText.trim()} size="icon" className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600 shadow-md shrink-0">
                   <Send className="w-5 h-5 ml-0.5" />
                 </Button>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-300 mb-6 border border-slate-100">
               <MessageSquareX className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-700">No Chat Selected</h2>
            <p className="text-slate-400 mt-2 max-w-sm">
              Select an existing contact from the left menu or type an email address to start a new direct message thread.
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
