"use client";

import React, { useState, useRef } from "react";
import { Facebook, UploadCloud, Image as ImageIcon, Video, X, Sparkles, Clock, Calendar, Send, Loader2, Eye, Trash2, Link2, CheckCircle2, AlertCircle } from "lucide-react";

interface PostItem {
  id: string;
  caption: string;
  fileName: string;
  fileType: string;
  previewUrl?: string;
  scheduledAt?: string;
  status: 'scheduled' | 'published' | 'draft';
  createdAt: string;
}

export default function FacebookPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'scheduled' | 'published'>('create');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleFileChange = (f: File) => {
    setFile(f);
    if (f.type.startsWith('image')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFileChange(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFileChange(e.target.files[0]);
  };

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const suggestions = [
      "âœ¨ New things are brewing! We can't wait to share what we've been working on. Double tap if you're excited! ðŸš€ #Innovation #ComingSoon #Excited",
      "ðŸ“¸ Captured this beautiful moment and had to share it with you all. What do you think? Drop a comment below! ðŸ’¬ #Photography #ShareTheLove",
      "ðŸŽ¯ Success is a journey, not a destination. Every step counts! Who's with us? ðŸ’ª #Motivation #Goals #KeepGoing",
    ];
    setCaption(suggestions[Math.floor(Math.random() * suggestions.length)]);
    setIsGenerating(false);
  };

  const handleCreatePost = () => {
    if (!caption.trim() && !file) return;
    const hasSchedule = scheduleDate && scheduleTime;
    const newPost: PostItem = {
      id: Date.now().toString(),
      caption,
      fileName: file?.name || 'text-post',
      fileType: file?.type.startsWith('video') ? 'video' : 'image',
      previewUrl: preview || undefined,
      scheduledAt: hasSchedule ? `${scheduleDate}T${scheduleTime}` : undefined,
      status: hasSchedule ? 'scheduled' : 'draft',
      createdAt: new Date().toISOString(),
    };
    setPosts(prev => [newPost, ...prev]);
    setFile(null);
    setPreview(null);
    setCaption("");
    setScheduleDate("");
    setScheduleTime("");
    if (hasSchedule) setActiveTab('scheduled');
  };

  const handleDeletePost = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const scheduledPosts = posts.filter(p => p.status === 'scheduled');
  const publishedPosts = posts.filter(p => p.status === 'published');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#faf6ed] overflow-y-auto">
      {/* Header */}
      <header className="px-8 py-6 border-b border-slate-200 bg-[#fefcf6] sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1877F2] flex items-center justify-center text-white shadow-sm">
              <Facebook className="w-6 h-6" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Facebook</h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">Create, schedule, and manage your Facebook content</p>
            </div>
          </div>
          {isConnected && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Connected</span>
            </div>
          )}
        </div>

        {isConnected && (
          <div className="flex gap-1 mt-5 bg-slate-100 p-1 rounded-xl w-fit">
            {[
              { key: 'create' as const, label: 'Create Post', icon: Send },
              { key: 'scheduled' as const, label: `Scheduled (${scheduledPosts.length})`, icon: Clock },
              { key: 'published' as const, label: `Published (${publishedPosts.length})`, icon: Eye },
            ].map(tab => (
              <button 
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === tab.key ? 'bg-[#fefcf6] text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="p-8 max-w-5xl mx-auto w-full">

        {/* â”€â”€ NOT CONNECTED â”€â”€ */}
        {!isConnected && (
          <div className="bg-[#fefcf6] border border-slate-200 rounded-2xl shadow-sm p-10 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#1877F2] flex items-center justify-center text-white mx-auto mb-5 shadow-md">
              <Facebook className="w-8 h-8" fill="currentColor" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Connect Your Facebook Page</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Link your Facebook Page to start creating and scheduling posts directly from your dashboard.
            </p>
            <button 
              onClick={() => setIsConnected(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1877F2] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
            >
              <Link2 className="w-5 h-5" />
              Connect Facebook Page
            </button>
            <div className="mt-6 flex items-start gap-2 text-left bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                You&apos;ll need admin access to the Facebook Page you want to connect. Personal profiles cannot be used for automated posting via Meta&apos;s API.
              </p>
            </div>
          </div>
        )}

        {/* â”€â”€ CONNECTED: CREATE TAB â”€â”€ */}
        {isConnected && activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-[#fefcf6] border border-slate-200 rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">New Post</h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Media</label>
                    {!file ? (
                      <div 
                        onDragOver={handleDragOver} onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-52 border-2 border-dashed border-slate-300 rounded-xl bg-[#faf6ed] hover:bg-blue-50/30 hover:border-blue-400 transition-all flex flex-col items-center justify-center cursor-pointer group"
                      >
                        <div className="w-12 h-12 bg-[#fefcf6] rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-slate-100">
                          <UploadCloud className="w-5 h-5 text-[#1877F2]" />
                        </div>
                        <p className="font-semibold text-slate-700 text-sm">Click or drag media to upload</p>
                        <p className="text-xs text-slate-400 mt-1">JPG, PNG, MP4, GIF â€” Max 50MB</p>
                        <div className="flex gap-4 mt-4">
                          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full"><ImageIcon className="w-3.5 h-3.5" /> Photos</span>
                          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full"><Video className="w-3.5 h-3.5" /> Videos</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full relative rounded-xl border border-slate-200 bg-[#faf6ed] overflow-hidden">
                        {preview && <div className="w-full h-48 bg-slate-100"><img src={preview} alt="Preview" className="w-full h-full object-cover" /></div>}
                        <div className="p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            {file.type.startsWith('video') ? <Video className="w-5 h-5 text-blue-600" /> : <ImageIcon className="w-5 h-5 text-blue-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                          <button onClick={() => { setFile(null); setPreview(null); }} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" className="hidden" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-700">Post Text</label>
                      <button onClick={handleAIGenerate} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer">
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {isGenerating ? 'Generating...' : 'AI Write'}
                      </button>
                    </div>
                    <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What's on your mind? Let AI help you craft the perfect post..." className="w-full h-32 px-4 py-3 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#fefcf6] focus:ring-2 focus:ring-blue-500/20 focus:border-[#1877F2] transition-all outline-none resize-none text-sm" />
                    <p className="text-[11px] text-slate-400 mt-1.5 text-right">{caption.length} / 63,206</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#fefcf6] border border-slate-200 rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Schedule</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Date</label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#fefcf6] focus:ring-2 focus:ring-blue-500/20 focus:border-[#1877F2] transition-all outline-none text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Time</label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#fefcf6] focus:ring-2 focus:ring-blue-500/20 focus:border-[#1877F2] transition-all outline-none text-sm" />
                    </div>
                  </div>
                </div>
                {scheduleDate && scheduleTime && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-700">AI will auto-post on {new Date(scheduleDate + 'T' + scheduleTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                )}
              </div>
              <div className="bg-[#fefcf6] border border-slate-200 rounded-2xl shadow-sm p-6 space-y-3">
                <button onClick={handleCreatePost} disabled={!caption.trim() && !file} className="w-full px-5 py-3 text-sm font-bold text-white bg-[#1877F2] hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  {scheduleDate ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {scheduleDate ? 'Schedule Post' : 'Post Now'}
                </button>
                <button className="w-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer">Save as Draft</button>
              </div>
              <div className="bg-[#fefcf6] border border-slate-200 rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Eye className="w-4 h-4 text-slate-500" /> Preview</h3>
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-[#fefcf6]">
                  <div className="p-3 flex items-center gap-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center"><Facebook className="w-4 h-4 text-white" fill="currentColor" /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Your Page</p>
                      <p className="text-[10px] text-slate-400">Just now Â· ðŸŒ</p>
                    </div>
                  </div>
                  {caption ? <p className="px-3 py-2 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{caption.slice(0, 200)}{caption.length > 200 ? '...' : ''}</p> : null}
                  {preview ? <img src={preview} alt="Preview" className="w-full h-32 object-cover" /> : null}
                  {!caption && !preview && <p className="px-3 py-6 text-xs text-slate-400 text-center italic">Your post preview will appear here</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ SCHEDULED TAB â”€â”€ */}
        {isConnected && activeTab === 'scheduled' && (
          <div>
            {scheduledPosts.length === 0 ? (
              <div className="bg-[#fefcf6] border border-slate-200 rounded-2xl p-12 text-center">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-700 mb-1">No scheduled posts</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">Create a post and set a date & time to schedule it for automatic publishing.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduledPosts.map(post => (
                  <div key={post.id} className="bg-[#fefcf6] border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-4 group hover:border-blue-300 transition-colors">
                    <div className="w-16 h-16 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {post.previewUrl ? <img src={post.previewUrl} alt="" className="w-full h-full object-cover" /> : (post.fileType === 'video' ? <Video className="w-6 h-6 text-blue-500" /> : <ImageIcon className="w-6 h-6 text-blue-500" />)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 font-medium leading-relaxed line-clamp-2">{post.caption || <span className="italic text-slate-400">No caption</span>}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No date'}
                        </span>
                        <span className="text-[11px] text-slate-400">{post.fileName}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeletePost(post.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ PUBLISHED TAB â”€â”€ */}
        {isConnected && activeTab === 'published' && (
          <div className="bg-[#fefcf6] border border-slate-200 rounded-2xl p-12 text-center">
            <Eye className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">No published posts yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">Posts will appear here once they are published to your Facebook Page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
