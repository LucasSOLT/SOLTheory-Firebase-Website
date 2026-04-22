"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, arrayUnion, arrayRemove, updateDoc, doc, deleteDoc, getDocs, setDoc } from "firebase/firestore";
import { Hash, Plus, Send, MessagesSquare, Trash2, UserPlus, Info, Shield, X, ChevronDown, Pencil, Check, Paperclip, Wrench, CornerDownRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { playMessageSendSound } from "@/lib/send-sound";

interface Channel {
  id: string;
  name: string;
  domain: string;
  createdBy: string;
  invitedUsers?: string[];
  bannedUsers?: string[];
  roles?: Record<string, "admin" | "executive" | "member">;
  parentId?: string;
  createdAt: any;
}

interface ThreadMessage {
  id: string;
  text: string;
  senderEmail: string;
  createdAt: any;
  imageUrl?: string;
  hiddenFor?: string[];
}

type Role = "admin" | "executive" | "member";

const ChatToolsMenu = ({ onInsertList }: { onInsertList: (rows: number, isCheckbox: boolean) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'listForm'>('menu');
  const [rows, setRows] = useState(5);
  const [isCheckbox, setIsCheckbox] = useState(false);

  return (
    <div className="absolute left-12 top-1/2 -translate-y-1/2 z-20">
      <button onClick={() => setIsOpen(!isOpen)} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 transition-colors flex items-center justify-center cursor-pointer" title="Tools">
        <Wrench className="w-4 h-4 text-slate-600" />
      </button>
      {isOpen && (
        <div className="absolute bottom-12 left-0 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50">
          {view === 'menu' ? (
            <div className="flex flex-col gap-1">
              <button onClick={() => setView('listForm')} className="text-left px-3 py-2 text-[15px] font-medium text-slate-700 hover:bg-slate-100 rounded-md">Create List</button>
              <button disabled className="text-left px-3 py-2 text-[15px] font-medium text-slate-400 opacity-50 cursor-not-allowed">Create Poll</button>
              <button disabled className="text-left px-3 py-2 text-[15px] font-medium text-slate-400 opacity-50 cursor-not-allowed">Create Thread</button>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-700">New List</span>
                <button onClick={() => { setView('menu'); setIsOpen(false); }} className="hover:text-slate-600"><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rows (Max 50)</label>
                <input type="number" min="1" max="50" value={rows} onChange={e => setRows(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))} className="w-full mt-1 border border-slate-200 bg-slate-50 rounded-md p-1.5 text-[15px] outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-3 mb-1">
                <input type="checkbox" checked={isCheckbox} onChange={e => setIsCheckbox(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-all cursor-pointer" />
                <span className="text-[13px] font-medium text-slate-700">Add Checkboxes</span>
              </label>
              <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-9" onClick={() => {
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
    return <p className="text-slate-700 text-[15px] leading-relaxed mt-0.5 whitespace-pre-wrap">{text}</p>;
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
    <div className="space-y-1 mt-0.5 text-[15px] leading-relaxed flex flex-col">
      {localLines.map((line, i) => {
        const t = line.trimStart();
        const isUnchecked = /^- \[ \]/.test(t);
        const isChecked = /^- \[x\]/.test(t);
        const isBullet = t.startsWith('- •');
        if (!(isUnchecked || isChecked || isBullet)) return <span key={i} className="block text-slate-700">{line}</span>;
        const content = getContent(line);
        return (
          <div key={i} className="flex items-start gap-2 group">
            {isBullet ? (
              <span className="w-4 h-4 mt-0.5 flex items-center justify-center text-slate-500 opacity-60 text-lg leading-none shrink-0">•</span>
            ) : (
              <input type="checkbox" checked={isChecked} onChange={() => handleCheckToggle(i)} onClick={e => e.stopPropagation()} className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer bg-white shrink-0" />
            )}
            {isMe ? (
              <textarea
                value={content}
                onChange={e => handleTextChange(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
                rows={1}
                className={`flex-1 bg-transparent border-none outline-none focus:ring-0 p-0 m-0 text-[15px] resize-none overflow-hidden leading-snug ${isChecked ? 'line-through opacity-60' : 'text-slate-800 placeholder-slate-400'}`}
                placeholder="Type a task..."
              />
            ) : (
              <span className={`flex-1 text-[15px] leading-snug ${isChecked ? 'line-through opacity-60' : 'text-slate-800'}`}>{content || <span className="opacity-40 italic">Empty</span>}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "text-red-600 bg-red-50 border-red-200",
  executive: "text-amber-600 bg-amber-50 border-amber-200",
  member: "text-slate-500 bg-slate-50 border-slate-200",
};

export function OrgThread() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [internalChannels, setInternalChannels] = useState<Channel[]>([]);
  const [guestChannels, setGuestChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("st_active_channel");
    if (saved) setActiveChannelId(saved);
  }, []);

  useEffect(() => {
    if (activeChannelId) sessionStorage.setItem("st_active_channel", activeChannelId);
    else sessionStorage.removeItem("st_active_channel");
  }, [activeChannelId]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [orgUsersArray, setOrgUsersArray] = useState<{ email: string }[]>([]);

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Role popup state
  const [rolePopupEmail, setRolePopupEmail] = useState<string | null>(null);

  const [lightboxImage, setLightboxImage] = useState<{url: string, name: string} | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, msgId: string, isMe: boolean} | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const userDomain = user?.email?.split("@")[1] || "";
  const getUserRole = (channel: Channel, email: string): Role => {
    if (email === "lucas@soltheory.com") return "admin";
    if (email === channel.createdBy) return "admin";
    if (channel.roles && channel.roles[email]) return channel.roles[email];
    return "member";
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist current user's email to their Firestore doc so domain queries can find them
  useEffect(() => {
    if (!firestore || !user?.uid || !user?.email) return;
    setDoc(doc(firestore, "users", user.uid), { id: user.uid, email: user.email }, { merge: true }).catch(console.error);
  }, [firestore, user?.uid, user?.email]);

  // Fetch channels for the current user's domain
  useEffect(() => {
    if (!firestore || !userDomain) return;
    const q = query(collection(firestore, "org_channels"), where("domain", "==", userDomain));
    const unsub = onSnapshot(q, (snap) => {
      const fetched: Channel[] = [];
      const safeEmail = user?.email || "";
      snap.forEach((d) => {
        const data = d.data() as Channel;
        if (!data.bannedUsers?.includes(safeEmail)) {
          fetched.push({ id: d.id, ...data });
        }
      });
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setInternalChannels(fetched);
    });
    return () => unsub();
  }, [firestore, userDomain, user?.email]);

  // Fetch channels the user is invited to as a guest
  useEffect(() => {
    if (!firestore || !user?.email) return;
    const q = query(collection(firestore, "org_channels"), where("invitedUsers", "array-contains", user.email));
    const unsub = onSnapshot(q, (snap) => {
      const fetched: Channel[] = [];
      snap.forEach((d) => {
        const data = d.data() as Channel;
        if (data.domain !== userDomain && !data.bannedUsers?.includes(user?.email || "")) {
          fetched.push({ id: d.id, ...data });
        }
      });
      fetched.sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
      setGuestChannels(fetched);
    });
    return () => unsub();
  }, [firestore, user?.email, userDomain]);

  // Fetch messages for active channel
  useEffect(() => {
    if (!firestore || !activeChannelId) return;
    const q = query(collection(firestore, `org_channels/${activeChannelId}/messages`), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: ThreadMessage[] = [];
      snap.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() } as ThreadMessage);
      });
      setMessages(msgs);
    });
    return () => unsub();
  }, [firestore, activeChannelId]);

  // Fetch users for Channel Info Panel
  useEffect(() => {
    const fetchOrgUsers = async () => {
      if (!firestore || !activeChannelId || !showChannelInfo) return;
      const actChannel = [...internalChannels, ...guestChannels].find((c) => c.id === activeChannelId);
      if (!actChannel) return;
      try {
        const membersSet = new Set<string>();

        // Source 1: Query ALL user documents and match by email domain
        const usersSnap = await getDocs(collection(firestore, "users"));
        usersSnap.forEach((d) => {
          const data = d.data();
          if (data.email && data.email.split("@")[1] === actChannel.domain) {
            membersSet.add(data.email);
          }
        });

        // Source 2: Scan createdBy field on ALL org_channels for this domain
        internalChannels.forEach((ch) => {
          if (ch.createdBy && ch.createdBy.split("@")[1] === actChannel.domain) {
            membersSet.add(ch.createdBy);
          }
        });

        // Source 3: Scan message senders in the current channel
        messages.forEach((msg) => {
          if (msg.senderEmail.split("@")[1] === actChannel.domain) {
            membersSet.add(msg.senderEmail);
          }
        });

        // Source 4: Always include the channel creator and the current user
        membersSet.add(actChannel.createdBy);
        if (user?.email?.split("@")[1] === actChannel.domain) membersSet.add(user.email);

        setOrgUsersArray(Array.from(membersSet).sort().map((email) => ({ email })));
      } catch (e) {
        console.error("Failed to fetch user list", e);
      }
    };
    fetchOrgUsers();
  }, [firestore, activeChannelId, showChannelInfo, internalChannels, guestChannels, messages, user?.email]);

  const handleCreateChannel = async () => {
    if (!firestore || !userDomain || !newChannelName.trim()) return;
    const cleanName = newChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    try {
      const docRef = await addDoc(collection(firestore, "org_channels"), {
        name: cleanName,
        domain: userDomain,
        createdBy: user?.email,
        invitedUsers: [],
        bannedUsers: [],
        roles: { [user?.email || ""]: "admin" },
        createdAt: serverTimestamp(),
      });
      setActiveChannelId(docRef.id);
      setIsCreatingChannel(false);
      setNewChannelName("");
    } catch (e) {
      console.error(e);
      alert("Failed to create channel.");
    }
  };

  const handleInviteUser = async () => {
    if (!firestore || !activeChannelId || !inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();
    try {
      const channelRef = doc(firestore, "org_channels", activeChannelId);
      await updateDoc(channelRef, {
        invitedUsers: arrayUnion(email),
        bannedUsers: arrayRemove(email), // Clear from kicked list if they were removed before
      });
      setInviteEmail("");
    } catch (e) {
      console.error(e);
      alert("Failed to invite user.");
    }
  };

  const handleSetRole = async (targetEmail: string, role: Role) => {
    if (!firestore || !activeChannelId || !activeChannel) return;
    try {
      const channelRef = doc(firestore, "org_channels", activeChannelId);
      // We must spread activeChannel.roles instead of dot notation because targetEmail contains dots (.)
      await updateDoc(channelRef, {
        roles: {
          ...(activeChannel.roles || {}),
          [targetEmail]: role
        }
      });
      setRolePopupEmail(null);
    } catch (e) {
      console.error(e);
      alert("Failed to change role.");
    }
  };

  const handleRemove = async (targetEmail: string) => {
    if (!firestore || !activeChannelId) return;
    if (!window.confirm(`Remove ${targetEmail} from this channel? You can re-add them later.`)) return;
    try {
      const channelRef = doc(firestore, "org_channels", activeChannelId);
      await updateDoc(channelRef, {
        bannedUsers: arrayUnion(targetEmail),
      });
      setRolePopupEmail(null);
    } catch (e) {
      console.error(e);
      alert("Failed to remove user.");
    }
  };

  const handleReAdd = async (targetEmail: string) => {
    if (!firestore || !activeChannelId) return;
    try {
      const channelRef = doc(firestore, "org_channels", activeChannelId);
      await updateDoc(channelRef, {
        bannedUsers: arrayRemove(targetEmail),
      });
    } catch (e) {
      console.error(e);
      alert("Failed to re-add user.");
    }
  };

  const handleDeleteChannel = async (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    if (!firestore || !channelId) return;
    if (!window.confirm("Are you sure you want to delete this channel forever?")) return;
    try {
      await deleteDoc(doc(firestore, "org_channels", channelId));
      if (activeChannelId === channelId) {
        setActiveChannelId(null);
        setShowChannelInfo(false);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete channel. Only Admins can delete channels.");
    }
  };

  const handleRenameChannel = async () => {
    if (!firestore || !activeChannelId || !renameValue.trim()) return;
    const cleanName = renameValue.trim().toLowerCase().replace(/\s+/g, "-");
    try {
      const channelRef = doc(firestore, "org_channels", activeChannelId);
      await updateDoc(channelRef, { name: cleanName });
      setIsRenaming(false);
    } catch (e) {
      console.error(e);
      alert("Failed to rename channel.");
    }
  };

  const handleSendMessage = async (customImageUrl?: string, customFileName?: string) => {
    if (!firestore || !user?.email || !activeChannelId) return;
    const textToSend = customImageUrl ? `Uploaded image: ${customFileName}` : inputText.trim();
    if (!textToSend && !customImageUrl) return;
    setInputText("");
    playMessageSendSound();
    try {
      const payload: any = {
        text: textToSend,
        senderEmail: user.email,
        createdAt: serverTimestamp(),
      };
      if (customImageUrl) payload.imageUrl = customImageUrl;
      await addDoc(collection(firestore, `org_channels/${activeChannelId}/messages`), payload);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      console.error(e);
      alert("Failed to send message.");
    }
  };

  const handleCreateSubthread = async (msg: ThreadMessage) => {
    if (!firestore || !userDomain || !activeChannelId) return;
    const baseText = msg.text ? msg.text.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).slice(0, 3).join('-').toLowerCase() : "thread";
    const threadName = `${baseText || 'thread'}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const docRef = await addDoc(collection(firestore, "org_channels"), {
        name: threadName,
        domain: userDomain,
        createdBy: user?.email,
        parentId: activeChannelId,
        invitedUsers: activeChannel?.invitedUsers || [],
        bannedUsers: activeChannel?.bannedUsers || [],
        roles: activeChannel?.roles || { [user?.email || ""]: "admin" },
        createdAt: serverTimestamp(),
      });
      setActiveChannelId(docRef.id);
      setContextMenu(null);
    } catch (e) {
      console.error(e);
      alert("Failed to create subthread.");
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
          const MAX = 800; // max size to keep base64 under reasonable limits for firestore
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
    if (!firestore || !activeChannelId) return;
    try {
      await updateDoc(doc(firestore, `org_channels/${activeChannelId}/messages`, msgId), { text: newText });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteForMe = async (msgId: string) => {
    if (!firestore || !activeChannelId || !user?.email) return;
    try {
      await updateDoc(doc(firestore, `org_channels/${activeChannelId}/messages`, msgId), { hiddenFor: arrayUnion(user.email) });
    } catch (e) { console.error(e); }
    setContextMenu(null);
  };

  const handleDeleteForEveryone = async (msgId: string) => {
    if (!firestore || !activeChannelId) return;
    try {
      await deleteDoc(doc(firestore, `org_channels/${activeChannelId}/messages`, msgId));
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

  const channels = [...internalChannels, ...guestChannels];
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const guestChannelsByDomain = guestChannels.reduce((acc, channel) => {
    if (!acc[channel.domain]) acc[channel.domain] = [];
    acc[channel.domain].push(channel);
    return acc;
  }, {} as Record<string, Channel[]>);

  const isActiveUserAdmin = activeChannel ? getUserRole(activeChannel, user?.email || "") === "admin" : false;
  const isActiveUserExecutive = activeChannel ? getUserRole(activeChannel, user?.email || "") === "executive" : false;
  const canInvite = isActiveUserAdmin || isActiveUserExecutive;

  // ---- Role popup component ----
  const RolePopup = ({ email, channel }: { email: string; channel: Channel }) => {
    const currentRole = getUserRole(channel, email);
    const roles: Role[] = ["member", "executive", "admin"];
    return (
      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="px-3 py-2 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Set Role</p>
          <p className="text-xs font-bold text-slate-700 truncate">{email.split("@")[0]}</p>
        </div>
        {roles.map((r) => (
          <button
            key={r}
            onClick={() => handleSetRole(email, r)}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold capitalize transition-colors ${
              currentRole === r ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600"
            }`}
          >
            <span>{r}</span>
            {currentRole === r && <Check className="w-3.5 h-3.5" />}
          </button>
        ))}
        <div className="border-t border-slate-100">
          <button
            onClick={() => handleRemove(email)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Remove from Channel
          </button>
        </div>
      </div>
    );
  };

  // ---- Sidebar channel item ----
  const ChannelItem = ({ channel, isSubthread }: { channel: Channel, isSubthread?: boolean }) => {
    const isActive = channel.id === activeChannelId;
    const isChAdmin = getUserRole(channel, user?.email || "") === "admin";
    return (
      <div
        onClick={() => {
          setActiveChannelId(channel.id);
          setRolePopupEmail(null);
        }}
        className={`flex items-center justify-between gap-1 py-1 px-2 rounded-md cursor-pointer transition-colors group ${
          isActive ? "bg-indigo-100 text-indigo-900" : "hover:bg-slate-200/50 text-slate-600"
        } ${isSubthread ? "ml-4 my-0.5" : "my-0.5 py-1.5"}`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          {isSubthread ? (
             <CornerDownRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
          ) : (
             <Hash className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
          )}
          <span className={`font-medium truncate ${isActive ? "font-bold" : ""} ${isSubthread ? "text-[11.5px]" : "text-[13px]"}`}>{channel.name}</span>
        </div>
        <Trash2
          className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all shrink-0 z-10"
          onClick={(e) => handleDeleteChannel(e, channel.id)}
        />
      </div>
    );
  };

  // ---- Member row in info panel ----
  const MemberRow = ({ email, channel, label }: { email: string; channel: Channel; label?: string }) => {
    const role = getUserRole(channel, email);
    const isPopupOpen = rolePopupEmail === email;
    const isSelf = email === user?.email;

    return (
      <div className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-white border border-slate-200 shadow-sm hover:border-indigo-200 transition-all relative">
        <div className="flex flex-col min-w-0 pr-2 overflow-hidden flex-1">
          <span className="text-[13px] font-bold text-slate-800 truncate">{email.split("@")[0]}</span>
          {label && <span className="text-[10px] font-semibold text-slate-400">{label}</span>}
        </div>
        <div className="flex items-center gap-1">
          {isActiveUserAdmin && !isSelf ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRolePopupEmail(isPopupOpen ? null : email);
              }}
              className={`flex items-center gap-1 h-6 px-2 rounded border text-[10px] font-bold uppercase tracking-wider transition-colors ${ROLE_COLORS[role]}`}
            >
              {role} <ChevronDown className="w-3 h-3" />
            </button>
          ) : (
            <span className={`flex items-center h-6 px-2 rounded border text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[role]}`}>
              {role}
            </span>
          )}
        </div>
        {isPopupOpen && isActiveUserAdmin && <RolePopup email={email} channel={channel} />}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-white rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm relative">
      {/* Left Pane: Server Sidebar */}
      <div className="w-64 flex flex-col border-r border-slate-100 bg-[#f8f9fa] relative z-20 shrink-0">
        <div className="h-16 px-4 border-b border-slate-200 flex items-center shadow-sm bg-white shrink-0">
          <div className="flex flex-col min-w-0">
            <h2 className="text-[13px] font-black text-slate-900 truncate uppercase tracking-widest">{userDomain || "Organization"}</h2>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Internal Server</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <div className="flex items-center justify-between px-2 pt-2 pb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Channels</span>
            <Plus className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => setIsCreatingChannel(!isCreatingChannel)} />
          </div>

          {isCreatingChannel && (
            <div className="px-2 py-2 mb-2 flex flex-col gap-2">
              <Input
                autoFocus
                placeholder="new-channel"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="h-8 text-xs rounded-md focus-visible:ring-indigo-200 bg-white shadow-sm font-medium border-slate-200"
                onKeyDown={(e) => e.key === "Enter" && handleCreateChannel()}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsCreatingChannel(false)} className="h-7 text-xs flex-1">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreateChannel} className="h-7 text-xs flex-1 bg-slate-800 hover:bg-slate-900 text-white shadow-none">
                  Create
                </Button>
              </div>
            </div>
          )}

          {internalChannels.filter(c => !c.parentId).map((channel) => (
            <React.Fragment key={channel.id}>
              <ChannelItem channel={channel} />
              {internalChannels.filter(s => s.parentId === channel.id).map(sub => (
                <ChannelItem key={sub.id} channel={sub} isSubthread={true} />
              ))}
            </React.Fragment>
          ))}

          {Object.keys(guestChannelsByDomain).length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between px-2 pt-2 pb-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Guest Access</span>
              </div>
              {Object.entries(guestChannelsByDomain).map(([domain, domainChannels]) => (
                <div key={domain} className="mb-3">
                  <div className="px-2 py-1 flex items-center gap-2">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{domain}</div>
                    <div className="h-px bg-slate-200 flex-1"></div>
                  </div>
                  {domainChannels.filter(c => !c.parentId).map((channel) => (
                    <React.Fragment key={channel.id}>
                      <ChannelItem channel={channel} />
                      {domainChannels.filter(s => s.parentId === channel.id).map(sub => (
                        <ChannelItem key={sub.id} channel={sub} isSubthread={true} />
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Pane: Channel Feed */}
      <div className="flex-1 flex flex-col bg-white relative min-w-0">
        {activeChannelId && activeChannel ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm bg-white z-10">
              <div className="flex items-center gap-2 text-slate-800">
                <Hash className="w-5 h-5 text-slate-400" />
                <h3 className="text-[15px] font-bold">{activeChannel.name}</h3>
                {activeChannel.domain !== userDomain && (
                  <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase border border-slate-200">Guest</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline-block">Channel Info.</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowChannelInfo(!showChannelInfo);
                    setRolePopupEmail(null);
                  }}
                  className={`h-8 w-8 transition-colors ${showChannelInfo ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"}`}
                >
                  <Info className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden" onClick={() => setContextMenu(null)}>
              {/* Main Chat Stream */}
              <div className="flex-1 overflow-y-auto p-0 flex flex-col relative min-w-0">
                <div className="mt-auto px-6 pt-10 pb-4 space-y-6">
                  <div className="pb-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <Hash className="w-8 h-8 text-slate-400" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2">Welcome to #{activeChannel.name}!</h1>
                    <p className="text-slate-500 text-sm font-medium">
                      This is the start of the #{activeChannel.name} channel for the {activeChannel.domain} organization.
                    </p>
                  </div>
                  <div className="h-px bg-slate-100 w-full mb-6"></div>
                  {messages.filter(m => !(m.hiddenFor || []).includes(user?.email || '')).map((msg, idx) => {
                    const isMe = msg.senderEmail === user?.email;
                    return (
                    <div key={msg.id || idx} className={`group hover:bg-[#F4F7FF] rounded-lg transition-colors flex gap-4 pr-4 py-2 ${isMe ? "bg-[#F8FAFF]" : ""}`}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: 0, y: 0, msgId: msg.id, isMe }); }}
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="font-bold text-indigo-600 text-sm">{msg.senderEmail.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 relative">
                        {contextMenu?.msgId === msg.id && (
                            <div className="absolute top-6 left-0 z-[9999] bg-white rounded-xl shadow-lg border border-slate-200 py-1 w-48 overflow-hidden pointer-events-auto">
                               <button onClick={(e) => { e.stopPropagation(); handleCreateSubthread(msg); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 font-medium">Create a subthread</button>
                               <button onClick={(e) => { e.stopPropagation(); handleDeleteForMe(contextMenu.msgId); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 font-medium">Delete for me</button>
                               {contextMenu.isMe && <button onClick={(e) => { e.stopPropagation(); handleDeleteForEveryone(contextMenu.msgId); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium">Delete for everyone</button>}
                            </div>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-[15px] text-slate-900 truncate max-w-[200px] capitalize">{msg.senderEmail.split("@")[0]}</span>
                          <span className="text-xs font-medium text-slate-400">
                            {msg.createdAt ? new Date(msg.createdAt.toMillis?.() || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                          </span>
                        </div>
                        {msg.imageUrl ? (
                          <div className="flex flex-col mt-2">
                            <span className="text-xs font-semibold text-slate-500 mb-1 truncate max-w-[200px]">{msg.text.replace('Uploaded image: ', '')}</span>
                            <img 
                              src={msg.imageUrl} 
                              alt="Uploaded Preview" 
                              className="max-w-[300px] max-h-[300px] object-cover rounded shadow-md cursor-pointer hover:opacity-90 transition-opacity" 
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
                  <div ref={bottomRef} className="h-4" />
                </div>
              </div>

              {/* Right Pane: Channel Info */}
              {showChannelInfo && (
                <div className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-300 relative z-20 overflow-y-auto">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="text-sm font-bold text-slate-800">Channel Info</h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowChannelInfo(false)} className="h-6 w-6 text-slate-400">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="p-4 flex flex-col gap-5">
                    {/* Channel Name (editable) */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Channel Name</p>
                      {isRenaming ? (
                        <div className="flex gap-2">
                          <Input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-8 text-sm flex-1 bg-slate-50 font-bold"
                            onKeyDown={(e) => e.key === "Enter" && handleRenameChannel()}
                          />
                          <Button size="icon" onClick={handleRenameChannel} className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700 shadow-none">
                            <Check className="w-4 h-4 text-white" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setIsRenaming(false)} className="h-8 w-8 text-slate-400">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-slate-800">#{activeChannel.name}</span>
                          {isActiveUserAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setRenameValue(activeChannel.name);
                                setIsRenaming(true);
                              }}
                              className="h-6 w-6 text-slate-400 hover:text-indigo-600"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Member count */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Members</p>
                        <p className="text-sm font-black text-slate-700">
                          {orgUsersArray.filter((u) => !activeChannel.bannedUsers?.includes(u.email)).length +
                            (activeChannel.invitedUsers?.filter((e) => !activeChannel.bannedUsers?.includes(e)).length || 0)}
                        </p>
                      </div>
                    </div>

                    {/* Add People */}
                    {canInvite && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Add People</p>
                        <div className="flex gap-2">
                          <Input
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="Email address"
                            className="h-8 text-xs flex-1 bg-slate-50 shadow-inner"
                            onKeyDown={(e) => e.key === "Enter" && handleInviteUser()}
                          />
                          <Button size="sm" onClick={handleInviteUser} className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-xs shadow-none">
                            Add
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Internal Org Members */}
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Organization ({activeChannel.domain})</h4>
                      <div className="space-y-2">
                        {orgUsersArray
                          .filter((u) => !activeChannel.bannedUsers?.includes(u.email))
                          .map((member) => (
                            <MemberRow key={member.email} email={member.email} channel={activeChannel} />
                          ))}
                      </div>
                    </div>

                    {/* External Guests */}
                    {activeChannel.invitedUsers && activeChannel.invitedUsers.filter((e) => !activeChannel.bannedUsers?.includes(e)).length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">External Guests</h4>
                        <div className="space-y-2">
                          {activeChannel.invitedUsers
                            .filter((e) => !activeChannel.bannedUsers?.includes(e))
                            .map((guestEmail) => (
                              <MemberRow key={guestEmail} email={guestEmail} channel={activeChannel} label="Guest" />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Removed Users */}
                    {isActiveUserAdmin && activeChannel.bannedUsers && activeChannel.bannedUsers.length > 0 && (
                      <div className="mt-2">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Removed</h4>
                        <div className="space-y-2">
                          {activeChannel.bannedUsers.map((removed) => (
                            <div key={removed} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white border border-dashed border-slate-200">
                              <span className="text-[12px] font-bold text-slate-400 truncate">{removed.split("@")[0]}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReAdd(removed)}
                                className="h-5 px-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"
                              >
                                Re-add
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="px-6 pb-6 pt-2 shrink-0 bg-white">
              <div className="relative">
                <label className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 transition-colors flex items-center justify-center cursor-pointer z-10" title="Upload Photo">
                  <Paperclip className="w-4 h-4 text-slate-600" />
                  <input type="file" accept="image/jpeg, image/png" className="hidden" onChange={handleImageUpload} />
                </label>
                <ChatToolsMenu onInsertList={async (rows, isCheckbox) => {
                   const payload = Array.from({length:rows}).fill(isCheckbox ? '- [ ] ' : '- • ').join('\n');
                   const msgData = {
                     text: payload,
                     senderEmail: user?.email,
                     createdAt: serverTimestamp()
                   };
                   await addDoc(collection(firestore!, `org_channels/${activeChannelId}/messages`), msgData);
                   bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                 }} />
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={`Message #${activeChannel.name}`}
                  className="w-full bg-slate-100 border-transparent focus-visible:ring-0 rounded-xl h-12 pl-[5.5rem] pr-12 shadow-none text-[15px] text-slate-800 placeholder:text-slate-500"
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-slate-50/50">
            <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm flex items-center justify-center text-slate-300 mb-6 border border-slate-100 rotate-12 transition-transform hover:rotate-0 duration-300">
              <MessagesSquare className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">No Channel Selected</h2>
            <p className="text-slate-500 mt-2 max-w-sm font-medium">
              Join the conversation! Choose an organization channel from the left sidebar or create a new one for your team.
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
