"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { Send, UserCircle, Plus, Search, MessageSquareX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
}

export function DMChat() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const handleSendMessage = async () => {
    if (!firestore || !user?.email || !activeChatId || !inputText.trim()) return;
    
    const textToSend = inputText.trim();
    setInputText("");

    try {
      await addDoc(collection(firestore, `dms/${activeChatId}/messages`), {
        text: textToSend,
        senderEmail: user.email,
        createdAt: serverTimestamp()
      });
    } catch(e) {
      console.error(e);
      alert("Failed to send message.");
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const contactEmail = activeChat?.participants.find(p => p !== user?.email) || "Unknown User";

  return (
    <div className="flex h-full w-full bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Left Pane: Chat List */}
      <div className="w-80 flex flex-col border-r border-slate-100 bg-slate-50/50 relative z-10 transition-all shrink-0">
        <div className="p-4 border-b border-slate-100 space-y-4 bg-white/50 backdrop-blur-sm">
          <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase px-2">Contacts</h2>
          
          <div className="flex items-center gap-2">
            <Input 
              placeholder="Enter email to DM..." 
              value={newContactEmail}
              onChange={e => setNewContactEmail(e.target.value)}
              className="h-9 text-xs flex-1 rounded-xl focus-visible:ring-indigo-100"
              onKeyDown={e => e.key === 'Enter' && handleStartChat()}
            />
            <Button size="icon" onClick={handleStartChat} className="w-9 h-9 rounded-xl bg-indigo-500 hover:bg-indigo-600 shadow-sm shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {chats.map(chat => {
            const otherEmail = chat.participants.find(p => p !== user?.email) || "Unknown";
            const isActive = chat.id === activeChatId;
            return (
              <div 
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${isActive ? 'bg-indigo-50 border border-indigo-100 shadow-sm shadow-indigo-100/50' : 'hover:bg-slate-100 border border-transparent'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                  {otherEmail.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                    {otherEmail}
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
                  <h3 className="text-sm font-bold text-slate-800">{contactEmail}</h3>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg, idx) => {
                const isMe = msg.senderEmail === user?.email;
                return (
                  <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-3xl px-5 py-3 shadow-sm ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-br-sm' 
                        : 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} className="h-1" />
            </div>

            {/* Input Footer */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
               <div className="flex items-center gap-2 max-w-4xl mx-auto">
                 <Input 
                   value={inputText}
                   onChange={e => setInputText(e.target.value)}
                   placeholder={`Message ${contactEmail}...`}
                   className="flex-1 bg-slate-100 border-transparent focus-visible:ring-indigo-100 rounded-full h-12 px-6 shadow-none"
                   onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                 />
                 <Button onClick={handleSendMessage} disabled={!inputText.trim()} size="icon" className="h-12 w-12 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-md shrink-0">
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
    </div>
  );
}
