"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { Hash, Plus, Send, MessagesSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Channel {
  id: string;
  name: string;
  domain: string;
  createdAt: any;
}

interface ThreadMessage {
  id: string;
  text: string;
  senderEmail: string;
  createdAt: any;
}

export function OrgThread() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  const userDomain = user?.email?.split('@')[1] || "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch channels for the current user's domain
  useEffect(() => {
    if (!firestore || !userDomain) return;

    const q = query(
      collection(firestore, "org_channels"),
      where("domain", "==", userDomain)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetched: Channel[] = [];
      snap.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Channel);
      });
      // Sort alphabetically
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setChannels(fetched);
    });

    return () => unsub();
  }, [firestore, userDomain]);

  // Fetch messages for active channel
  useEffect(() => {
    if (!firestore || !activeChannelId) return;

    const q = query(
      collection(firestore, `org_channels/${activeChannelId}/messages`),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs: ThreadMessage[] = [];
      snap.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() } as ThreadMessage);
      });
      setMessages(msgs);
    });

    return () => unsub();
  }, [firestore, activeChannelId]);

  const handleCreateChannel = async () => {
    if (!firestore || !userDomain || !newChannelName.trim()) return;
    
    // Format channel name
    let cleanName = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
      const docRef = await addDoc(collection(firestore, "org_channels"), {
        name: cleanName,
        domain: userDomain,
        createdBy: user?.email,
        createdAt: serverTimestamp()
      });
      setActiveChannelId(docRef.id);
      setIsCreatingChannel(false);
      setNewChannelName("");
    } catch(e) {
      console.error(e);
      alert("Failed to create channel.");
    }
  };

  const handleSendMessage = async () => {
    if (!firestore || !user?.email || !activeChannelId || !inputText.trim()) return;
    
    const textToSend = inputText.trim();
    setInputText("");

    try {
      await addDoc(collection(firestore, `org_channels/${activeChannelId}/messages`), {
        text: textToSend,
        senderEmail: user.email,
        createdAt: serverTimestamp()
      });
    } catch(e) {
      console.error(e);
      alert("Failed to send message to channel.");
    }
  };

  const activeChannel = channels.find(c => c.id === activeChannelId);

  return (
    <div className="flex h-full w-full bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Left Pane: Server Sidebar */}
      <div className="w-64 flex flex-col border-r border-slate-100 bg-[#f8f9fa] relative z-10 shrink-0">
        <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between shadow-sm bg-white shrink-0">
          <div className="flex flex-col min-w-0">
            <h2 className="text-[13px] font-black text-slate-900 truncate uppercase tracking-widest">{userDomain || "Organization"}</h2>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Internal Server</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <div className="flex items-center justify-between px-2 pt-2 pb-1 group">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Channels</span>
            <Plus 
              className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-800 transition-colors" 
              onClick={() => setIsCreatingChannel(!isCreatingChannel)}
            />
          </div>

          {isCreatingChannel && (
            <div className="px-2 py-2 mb-2 flex flex-col gap-2">
              <Input 
                autoFocus
                placeholder="new-channel" 
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                className="h-8 text-xs rounded-md focus-visible:ring-indigo-200 bg-white shadow-sm font-medium border-slate-200"
                onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsCreatingChannel(false)} className="h-7 text-xs flex-1">Cancel</Button>
                <Button size="sm" onClick={handleCreateChannel} className="h-7 text-xs flex-1 bg-slate-800 hover:bg-slate-900 text-white shadow-none">Create</Button>
              </div>
            </div>
          )}

          {channels.map(channel => {
            const isActive = channel.id === activeChannelId;
            return (
              <div 
                key={channel.id}
                onClick={() => setActiveChannelId(channel.id)}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${isActive ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-slate-200/50 text-slate-600'}`}
              >
                <Hash className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className={`text-[13px] font-medium truncate ${isActive ? 'font-bold' : ''}`}>
                  {channel.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Pane: Channel Feed */}
      <div className="flex-1 flex flex-col bg-white relative min-w-0">
        {activeChannelId ? (
          <>
            <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm bg-white z-10">
              <div className="flex items-center gap-2 text-slate-800">
                <Hash className="w-5 h-5 text-slate-400" />
                <h3 className="text-[15px] font-bold">{activeChannel?.name}</h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 flex flex-col">
              <div className="mt-auto px-6 pt-10 pb-4 space-y-6">
                {/* Intro block */}
                <div className="pb-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <Hash className="w-8 h-8 text-slate-400" />
                  </div>
                  <h1 className="text-3xl font-black text-slate-900 mb-2">Welcome to #{activeChannel?.name}!</h1>
                  <p className="text-slate-500 text-sm font-medium">This is the start of the #{activeChannel?.name} channel for the {userDomain} organization.</p>
                </div>

                <div className="h-px bg-slate-100 w-full mb-6"></div>

                {messages.map((msg, idx) => {
                  return (
                    <div key={msg.id || idx} className="group hover:bg-slate-50/80 p-0 rounded-lg transition-colors flex gap-4 pr-4 py-1">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="font-bold text-indigo-600 text-sm">{msg.senderEmail.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-[15px] text-slate-900 truncate max-w-[200px]">{msg.senderEmail.split('@')[0]}</span>
                          <span className="text-xs font-medium text-slate-400">
                            {msg.createdAt ? new Date(msg.createdAt.toMillis?.() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                          </span>
                        </div>
                        <p className="text-slate-700 text-[15px] leading-relaxed mt-0.5 whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} className="h-4" />
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 shrink-0 bg-white">
               <div className="relative">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center pointer-events-none">
                    <Plus className="w-4 h-4 text-slate-500" />
                 </div>
                 <Input 
                   value={inputText}
                   onChange={e => setInputText(e.target.value)}
                   placeholder={`Message #${activeChannel?.name}`}
                   className="w-full bg-slate-100 border-transparent focus-visible:ring-0 rounded-xl h-12 pl-12 pr-12 shadow-none text-[15px] text-slate-800 placeholder:text-slate-500"
                   onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
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
    </div>
  );
}
