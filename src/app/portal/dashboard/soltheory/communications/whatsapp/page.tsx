"use client";

import React, { useState } from "react";
import { MessageCircle, Search, Phone, Video, MoreVertical, Send, Smile, Paperclip, Mic, Check, CheckCheck, X, ChevronRight, Settings, Bot, User, Shield, Zap, Sparkles, ArrowLeft } from "lucide-react";

type Chat = { id: string; name: string; lastMsg: string; time: string; unread: number; avatar: string; online: boolean };
type Message = { id: string; text: string; time: string; fromMe: boolean; status: "sent" | "delivered" | "read"; aiDraft?: string };

export default function WhatsAppPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [chats] = useState<Chat[]>([]);
  const [messages] = useState<Message[]>([]);
  const [draftingMessageId, setDraftingMessageId] = useState<string | null>(null);

  // Settings state
  const [assistantName, setAssistantName] = useState("Aria");
  const [userName, setUserName] = useState("");
  const [useFirstPerson, setUseFirstPerson] = useState(true);
  const [autoReplyRules, setAutoReplyRules] = useState([{ id: "1", contactName: "", responseTemplate: "", context: "", enabled: true }]);
  const [summaryEnabled, setSummaryEnabled] = useState(true);
  const [sentimentEnabled, setSentimentEnabled] = useState(true);

  // Connect screen
  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center relative h-full rounded-3xl overflow-hidden">
        {/* Blurred WhatsApp-like background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
          <div className="absolute inset-0 backdrop-blur-0">
            {/* Fake chat list skeleton - blurred */}
            <div className="flex h-full">
              <div className="w-[380px] border-r border-slate-200/60 bg-white/60 backdrop-blur-sm">
                <div className="h-16 bg-slate-100/80 border-b border-slate-200/50 flex items-center px-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200/60" />
                  <div className="ml-3 space-y-2">
                    <div className="w-24 h-3 bg-slate-200/60 rounded" />
                    <div className="w-16 h-2 bg-slate-200/40 rounded" />
                  </div>
                </div>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100/50">
                    <div className="w-12 h-12 rounded-full bg-slate-200/50 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between">
                        <div className={`h-3 bg-slate-200/50 rounded`} style={{ width: `${60 + i * 10}px` }} />
                        <div className="w-10 h-2 bg-slate-200/30 rounded" />
                      </div>
                      <div className="h-2 bg-slate-200/30 rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex-1 bg-[#efeae2]/30 flex items-center justify-center">
                <div className="text-center space-y-3 opacity-30">
                  <MessageCircle className="w-20 h-20 text-slate-400 mx-auto" />
                  <div className="w-48 h-4 bg-slate-200/60 rounded mx-auto" />
                  <div className="w-32 h-3 bg-slate-200/40 rounded mx-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Blur overlay */}
        <div className="absolute inset-0 backdrop-blur-md bg-white/40" />

        {/* Connect Card */}
        <div className="relative z-10 max-w-md w-full mx-4">
          <div className="bg-white rounded-3xl shadow-2xl shadow-emerald-900/10 border border-slate-200/60 p-10 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Connect WhatsApp</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
              Link your WhatsApp account to enable AI-powered message management, auto-replies, and conversation summaries.
            </p>
            <button
              onClick={() => setIsConnected(true)}
              className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Connect WhatsApp Account
            </button>
            <p className="text-[11px] text-slate-400 mt-4">
              Your messages are end-to-end encrypted and never stored on our servers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main WhatsApp UI
  return (
    <div className="flex-1 flex h-full rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      {/* Chat List Sidebar */}
      <div className="w-[360px] flex flex-col border-r border-slate-200 bg-white shrink-0">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 bg-slate-50/80 border-b border-slate-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <MessageCircle className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-sm text-slate-800">WhatsApp</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-500"><Sparkles className="w-4 h-4" /></button>
            <button onClick={() => setSettingsOpen(!settingsOpen)} className="p-2 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-500"><MoreVertical className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Search or start new chat" className="w-full h-9 pl-10 pr-4 bg-slate-100 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-300 border-0" />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                <MessageCircle className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">Messages will appear here once synced.</p>
            </div>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-slate-100/60 ${selectedChat === chat.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-500">
                    {chat.avatar}
                  </div>
                  {chat.online && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 truncate">{chat.name}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{chat.time}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-slate-500 truncate">{chat.lastMsg}</span>
                    {chat.unread > 0 && (
                      <span className="ml-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{chat.unread}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#efeae2]/20 relative">
        {!selectedChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-12">
            <div className="w-24 h-24 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center mb-6">
              <MessageCircle className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">WhatsApp for INSiGHT</h3>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              Select a conversation to view messages. Double-click any received message to generate an AI-drafted reply.
            </p>
            <div className="flex items-center gap-4 mt-8">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-500">
                <Shield className="w-3.5 h-3.5 text-emerald-500" /> End-to-end encrypted
              </div>
              <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors">
                <Settings className="w-3.5 h-3.5" /> Agent Settings
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-14 flex items-center justify-between px-4 bg-slate-50/90 border-b border-slate-200/60 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedChat(null)} className="md:hidden p-1 hover:bg-slate-200 rounded-lg text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-500">
                  {chats.find(c => c.id === selectedChat)?.avatar || "?"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{chats.find(c => c.id === selectedChat)?.name || "Contact"}</div>
                  <div className="text-[11px] text-emerald-600 font-medium">online</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-500"><Phone className="w-4 h-4" /></button>
                <button className="p-2 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-500"><Video className="w-4 h-4" /></button>
                <button onClick={() => setSettingsOpen(!settingsOpen)} className="p-2 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-500"><MoreVertical className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-xs text-slate-400 bg-white/80 px-4 py-2 rounded-lg shadow-sm border border-slate-200/50">Messages will appear here once synced</p>
                </div>
              ) : (
                <div className="space-y-1 max-w-3xl mx-auto">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                      onDoubleClick={() => !msg.fromMe && setDraftingMessageId(msg.id)}
                    >
                      <div className={`max-w-[65%] px-3 py-2 rounded-xl text-sm relative group ${msg.fromMe ? 'bg-emerald-100 text-slate-800 rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm shadow-sm border border-slate-100 cursor-pointer'}`}>
                        <span>{msg.text}</span>
                        <span className="text-[10px] text-slate-400 ml-2 inline-flex items-center gap-0.5 float-right mt-1">
                          {msg.time}
                          {msg.fromMe && (msg.status === "read" ? <CheckCheck className="w-3 h-3 text-blue-500" /> : <Check className="w-3 h-3" />)}
                        </span>
                        {!msg.fromMe && (
                          <div className="absolute -bottom-6 left-0 hidden group-hover:flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                            <Sparkles className="w-3 h-3" /> Double-click to draft AI reply
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Draft Banner */}
            {draftingMessageId && (
              <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-200/60 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-emerald-700">AI Draft Generated</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Review and send the suggested response</p>
                </div>
                <button onClick={() => setDraftingMessageId(null)} className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-500"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200/60 shrink-0">
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-500"><Smile className="w-5 h-5" /></button>
                <button className="p-2 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-500"><Paperclip className="w-5 h-5" /></button>
                <input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="Type a message"
                  className="flex-1 h-10 px-4 bg-white rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-300 border border-slate-200"
                />
                <button className="p-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors text-white">
                  {inputValue.trim() ? <Send className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Settings Sidebar */}
      {settingsOpen && (
        <div className="w-[400px] flex flex-col border-l border-slate-200 bg-white shrink-0 animate-in slide-in-from-right duration-300 overflow-y-auto">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 bg-slate-50/80 border-b border-slate-200/60 shrink-0">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-600" />
              <span className="font-bold text-sm text-slate-800">Agent Configuration</span>
            </div>
            <button onClick={() => setSettingsOpen(false)} className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-400"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-5 space-y-6">
            {/* Agent Identity */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Bot className="w-3.5 h-3.5" /> Agent Identity</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Assistant Name</label>
                  <input value={assistantName} onChange={e => setAssistantName(e.target.value)} placeholder="e.g. Aria" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-300" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Your Name <span className="text-slate-400 font-normal">(or N/A to stay anonymous)</span></label>
                  <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="e.g. Lucas, or N/A" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-300" />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-sm font-semibold text-slate-700">First-person mode</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">AI responds as you, not as an assistant</p>
                  </div>
                  <button onClick={() => setUseFirstPerson(!useFirstPerson)} className={`w-10 h-6 rounded-full transition-colors relative ${useFirstPerson ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-all ${useFirstPerson ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            {/* Auto-Reply Rules */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Zap className="w-3.5 h-3.5" /> Auto-Reply Rules</h4>
              <div className="space-y-3">
                {autoReplyRules.map((rule, idx) => (
                  <div key={rule.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rule {idx + 1}</span>
                      <button onClick={() => setAutoReplyRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))} className={`w-8 h-5 rounded-full transition-colors relative ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm absolute top-1 transition-all ${rule.enabled ? 'left-4' : 'left-1'}`} />
                      </button>
                    </div>
                    <input value={rule.contactName} onChange={e => setAutoReplyRules(prev => prev.map(r => r.id === rule.id ? { ...r, contactName: e.target.value } : r))} placeholder="Contact name or phone" className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300" />
                    <textarea value={rule.responseTemplate} onChange={e => setAutoReplyRules(prev => prev.map(r => r.id === rule.id ? { ...r, responseTemplate: e.target.value } : r))} placeholder="Response template or instructions..." rows={2} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300 resize-none" />
                    <input value={rule.context} onChange={e => setAutoReplyRules(prev => prev.map(r => r.id === rule.id ? { ...r, context: e.target.value } : r))} placeholder="Additional context (optional)" className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300" />
                  </div>
                ))}
                <button onClick={() => setAutoReplyRules(prev => [...prev, { id: Date.now().toString(), contactName: "", responseTemplate: "", context: "", enabled: true }])} className="w-full h-9 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                  + Add Rule
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            {/* AI Features */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> AI Features</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-sm font-semibold text-slate-700">Conversation Summaries</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Auto-generate summaries using Org Brain</p>
                  </div>
                  <button onClick={() => setSummaryEnabled(!summaryEnabled)} className={`w-10 h-6 rounded-full transition-colors relative ${summaryEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-all ${summaryEnabled ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-sm font-semibold text-slate-700">Sentiment Analysis</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Detect tone and urgency of messages</p>
                  </div>
                  <button onClick={() => setSentimentEnabled(!sentimentEnabled)} className={`w-10 h-6 rounded-full transition-colors relative ${sentimentEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-all ${sentimentEnabled ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200/60">
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Knowledge Sources</p>
                  <p className="text-[11px] text-emerald-600 mt-1 leading-relaxed">
                    Drafts are powered by Org Brain context, P.A.C.T. user facts, and the rules defined above.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
