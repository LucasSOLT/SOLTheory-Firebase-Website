"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useFirestore } from "@/firebase";
import { getAuth } from "firebase/auth";
import { logActivity } from '@/lib/activity-logger';
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AISurveyCreator from "@/components/portal/surveys/AISurveyCreator";
import {
  ClipboardList,
  Star,
  Clock,
  Globe,
  Lock,
  Copy,
  Inbox,
  Plus,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Users,
  BarChart3,
  UserCircle,
  MessageSquare,
  Trash2,
} from "lucide-react";

interface CustomSurvey {
  id: string;
  title: string;
  description: string;
  questions: any[];
  userId: string;
  creatorEmail: string;
  authorName: string;
  visibility: "organization" | "specific";
  domain: string;
  invitedEmails: string[];
  createdAt: any;
}

interface SurveyResponse {
  id: string;
  surveyId: string;
  surveyTitle: string;
  participantName: string;
  participantOrg: string;
  answers: Record<string, any>;
  submittedAt: any;
}

export default function SolTheorySurveysPage() {
  const firestore = useFirestore();
  const auth = getAuth();

  const [customSurveys, setCustomSurveys] = useState<CustomSurvey[]>([]);
  const [invitedSurveys, setInvitedSurveys] = useState<CustomSurvey[]>([]);
  const [allResponses, setAllResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"manager" | "custom">("custom");
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [expandedSurveyId, setExpandedSurveyId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!firestore || !auth.currentUser) return;
    setLoading(true);
    try {
      const userEmail = auth.currentUser.email || "";
      const userDomain = userEmail.split("@")[1] || "";

      // 1) Fetch surveys the user created
      const customSnap = await getDocs(
        query(
          collection(firestore, "custom_surveys"),
          where("userId", "==", auth.currentUser.uid)
        )
      );
      const customItems: CustomSurvey[] = [];
      customSnap.forEach((doc) => {
        customItems.push({ id: doc.id, ...doc.data() } as CustomSurvey);
      });
      // Sort newest-first client-side
      customItems.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });
      setCustomSurveys(customItems);

      // 2) Fetch ALL responses for surveys the user created
      const surveyIds = customItems.map(s => s.id);
      const responses: SurveyResponse[] = [];
      // Firestore "in" query limited to 30 at a time
      for (let i = 0; i < surveyIds.length; i += 30) {
        const batch = surveyIds.slice(i, i + 30);
        if (batch.length === 0) continue;
        try {
          const respSnap = await getDocs(
            query(
              collection(firestore, "custom_survey_responses"),
              where("surveyId", "in", batch)
            )
          );
          respSnap.forEach((doc) => {
            responses.push({ id: doc.id, ...doc.data() } as SurveyResponse);
          });
        } catch (e) {
          console.error("Response fetch error:", e);
        }
      }
      // Sort responses newest-first client-side
      responses.sort((a, b) => {
        const aTime = a.submittedAt?.toDate?.() || new Date(0);
        const bTime = b.submittedAt?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });
      setAllResponses(responses);

      // 3) Fetch surveys the user has been invited to
      const invited: CustomSurvey[] = [];
      try {
        const orgSnap = await getDocs(
          query(
            collection(firestore, "custom_surveys"),
            where("visibility", "==", "organization"),
            where("domain", "==", userDomain)
          )
        );
        orgSnap.forEach((doc) => {
          const data = doc.data();
          if (data.userId !== auth.currentUser!.uid) {
            invited.push({ id: doc.id, ...data } as CustomSurvey);
          }
        });
      } catch (e) {
        console.error("Org survey fetch error:", e);
      }

      try {
        const specificSnap = await getDocs(
          query(
            collection(firestore, "custom_surveys"),
            where("invitedEmails", "array-contains", userEmail)
          )
        );
        specificSnap.forEach((doc) => {
          const data = doc.data();
          if (data.userId !== auth.currentUser!.uid && !invited.find(s => s.id === doc.id)) {
            invited.push({ id: doc.id, ...data } as CustomSurvey);
          }
        });
      } catch (e) {
        console.error("Specific survey fetch error:", e);
      }

      setInvitedSurveys(invited);
    } catch (err) {
      console.error("Failed to fetch surveys:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [firestore, auth.currentUser]);

  // Group responses by surveyId
  const responsesBySurvey = useMemo(() => {
    const map: Record<string, SurveyResponse[]> = {};
    allResponses.forEach(r => {
      if (!map[r.surveyId]) map[r.surveyId] = [];
      map[r.surveyId].push(r);
    });
    return map;
  }, [allResponses]);

  function formatDate(ts: any) {
    if (!ts) return "";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  function formatDateTime(ts: any) {
    if (!ts) return "";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  // Build analytics for a given survey
  function buildAnalytics(survey: CustomSurvey, responses: SurveyResponse[]) {
    if (!survey.questions || responses.length === 0) return null;

    const analytics: { questionId: string; prompt: string; type: string; avg?: number; distribution?: Record<string, number>; textAnswers?: string[] }[] = [];

    survey.questions.forEach((q: any) => {
      const qId = q.id;
      const vals = responses.map(r => r.answers?.[qId]).filter(v => v !== undefined && v !== null && v !== "");

      if (q.type === "rating") {
        const nums = vals.filter(v => typeof v === "number") as number[];
        const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        analytics.push({ questionId: qId, prompt: q.prompt, type: "rating", avg: +avg.toFixed(1) });
      } else if (q.type === "choice") {
        const dist: Record<string, number> = {};
        vals.forEach(v => {
          const s = String(v);
          dist[s] = (dist[s] || 0) + 1;
        });
        analytics.push({ questionId: qId, prompt: q.prompt, type: "choice", distribution: dist });
      } else {
        analytics.push({ questionId: qId, prompt: q.prompt, type: "text", textAnswers: vals.map(String).slice(0, 10) });
      }
    });

    return analytics;
  }

  // ---- LOADING ----
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Loading surveys...</p>
        </div>
      </div>
    );
  }

  // ---- Expanded survey detail view ----
  const renderExpandedSurvey = (survey: CustomSurvey) => {
    const responses = responsesBySurvey[survey.id] || [];
    const analytics = buildAnalytics(survey, responses);

    return (
      <div className="mt-4 space-y-6 animate-in slide-in-from-top-2 fade-in duration-200">
        {/* Survey Questions Preview */}
        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
          <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Survey Questions</h4>
          <div className="space-y-3">
            {survey.questions?.map((q: any, i: number) => (
              <div key={q.id || i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 font-black text-xs shrink-0 mt-0.5">{i + 1}</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{q.prompt}</p>
                  <span className="text-xs font-medium text-slate-400 capitalize">{q.type}{q.type === "choice" && q.options ? ` â€” ${q.options.length} options` : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Responses & Analytics */}
        {responses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Inbox className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">No responses yet</p>
            <p className="text-xs font-medium text-slate-300 mt-1">Share the survey link to start collecting responses.</p>
          </div>
        ) : (
          <>
            {/* Analytics Section */}
            {analytics && analytics.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 className="w-4 h-4 text-slate-900" />
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">
                    Analytics â€” {responses.length} Response{responses.length !== 1 ? "s" : ""}
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics.map(a => (
                    <div key={a.questionId} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-600 mb-3 line-clamp-2">{a.prompt}</p>

                      {a.type === "rating" && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-4 h-4 ${s <= Math.round(a.avg || 0) ? "fill-slate-900 text-slate-900" : "fill-transparent text-slate-300"}`} />
                            ))}
                          </div>
                          <span className="text-lg font-black text-slate-900">{a.avg}</span>
                          <span className="text-xs font-medium text-slate-400">/ 5 avg</span>
                        </div>
                      )}

                      {a.type === "choice" && a.distribution && (
                        <div className="space-y-2">
                          {Object.entries(a.distribution).sort((a, b) => b[1] - a[1]).map(([opt, count]) => {
                            const pct = Math.round((count / responses.length) * 100);
                            return (
                              <div key={opt}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="font-medium text-slate-600 truncate max-w-[70%]">{opt}</span>
                                  <span className="font-black text-slate-800">{pct}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-slate-900 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {a.type === "text" && a.textAnswers && (
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {a.textAnswers.map((txt, i) => (
                            <p key={i} className="text-xs font-medium text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-200 line-clamp-2">{txt}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Responses */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-4 h-4 text-slate-900" />
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Individual Responses</h4>
              </div>
              <div className="space-y-3">
                {responses.map(resp => (
                  <details key={resp.id} className="group bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-black text-xs shrink-0">
                          {(resp.participantName || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{resp.participantName || "Anonymous"}</p>
                          <p className="text-xs text-slate-400 font-medium">{resp.participantOrg || "â€”"} Â· {formatDateTime(resp.submittedAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!firestore) return;
                            if (!confirm(`Delete response from ${resp.participantName || 'Anonymous'}?`)) return;
                            try {
                              await deleteDoc(doc(firestore, "custom_survey_responses", resp.id));
                              logActivity(firestore, 'item_deleted', { email: auth.currentUser?.email || '', displayName: auth.currentUser?.displayName }, `Deleted survey response from ${resp.participantName || 'Anonymous'} on survey: ${resp.surveyTitle || survey.title}`);
                              setAllResponses(prev => prev.filter(r => r.id !== resp.id));
                            } catch (err) {
                              console.error("Failed to delete response:", err);
                            }
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete response"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
                      </div>
                    </summary>
                    <div className="px-5 pb-4 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {survey.questions?.map((q: any) => {
                          const val = resp.answers?.[q.id];
                          return (
                            <div key={q.id} className="bg-white rounded-lg p-3 border border-slate-200">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{q.prompt}</p>
                              {typeof val === "number" ? (
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <Star key={s} className={`w-3.5 h-3.5 ${s <= val ? "fill-slate-900 text-slate-900" : "fill-transparent text-slate-300"}`} />
                                  ))}
                                  <span className="text-xs font-bold text-slate-500 ml-1">{val}</span>
                                </div>
                              ) : (
                                <p className="text-sm font-medium text-slate-700">{val || "â€”"}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderEmptyState = (tab: "manager" | "custom") => {
    if (tab === "manager") {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-white rounded-xl border border-slate-200 py-20 mt-6">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
            <Inbox className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">No Surveys Available</h2>
          <p className="text-slate-500 mt-3 max-w-sm font-medium">
            When someone in your organization or someone who invites you creates a survey, it will appear here for you to take.
          </p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-white rounded-xl border border-slate-200 py-20 mt-6">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
          <Star className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">No Created Surveys</h2>
        <p className="text-slate-500 mt-3 max-w-sm font-medium mb-6">
          Create your first AI-powered survey to start collecting feedback.
        </p>
        <Button onClick={() => setIsCreatorOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-12 px-8">
          Create AI Survey
        </Button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto pb-10 pr-4">
      {isCreatorOpen && (
        <AISurveyCreator
          onClose={() => setIsCreatorOpen(false)}
          onSurveyCreated={() => {
            fetchData();
          }}
        />
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between pt-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-2xl">
              <ClipboardList className="w-6 h-6 text-slate-700" />
            </div>
            Surveys
          </h1>
          <p className="text-slate-500 font-medium ml-[52px]">
            Manage and take surveys across your organization.
          </p>
        </div>
        {activeTab === "custom" && (
          <Button onClick={() => setIsCreatorOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-11 px-6 gap-2">
            <Plus className="w-4 h-4" /> New Survey
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center bg-slate-100 rounded-lg p-1 gap-1">
        <button
          onClick={() => setActiveTab("manager")}
          className={`px-5 py-2 text-sm font-bold rounded-md transition-colors cursor-pointer ${activeTab === "manager" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
        >
          Survey Manager ({invitedSurveys.length})
        </button>
        <button
          onClick={() => setActiveTab("custom")}
          className={`px-5 py-2 text-sm font-bold rounded-md transition-colors cursor-pointer ${activeTab === "custom" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
        >
          My Created Surveys ({customSurveys.length})
        </button>
      </div>

      {/* Survey Manager Tab */}
      {activeTab === "manager" && (
        <>
          {invitedSurveys.length === 0 ? (
            renderEmptyState("manager")
          ) : (
            <div className="grid grid-cols-1 gap-4 mt-2">
              {invitedSurveys.map(survey => {
                const dateStr = formatDate(survey.createdAt);
                return (
                  <Card key={survey.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black text-slate-900 mb-1 truncate">{survey.title}</h3>
                        <p className="text-sm font-medium text-slate-500 line-clamp-2 mb-4">{survey.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-400">
                          <span className="flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />{survey.questions?.length || 0} Questions</span>
                          {dateStr && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{dateStr}</span>}
                          {survey.authorName && <span className="flex items-center gap-1"><UserCircle className="w-3.5 h-3.5" />by {survey.authorName}</span>}
                        </div>
                      </div>
                      <a href={`/survey/${survey.id}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg gap-1.5 h-9">
                          Take Survey <ArrowUpRight className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* My Created Surveys Tab */}
      {activeTab === "custom" && (
        <>
          {customSurveys.length === 0 ? (
            renderEmptyState("custom")
          ) : (
            <div className="space-y-4 mt-2">
              {customSurveys.map(survey => {
                const dateStr = formatDate(survey.createdAt);
                const isExpanded = expandedSurveyId === survey.id;
                const responseCount = (responsesBySurvey[survey.id] || []).length;

                return (
                  <Card key={survey.id} className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                    <div
                      onClick={() => setExpandedSurveyId(isExpanded ? null : survey.id)}
                      role="button"
                      tabIndex={0}
                      className="w-full text-left p-6 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-black text-slate-900 mb-1 truncate">{survey.title}</h3>
                          <p className="text-sm font-medium text-slate-500 line-clamp-2 mb-4">{survey.description}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-400">
                            <span className="flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />{survey.questions?.length || 0} Questions</span>
                            {dateStr && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{dateStr}</span>}
                            <span className="flex items-center gap-1">
                              {survey.visibility === "organization" ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              {survey.visibility === "organization" ? "Organization" : "Invite Only"}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5" />
                              {responseCount} Response{responseCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(`${window.location.origin}/survey/${survey.id}`);
                            }}
                            className="font-bold text-white bg-slate-800 hover:bg-slate-700 border-slate-800 rounded-lg gap-1.5 h-9"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy Link
                          </Button>
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-6 border-t border-slate-200">
                        {renderExpandedSurvey(survey)}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
