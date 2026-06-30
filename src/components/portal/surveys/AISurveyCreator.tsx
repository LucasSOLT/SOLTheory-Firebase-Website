"use client";

import React, { useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { Bot, Check, Trash2, RefreshCw, Send, Copy, X, Plus, Globe, Lock, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';

interface AISurveyCreatorProps {
  onClose: () => void;
  onSurveyCreated: () => void;
}

export default function AISurveyCreator({ onClose, onSurveyCreated }: AISurveyCreatorProps) {
  const firestore = useFirestore();
  const auth = getAuth();
  const { knowledgeBaseText, pactText } = useKnowledgeBase('soltheory');
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSurvey, setGeneratedSurvey] = useState<any>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  // Author & visibility
  const [authorName, setAuthorName] = useState("");
  const [visibility, setVisibility] = useState<"organization" | "specific">("organization");
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");

  // Step: 0 = describe, 1 = preview + settings, 2 = saved
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsLoading(true);
    setGeneratedSurvey(null);
    try {
      const res = await fetch("/api/generate-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, knowledgeBaseText, pactText })
      });
      const data = await res.json();
      if (data.survey) {
        setGeneratedSurvey(data.survey);
        setStep(1);
      } else {
        alert("Failed to generate survey. Please try again.");
      }
    } catch (e) {
      console.error(e);
      alert("Error generating survey.");
    }
    setIsLoading(false);
  };

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (invitedEmails.includes(email)) return;
    setInvitedEmails(prev => [...prev, email]);
    setEmailInput("");
  };

  const handleRemoveEmail = (email: string) => {
    setInvitedEmails(prev => prev.filter(e => e !== email));
  };

  const handleSave = async () => {
    if (!firestore || !auth.currentUser || !generatedSurvey) return;
    setIsLoading(true);
    try {
      const userEmail = auth.currentUser.email || "";
      const userDomain = userEmail.split("@")[1] || "";

      const docRef = await addDoc(collection(firestore, "custom_surveys"), {
        ...generatedSurvey,
        userId: auth.currentUser.uid,
        creatorEmail: userEmail,
        authorName: authorName.trim() || "", // Empty = anonymous
        visibility,
        domain: userDomain,
        invitedEmails: visibility === "specific" ? invitedEmails : [],
        createdAt: serverTimestamp()
      });
      const url = `${window.location.origin}/survey/${docRef.id}`;
      setSavedUrl(url);
      setStep(2);
      onSurveyCreated();
    } catch (e) {
      console.error(e);
      alert("Failed to save survey.");
    }
    setIsLoading(false);
  };

  const handleCopyUrl = () => {
    if (savedUrl) {
      navigator.clipboard.writeText(savedUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">AI Survey Creator</h2>
              <p className="text-sm font-medium text-slate-500">
                {step === 0 && "Describe what you want to learn."}
                {step === 1 && "Review, configure, and publish."}
                {step === 2 && "Your survey is live."}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-2 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel */}
          <div className="w-full md:w-1/2 p-6 flex flex-col border-r border-slate-100 bg-slate-50 overflow-y-auto">
            {step === 2 && savedUrl ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-slate-700" />
                </div>
                <h3 className="text-2xl font-black text-slate-800">Survey Published</h3>
                <p className="text-slate-500 font-medium">Share this link with anyone to gather responses.</p>
                <div className="flex items-center gap-2 mt-4 bg-slate-50 border border-slate-200 p-2 rounded-xl w-full">
                  <input readOnly value={savedUrl} className="flex-1 text-sm bg-transparent outline-none px-2 font-medium text-slate-600" />
                  <Button onClick={handleCopyUrl} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg gap-2">
                    <Copy className="w-4 h-4" /> Copy
                  </Button>
                </div>
                <Button onClick={onClose} variant="outline" className="mt-8 rounded-full font-bold">Return to Surveys</Button>
              </div>
            ) : step === 0 ? (
              <>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">What do you want to survey people about?</label>
                  <textarea
                    className="w-full h-48 md:h-full resize-none rounded-2xl border border-slate-200 p-4 outline-none focus:ring-2 focus:ring-slate-400/50 bg-white text-sm font-medium text-slate-800"
                    placeholder="E.g. I want to ask my team about how they felt regarding the recent office redesign. Did they like the open spaces? Is it too loud? What snacks do they want in the breakroom? Make it fun and casual..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 shrink-0">
                  <Button
                    onClick={handleGenerate}
                    disabled={isLoading || !description.trim()}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl text-lg gap-2"
                  >
                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Generate Survey
                  </Button>
                </div>
              </>
            ) : (
              /* Step 1: Settings panel */
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-slate-500" /> Author Name
                  </h3>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Leave blank to stay anonymous"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 transition-all font-medium text-sm text-slate-800"
                  />
                  <p className="text-xs text-slate-400 font-medium mt-1.5">Survey takers will see this name. Leave empty to remain anonymous.</p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 mb-3">Who can see this survey?</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setVisibility("organization")}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${visibility === "organization" ? "border-slate-900 bg-slate-50" : "border-slate-100 bg-[#faf8f3] hover:border-slate-200"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Globe className={`w-5 h-5 ${visibility === "organization" ? "text-slate-700" : "text-slate-400"}`} />
                        <div>
                          <p className={`text-sm font-bold ${visibility === "organization" ? "text-slate-700" : "text-slate-700"}`}>Entire Organization</p>
                          <p className="text-xs text-slate-400 font-medium">Everyone with your email domain can access this survey.</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setVisibility("specific")}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${visibility === "specific" ? "border-slate-900 bg-slate-50" : "border-slate-100 bg-[#faf8f3] hover:border-slate-200"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Lock className={`w-5 h-5 ${visibility === "specific" ? "text-slate-700" : "text-slate-400"}`} />
                        <div>
                          <p className={`text-sm font-bold ${visibility === "specific" ? "text-slate-700" : "text-slate-700"}`}>Specific People</p>
                          <p className="text-xs text-slate-400 font-medium">Only invited email addresses can access this survey.</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {visibility === "specific" && (
                  <div className="pt-2">
                    <h3 className="text-sm font-black text-slate-800 mb-3">Invite by Email</h3>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                        placeholder="colleague@company.com"
                        className="flex-1 h-10 px-3 rounded-xl border border-slate-200 outline-none focus:border-slate-400 text-sm font-medium text-slate-800"
                      />
                      <Button onClick={handleAddEmail} size="sm" className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {invitedEmails.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {invitedEmails.map(email => (
                          <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-xs font-bold">
                            {email}
                            <button onClick={() => handleRemoveEmail(email)} className="hover:text-red-500 cursor-pointer"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <Button onClick={() => { setStep(0); setGeneratedSurvey(null); }} variant="outline" className="flex-1 h-11 rounded-xl font-bold gap-2 text-slate-600">
                    <RefreshCw className="w-4 h-4" /> Re-generate
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading} className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2">
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Publish
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Preview */}
          <div className="w-full md:w-1/2 bg-white flex flex-col overflow-hidden relative">
            {isLoading && step === 0 && (
              <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="w-8 h-8 text-slate-500 animate-spin" />
                  <p className="font-bold text-slate-500 animate-pulse">AI is crafting your survey...</p>
                </div>
              </div>
            )}

            {!generatedSurvey && !isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <Bot className="w-16 h-16 text-slate-200 mb-4" />
                <p className="font-bold text-lg text-slate-300">Live Preview will appear here</p>
              </div>
            )}

            {generatedSurvey && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                  <h1 className="text-3xl font-black text-slate-900 mb-2">{generatedSurvey.title}</h1>
                  <p className="text-slate-500 font-medium mb-8 pb-6 border-b border-slate-100">{generatedSurvey.description}</p>

                  <div className="space-y-8">
                    {generatedSurvey.questions?.map((q: any, i: number) => (
                      <div key={q.id || i} className="space-y-3">
                        <label className="block text-sm font-bold text-slate-800">
                          {i + 1}. {q.prompt}
                        </label>
                        {q.type === "text" && (
                          <input disabled placeholder="Text response..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" />
                        )}
                        {q.type === "rating" && (
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(n => (
                              <div key={n} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 font-bold bg-slate-100">{n}</div>
                            ))}
                          </div>
                        )}
                        {q.type === "choice" && q.options && (
                          <div className="space-y-2">
                            {q.options.map((opt: string) => (
                              <div key={opt} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50">
                                <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                                <span className="text-sm font-medium text-slate-600">{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {step === 1 && (
                  <div className="p-6 border-t border-slate-100 bg-white flex gap-4 shrink-0">
                    <Button onClick={() => { setGeneratedSurvey(null); setStep(0); }} variant="outline" className="flex-1 h-12 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 font-bold gap-2">
                      <Trash2 className="w-4 h-4" /> Delete Draft
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
