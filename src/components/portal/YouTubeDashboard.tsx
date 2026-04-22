"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Menu, Settings, TrendingUp, Users, Clock, Sparkles, MessageSquare, X, Send, Bot, Play, Loader2, User, Youtube, Lightbulb, UserCheck, PlaySquare, Video, Upload, FileVideo, Trash2, CheckCircle, ChevronDown, ChevronUp, Edit2, Save } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { doc, getDoc, setDoc, collection, onSnapshot, addDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

export function YouTubeDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const [strategy, setStrategy] = useState({
    targetDemographic: "Young Adult Entrepreneurs",
    tone: "Professional but energetic",
    purpose: "Educational and inspirational",
    permanentDescription: "",
    socialLinks: "",
    contactEmail: ""
  });
  const [isStrategyExpanded, setIsStrategyExpanded] = useState(true);
  const [ytTestResult, setYtTestResult] = useState<string | null>(null);
  const [channelStats, setChannelStats] = useState<{views: string, subs: string} | null>(null);
  const [channelBranding, setChannelBranding] = useState<{title: string, profileUrl: string, bannerUrl: string} | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<{id: string, text: string, isSelf: boolean}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { t } = useTranslation();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [drafts, setDrafts] = useState<any[]>([]);
  const [isFetchingDrafts, setIsFetchingDrafts] = useState(false);

  // Video upload state
  const [uploadedVideo, setUploadedVideo] = useState<{ name: string; url: string; storagePath: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [isDeletingDraft, setIsDeletingDraft] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: '', tags: '' });
  const [isSavingDraft, setIsSavingDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !firestore) return;
    setIsFetchingDrafts(true);
    
    // Timeout fallback: if Firestore doesn't respond in 5s, stop showing the spinner
    const timeout = setTimeout(() => {
      setIsFetchingDrafts(false);
    }, 5000);
    
    const unsub = onSnapshot(
      collection(firestore, "users", user.uid, "youtube_drafts"),
      (snap) => {
        clearTimeout(timeout);
        const jobs: any[] = [];
        snap.forEach(doc => jobs.push({ id: doc.id, ...doc.data() }));
        setDrafts(jobs);
        setIsFetchingDrafts(false);
      },
      (err) => {
        clearTimeout(timeout);
        console.error("YouTube drafts listener error:", err);
        setIsFetchingDrafts(false);
      }
    );
    return () => { clearTimeout(timeout); unsub(); };
  }, [user, firestore]);

  useEffect(() => {
    if (!user || !firestore) return;
    getDoc(doc(firestore, "users", user.uid, "settings", "youtube_director")).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.strategy) {
          setStrategy(prev => ({ ...prev, ...data.strategy }));
        } else if (data.demographic) {
          setStrategy(prev => ({ ...prev, targetDemographic: data.demographic }));
        }
      }
    }).catch(() => {});
  }, [user, firestore]);

  useEffect(() => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages, isTyping]);

  useEffect(() => {
    if (!user || !firestore) return;
    const fetchStats = async () => {
      try {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        if (!docData) return;
        const rToken = docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken || docData?.gmailOAuth?.refreshToken;
        if (!rToken) return;
        
        const res = await fetch("/api/youtube/stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rToken })
        });
        const data = await res.json();
        if (data.success && data.stats) {
          setChannelStats({
            views: parseInt(data.stats.viewCount).toLocaleString(),
            subs: parseInt(data.stats.subscriberCount).toLocaleString()
          });
        }
        if (data.success && data.branding) {
          setChannelBranding(data.branding);
        }
      } catch (e) {
        console.error("Failed to fetch youtube stats", e);
      }
    };
    fetchStats();
  }, [user, firestore]);

  const handleUpdateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    try {
       await setDoc(doc(firestore, "users", user.uid, "settings", "youtube_director"), { strategy }, { merge: true });
       alert("Strategy updated successfully!");
       setIsStrategyExpanded(false);
    } catch(err) {
       console.error(err);
    }
  };

  const handleTestYouTube = async () => {
    setYtTestResult("Testing...");
    
    // Check auth state
    if (!user) { 
      setYtTestResult("❌ User is null — you may not be logged in. Please sign in and refresh."); 
      return; 
    }
    if (!firestore) { 
      setYtTestResult("❌ Firestore is null — Firebase services not ready."); 
      return; 
    }
    
    try {
      const docSnap = await getDoc(doc(firestore, "users", user.uid));
      const docData = docSnap.data();
      
      if (!docData) {
        setYtTestResult(`❌ No user document found in Firestore for UID: ${user.uid}`);
        return;
      }
      
      // Check all possible token locations
      const tokenLocations = {
        gmailOAuth_jarvis: docData?.gmailOAuth_jarvis?.refreshToken || null,
        gmailOAuth_morpheus: docData?.gmailOAuth_morpheus?.refreshToken || null,
        gmailOAuth: docData?.gmailOAuth?.refreshToken || null,
      };
      
      const rToken = tokenLocations.gmailOAuth_jarvis || tokenLocations.gmailOAuth_morpheus || tokenLocations.gmailOAuth;
      
      if (!rToken) { 
        setYtTestResult(`❌ No Google OAuth token found.\n\nToken locations checked:\n- gmailOAuth_jarvis: ${tokenLocations.gmailOAuth_jarvis ? '✅ found' : '❌ empty'}\n- gmailOAuth_morpheus: ${tokenLocations.gmailOAuth_morpheus ? '✅ found' : '❌ empty'}\n- gmailOAuth: ${tokenLocations.gmailOAuth ? '✅ found' : '❌ empty'}\n\n→ Go to Dashboard Settings and connect your Google account.`); 
        return; 
      }
      
      const res = await fetch("/api/test-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rToken })
      });
      const data = await res.json();
      if (data.hasYouTubeScope && data.channelInfo?.success) {
        setYtTestResult(`✅ Connected! Channel: ${data.channelInfo.channelTitle}`);
      } else if (!data.hasYouTubeScope) {
        setYtTestResult(`❌ Missing YouTube scope. Disconnect and reconnect Google in Dashboard Settings.\n\nCurrent scopes:\n${(data.scopes || "none").split(" ").join("\n")}`);
      } else {
        setYtTestResult(`⚠️ YouTube scope present but API failed: ${data.channelInfo?.error}`);
      }
    } catch (err: any) {
      setYtTestResult(`❌ Error: ${err.message}`);
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!user || !storage) return;
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid video file (MP4, WebM, MOV, AVI, MKV)');
      return;
    }
    if (file.size > 5000 * 1024 * 1024) {
      alert('File too large. Max 5GB.');
      return;
    }

    const storagePath = `users/${user.uid}/youtube_uploads/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(progress);
      },
      (error) => {
        console.error('Upload failed:', error);
        setUploadProgress(null);
        alert('Upload failed: ' + error.message);
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        setUploadedVideo({ name: file.name, url: downloadUrl, storagePath });
        setUploadProgress(null);
      }
    );
  };

  const handleRemoveVideo = async () => {
    if (!uploadedVideo || !storage) return;
    try {
      await deleteObject(ref(storage, uploadedVideo.storagePath));
    } catch (e) { console.error('Failed to delete from storage:', e); }
    setUploadedVideo(null);
  };

  const handleDeleteDraft = async (draftId: string, youtubeId?: string, youtubeType?: string) => {
    if (!user || !firestore) return;
    if (!confirm("Are you sure you want to delete this concept? If it's linked to a YouTube entity, it will be deleted from YouTube Studio as well.")) return;
    
    setIsDeletingDraft(draftId);
    try {
      if (youtubeId && youtubeType) {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        const rToken = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken) || docData?.gmailOAuth?.refreshToken || null;
        
        if (rToken) {
          const res = await fetch("/api/youtube/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ youtubeId, type: youtubeType, refreshToken: rToken })
          });
          if (!res.ok) console.error("Failed to delete from YouTube API");
        }
      }
      
      await deleteDoc(doc(firestore, "users", user.uid, "youtube_drafts", draftId));
      
      if (draftId.startsWith('local_')) {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
      }
    } catch (e) {
      console.error("Error deleting draft:", e);
      alert("Failed to delete concept.");
    } finally {
      setIsDeletingDraft(null);
    }
  };

  const handleSaveDraft = async (draft: any) => {
    if (!user || !firestore) return;
    setIsSavingDraft(draft.id);
    
    try {
      const updatedTags = editForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      
      if (draft.youtubeId && draft.youtubeType) {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        const rToken = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken) || docData?.gmailOAuth?.refreshToken || null;
        
        if (rToken) {
          const res = await fetch("/api/youtube/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              youtubeId: draft.youtubeId, 
              type: draft.youtubeType, 
              title: draft.title,
              description: editForm.description,
              tags: updatedTags,
              refreshToken: rToken 
            })
          });
          if (!res.ok) throw new Error("Failed to update on YouTube API");
        }
      }
      
      if (!draft.id.startsWith('local_')) {
        await setDoc(doc(firestore, "users", user.uid, "youtube_drafts", draft.id), {
          description: editForm.description,
          tags: editForm.tags
        }, { merge: true });
      }
      
      setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, description: editForm.description, tags: editForm.tags } : d));
      setEditingDraftId(null);
    } catch (e) {
      console.error("Error saving draft:", e);
      alert("Failed to save changes.");
    } finally {
      setIsSavingDraft(null);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isTyping) return;

    const userMsg = { id: uid(), text: chatMessage, isSelf: true };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setChatMessage("");

    try {
      let rToken = null;
      if (user?.uid && firestore) {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        rToken = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken) || docData?.gmailOAuth?.refreshToken || null;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({
            role: m.isSelf ? "user" : "assistant",
            content: m.text
          })), 
          agentId: `nxtchapter_youtube_director`,
          videoUrl: uploadedVideo?.url || null,
          soul: `You are the YouTube Creative Director AI, living inside a tiny dashboard popup chat widget.

The user's CURRENT Strategy Configuration is:
- Target Audience: ${strategy.targetDemographic}
- Tone: ${strategy.tone}
- Purpose: ${strategy.purpose}
- Permanent Description Text: ${strategy.permanentDescription}
- Social Links: ${strategy.socialLinks}
- Contact Email: ${strategy.contactEmail}

Tailor all ideas, descriptions, and tags to strictly align with this strategy.

${uploadedVideo ? `[VIDEO FILE AVAILABLE]: The user has uploaded a video file named "${uploadedVideo.name}". When they ask you to create/draft a video, the system will AUTOMATICALLY attach this video file to the YouTube upload. A REAL video draft will appear in their YouTube Studio Videos tab.` : `[NO VIDEO FILE]: The user has not uploaded a video file yet. When they ask to create a video, the system will create a Draft Playlist on YouTube with the metadata. Suggest they upload a video file on the dashboard for a full YouTube video draft.`}

[ABSOLUTE RULES - YOU MUST FOLLOW THESE]:

RULE 1 — BREVITY: Your chat responses must be 1-2 sentences MAX. You live in a tiny popup. NEVER output scripts, JSON, descriptions, hashtags, or any video metadata in your chat reply. The dashboard handles displaying that data separately.

RULE 2 — TOOL USAGE: When the user asks to draft, create, brainstorm, or make a video, you MUST call the \`draft_youtube_video\` tool. Pass the title, description, tags, and full script ONLY through the tool parameters. Do NOT write ANY of that content in your chat message.

RULE 3 — RESPONSE FORMAT: After calling the tool, your ENTIRE chat reply must be ONLY a brief confirmation like: "Done! I've pushed your draft to YouTube Studio and your Concept Board." Then append the tracking marker at the very end.

RULE 4 — TRACKING MARKER: You MUST extract the ID and TYPE from the [YOUTUBE_METADATA] tag in the tool result, and append this marker to the very end of your brief confirmation: [DRAFT_CREATED: <Title> | <Description> | <Tags> | <YouTubeId> | <Type>]
Full example of a correct response: "Done! Your video draft has been pushed to YouTube Studio — check your Concept Board! [DRAFT_CREATED: How To Start A Business | A beginner guide to entrepreneurship | business, startup, entrepreneur | ABC123XYZ | video]"

RULE 5 — DEMOGRAPHIC UPDATES: If the user asks to change their target audience, confirm briefly and append: [DEMOGRAPHIC_UPDATED: <New Audience>]

NEVER output the script content, video metadata, JSON objects, or any long-form content in the chat.`,
          brain: `You have real API tools. ALWAYS use draft_youtube_video tool when asked to make a video. Your chat reply must be MAX 1-2 sentences. NEVER output scripts or metadata in chat. ${uploadedVideo ? 'A VIDEO FILE IS READY — the system will upload it to YouTube when you call the tool.' : 'No video file uploaded yet.'}`,
          uid: user?.uid,
          refreshToken: rToken,
          contacts: [],
          knowledgeBaseText: ""
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get response");
      
      let aiResponseText = data.response || "No response generated.";

      // Parse AI response for tracking markers and update the Concept Board
      // Parse Draft Concept — ALWAYS update local UI state first
      const draftMatch = aiResponseText.match(/\[DRAFT_CREATED:\s*(.*?)\s*\|\s*(.*?)(?:\s*\|\s*(.*?))?(?:\s*\|\s*(.*?))?(?:\s*\|\s*(.*?))?\]/);
      if (draftMatch) {
        const title = draftMatch[1].trim();
        const desc = draftMatch[2].trim();
        const tagsText = draftMatch[3] ? draftMatch[3].trim() : "AI, Trending, Educational";
        const youtubeId = draftMatch[4] ? draftMatch[4].trim() : null;
        const youtubeType = draftMatch[5] ? draftMatch[5].trim() : null;
        aiResponseText = aiResponseText.replace(/\[DRAFT_CREATED:.*?\]/g, "").trim();
        
        // Immediately add to local drafts state so it shows on the Concept Board RIGHT NOW
        const newDraft = {
          id: `local_${Date.now()}`,
          title,
          description: desc,
          status: uploadedVideo ? "Uploaded to YouTube" : "Draft Created",
          tags: tagsText,
          youtubeId,
          youtubeType,
          videoUrl: uploadedVideo ? uploadedVideo.url : null
        };
        setDrafts(prev => [...prev, newDraft]);
        
        // Clear uploaded video after successful draft
        if (uploadedVideo) {
          setUploadedVideo(null);
        }
        
        // Also attempt to persist to Firestore (may fail if rules aren't deployed — that's okay)
        if (user && firestore) {
          try {
            await addDoc(collection(firestore, "users", user.uid, "youtube_drafts"), {
              title,
              description: desc,
              status: uploadedVideo ? "Uploaded to YouTube" : "Draft Created",
              tags: tagsText,
              youtubeId,
              youtubeType,
              videoUrl: uploadedVideo ? uploadedVideo.url : null
            });
          } catch(e) { console.error("Firestore write failed (rules may not be deployed):", e); }
        }
      }

      // Parse Demographic Update
      const demoMatch = aiResponseText.match(/\[DEMOGRAPHIC_UPDATED:\s*(.*?)\]/);
      if (demoMatch) {
        const newDemo = demoMatch[1].trim();
        aiResponseText = aiResponseText.replace(/\[DEMOGRAPHIC_UPDATED:.*?\]/g, "").trim();
        setStrategy(prev => ({ ...prev, targetDemographic: newDemo }));
        
        if (user && firestore) {
          try {
            await setDoc(doc(firestore, "users", user.uid, "settings", "youtube_director"), { strategy: { ...strategy, targetDemographic: newDemo } }, { merge: true });
          } catch(e) { console.error("Failed to update demographic:", e); }
        }
      }

      setMessages(prev => [...prev, { id: uid(), text: aiResponseText, isSelf: false }]);
    } catch (error: any) {
       setMessages(prev => [...prev, { id: uid(), text: `Error: ${error.message}`, isSelf: false }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mr-4">
            <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center shadow-sm">
              <Youtube className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-medium text-slate-700 tracking-tight">
              YouTube Creative Director
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
        
        {/* Unified 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Main Left Area - Metrics, Branding, Concepts */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Top Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                   <Video className="w-6 h-6 text-indigo-600" />
                 </div>
                 <div>
                   <p className="text-sm text-slate-500 font-medium">Total Channel Views</p>
                   <h3 className="text-2xl font-bold text-slate-800">{channelStats ? channelStats.views : "..."}</h3>
                   <p className="text-xs text-emerald-600 font-medium flex items-center mt-0.5">
                     <TrendingUp className="w-3 h-3 mr-1" /> Live YouTube Data
                   </p>
                 </div>
               </div>

               <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                   <Users className="w-6 h-6 text-red-600" />
                 </div>
                 <div>
                   <p className="text-sm text-slate-500 font-medium">Total Subscribers</p>
                   <h3 className="text-2xl font-bold text-slate-800">{channelStats ? channelStats.subs : "..."}</h3>
                   <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center">
                     <TrendingUp className="w-3 h-3 mr-1" /> Live YouTube Data
                   </p>
                 </div>
               </div>
            </div>

            {/* Channel Branding Header */}
            {channelBranding && (
              <div className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white">
                <div 
                  className="h-32 w-full bg-cover bg-center bg-slate-200" 
                  style={{ backgroundImage: `url(${channelBranding.bannerUrl})` }} 
                />
                <div className="p-4 flex items-center gap-4 relative">
                  <div className="w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-slate-100 -mt-12 shadow-md shrink-0">
                    <img src={channelBranding.profileUrl} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{channelBranding.title}</h2>
                    <p className="text-xs text-slate-500 font-medium">Connected YouTube Channel</p>
                  </div>
                </div>
              </div>
            )}

            {/* Video Upload Zone */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleVideoUpload(file); }}
              className={`rounded-2xl border-2 border-dashed transition-all ${
                uploadedVideo 
                  ? 'border-emerald-300 bg-emerald-50/50' 
                  : isDragging 
                    ? 'border-fuchsia-400 bg-fuchsia-50/50 scale-[1.01]' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
              } p-4`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleVideoUpload(file); }}
              />
              {uploadProgress !== null ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-fuchsia-500" />
                  <div className="flex-1">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-fuchsia-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Uploading... {uploadProgress}%</p>
                  </div>
                </div>
              ) : uploadedVideo ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{uploadedVideo.name}</p>
                      <p className="text-xs text-emerald-600 font-medium">Ready for YouTube upload</p>
                    </div>
                  </div>
                  <button onClick={handleRemoveVideo} className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex flex-col items-center gap-2 py-3 cursor-pointer">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700">Upload a video file</p>
                    <p className="text-xs text-slate-400 mt-0.5">Drag & drop or click · MP4, WebM, MOV · Max 5GB</p>
                  </div>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-indigo-500" />
                AI Video Concept Board
              </h3>
              <button onClick={handleTestYouTube} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-medium transition-colors">
                Test YouTube Connection
              </button>
            </div>
            {ytTestResult && (
              <div className={`text-xs p-3 rounded-lg whitespace-pre-wrap ${
                ytTestResult.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' :
                ytTestResult.startsWith('❌') ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {ytTestResult}
              </div>
            )}
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100 min-h-[200px]">
              {isFetchingDrafts ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : drafts.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <PlaySquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p>No video drafts available.</p>
                  <p className="text-xs mt-1">Use your Creative Director chat to brainstorm a concept!</p>
                </div>
              ) : drafts.map((draft) => {
                const isExpanded = expandedDraftId === draft.id;
                const isEditing = editingDraftId === draft.id;
                return (
                <div key={draft.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between w-full">
                        <p className="text-sm font-bold text-slate-800 leading-snug flex items-center gap-2">
                          <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                          {draft.title}
                        </p>
                        <button 
                          onClick={() => {
                            if (isEditing) {
                              setEditingDraftId(null);
                            } else {
                              setExpandedDraftId(isExpanded ? null : draft.id);
                            }
                          }} 
                          className="p-1 hover:bg-slate-200 rounded-md text-slate-500 transition-colors"
                        >
                          {isExpanded && !isEditing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                         <span className={`flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-md text-xs border ${
                           draft.status === "Uploaded to YouTube" 
                             ? "bg-green-50 text-green-700 border-green-200" 
                             : "bg-amber-50 text-amber-700 border-amber-100"
                         }`}>
                           <Play className="w-3 h-3 fill-current" /> {draft.status || "Awaiting Production"}
                         </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                          {isEditing ? (
                            <>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Description</p>
                                <textarea
                                  value={editForm.description}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  className="w-full min-h-[120px] text-xs text-slate-800 leading-relaxed bg-white p-3 rounded-xl border border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 outline-none resize-y"
                                  placeholder="Write your description here..."
                                />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Tags (comma separated)</p>
                                <input
                                  type="text"
                                  value={editForm.tags}
                                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                                  className="w-full text-xs text-slate-800 bg-white p-3 rounded-xl border border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 outline-none"
                                  placeholder="e.g. business, startup, entrepreneur"
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Description</p>
                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-xl border border-slate-100">
                                  {draft.description}
                                </p>
                              </div>
                              
                              {draft.tags && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-1">Tags</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(typeof draft.tags === "string" ? draft.tags.split(",") : draft.tags).map((tag: string, i: number) => (
                                      <span key={i} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                        #{tag.trim()}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          
                          {draft.videoUrl && !isEditing && (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1">Uploaded Video Preview</p>
                              <video 
                                src={draft.videoUrl} 
                                controls 
                                className="w-full max-h-48 bg-black rounded-xl object-contain mt-2"
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-3 mt-4 pt-2">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => handleSaveDraft(draft)}
                                  disabled={isSavingDraft === draft.id}
                                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-semibold hover:bg-emerald-100 transition-colors border border-emerald-100 flex items-center gap-1.5"
                                >
                                  {isSavingDraft === draft.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                  Save to YouTube
                                </button>
                                <button 
                                  onClick={() => setEditingDraftId(null)}
                                  disabled={isSavingDraft === draft.id}
                                  className="px-3 py-1.5 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => {
                                    setEditForm({ description: draft.description || '', tags: typeof draft.tags === 'string' ? draft.tags : (draft.tags || []).join(', ') });
                                    setEditingDraftId(draft.id);
                                  }}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200 transition-colors border border-slate-200 flex items-center gap-1.5"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  Edit Metadata
                                </button>
                                <button 
                                  onClick={() => {
                                    const tags = typeof draft.tags === "string" ? draft.tags.split(",") : (draft.tags || []);
                                    const hashtags = tags.map((t: string) => `#${t.trim().replace(/\s+/g, '')}`).join(' ');
                                    const text = `${draft.title}\n\n${draft.description}\n\n${hashtags}`;
                                    navigator.clipboard.writeText(text);
                                    alert("Copied to clipboard! Ready to paste into YouTube.");
                                  }}
                                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-semibold hover:bg-indigo-100 transition-colors border border-indigo-100"
                                >
                                  Copy Details
                                </button>
                                <button 
                                  onClick={() => handleDeleteDraft(draft.id, draft.youtubeId, draft.youtubeType)}
                                  disabled={isDeletingDraft === draft.id}
                                  className="px-3 py-1.5 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-100 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5"
                                >
                                  {isDeletingDraft === draft.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  Delete Concept
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {!isExpanded && (
                        <div className="mt-3 flex gap-3 items-start">
                          {draft.videoUrl && (
                            <div className="w-24 h-16 bg-black rounded-md overflow-hidden shrink-0 relative flex items-center justify-center group border border-slate-200 shadow-sm">
                               <video src={draft.videoUrl} className="w-full h-full object-cover opacity-80" />
                               <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                 <Play className="w-4 h-4 text-white drop-shadow-md" />
                               </div>
                            </div>
                          )}
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {draft.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>

          {/* Right Area - Strategy & Chat Widget permanently visible */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Moved Strategy Control to Right Row */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button 
                onClick={() => setIsStrategyExpanded(!isStrategyExpanded)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-fuchsia-500" />
                  <span className="text-sm font-semibold text-slate-700">Audience Strategy</span>
                </div>
                {isStrategyExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>
              
              {isStrategyExpanded && (
                <div className="p-4 relative bg-white border-t border-slate-100">
                  <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-fuchsia-50 rounded-full blur-3xl pointer-events-none" />
                  
                  <form onSubmit={handleUpdateStrategy} className="space-y-4 relative z-10">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Target Demographic</label>
                      <input 
                         type="text"
                         value={strategy.targetDemographic}
                         onChange={(e) => setStrategy({...strategy, targetDemographic: e.target.value})}
                         className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tone</label>
                        <input 
                           type="text"
                           value={strategy.tone}
                           onChange={(e) => setStrategy({...strategy, tone: e.target.value})}
                           className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Purpose</label>
                        <input 
                           type="text"
                           value={strategy.purpose}
                           onChange={(e) => setStrategy({...strategy, purpose: e.target.value})}
                           className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Permanent Description Text</label>
                      <textarea 
                         value={strategy.permanentDescription}
                         onChange={(e) => setStrategy({...strategy, permanentDescription: e.target.value})}
                         className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none resize-none h-14 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Social Links</label>
                        <textarea 
                           value={strategy.socialLinks}
                           onChange={(e) => setStrategy({...strategy, socialLinks: e.target.value})}
                           className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none resize-none h-10 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Contact Email</label>
                        <input 
                           type="email"
                           value={strategy.contactEmail}
                           onChange={(e) => setStrategy({...strategy, contactEmail: e.target.value})}
                           className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none text-xs"
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-xl transition-colors shadow-md text-xs flex items-center justify-center gap-2">
                      <Save className="w-3.5 h-3.5" /> Save Strategy
                    </button>
                  </form>
                </div>
              )}
           </div>

             {/* In-flow Chat Interface Window */}
             <div className="w-full h-[500px] bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative z-20">
               <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                     <Bot className="w-4 h-4 text-fuchsia-300" />
                   </div>
                   <div>
                     <p className="text-sm font-semibold">Creative Director</p>
                     <p className="text-[10px] text-slate-400 flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Analyzing Trends
                     </p>
                   </div>
                 </div>
               </div>
                 
                 {/* Chat History Area */}
                 <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-4">
                    <div className="flex gap-3">
                       <div className="w-8 h-8 rounded-full bg-fuchsia-100 flex items-center justify-center shrink-0">
                         <Sparkles className="w-4 h-4 text-fuchsia-600" />
                       </div>
                       <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-[85%]">
                          <p className="text-sm text-slate-700 leading-relaxed">
                            Hey there! I'm your Jarvis YouTube Director. Do you want to brainstorm some viral video concepts based on your current demographic strategy?
                          </p>
                       </div>
                    </div>

                    {messages.map(msg => (
                      <div key={msg.id} className={`flex gap-3 ${msg.isSelf ? 'flex-row-reverse' : ''}`}>
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.isSelf ? 'bg-slate-200 text-slate-600' : 'bg-fuchsia-100 text-fuchsia-600'}`}>
                           {msg.isSelf ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                         </div>
                         <div className={`border rounded-2xl p-3 shadow-sm max-w-[85%] ${msg.isSelf ? 'bg-slate-100 border-slate-200 rounded-tr-sm' : 'bg-white border-slate-200 rounded-tl-sm'}`}>
                            <div className={`text-sm text-slate-700 leading-relaxed`}>
                              {msg.isSelf ? msg.text : (
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a: ({node, ...props}) => <a {...props} className="text-blue-600 hover:text-blue-800 hover:underline font-medium break-all" target="_blank" rel="noopener noreferrer" />,
                                    p: ({node, ...props}) => <p {...props} className="mb-2 last:mb-0" />
                                  }}
                                >
                                  {msg.text}
                                </ReactMarkdown>
                              )}
                            </div>
                         </div>
                      </div>
                    ))}
                    
                    {isTyping && (
                      <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-full bg-fuchsia-100 flex items-center justify-center shrink-0">
                           <Sparkles className="w-4 h-4 text-fuchsia-600" />
                         </div>
                         <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 shadow-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            <span className="text-sm text-slate-500">Brainstorming...</span>
                         </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                 </div>

                 {/* Input Area */}
                 <div className="p-3 border-t border-slate-100 bg-white">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Ask the Director..."
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-100 border-transparent focus:bg-white border focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 rounded-xl text-sm transition-all outline-none text-slate-700"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && chatMessage.trim()) {
                            handleSendMessage();
                          }
                        }}
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={!chatMessage.trim() || isTyping}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-fuchsia-600 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                 </div>
                </div>
           </div>
        </div>
      </div>

    </div>
  );
}
