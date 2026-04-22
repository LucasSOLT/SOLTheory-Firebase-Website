"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ClipboardList,
  Star,
  ChevronDown,
  ChevronRight,
  Mail,
  Clock,
  BarChart3,
  Users,
  TrendingUp,
  FileText,
} from "lucide-react";

interface SurveySubmission {
  id: string;
  surveyType: string;
  userId: string;
  userEmail: string;
  userName: string;
  answers: Record<string, string | number>;
  submittedAt: any;
  dashboard: string;
}

// Question id -> friendly label
const QUESTION_LABELS: Record<string, string> = {
  overall_satisfaction: "Overall Satisfaction",
  visual_design: "Visual Design Rating",
  ease_of_learning: "Ease of Learning",
  navigation_clarity: "Navigation Clarity",
  most_valuable_feature: "Most Valuable Feature",
  missing_feature: "Missing Feature Request",
  ai_agent_usefulness: "AI Agent Usefulness",
  mobile_experience: "Mobile Experience",
  loading_speed: "Loading Speed & Performance",
  communication_tools: "Communication Tools",
  recommend_likelihood: "Recommend Likelihood (NPS)",
  additional_feedback: "Additional Feedback",
};

const RATING_QUESTIONS = [
  "overall_satisfaction",
  "visual_design",
  "ease_of_learning",
  "ai_agent_usefulness",
  "loading_speed",
  "recommend_likelihood",
];

export default function SolTheorySurveysPage() {
  const firestore = useFirestore();
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore) return;
    const fetchSubmissions = async () => {
      try {
        const snap = await getDocs(
          query(collection(firestore, "survey_submissions"), orderBy("submittedAt", "desc"))
        );
        const items: SurveySubmission[] = [];
        snap.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as SurveySubmission);
        });
        setSubmissions(items);
      } catch (err) {
        console.error("Failed to fetch survey submissions:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [firestore]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (submissions.length === 0) return null;

    // Average ratings per question
    const ratingTotals: Record<string, { sum: number; count: number }> = {};
    RATING_QUESTIONS.forEach((q) => {
      ratingTotals[q] = { sum: 0, count: 0 };
    });

    // Feature votes
    const featureVotes: Record<string, number> = {};

    submissions.forEach((sub) => {
      RATING_QUESTIONS.forEach((q) => {
        const val = sub.answers[q];
        if (typeof val === "number" && val > 0) {
          ratingTotals[q].sum += val;
          ratingTotals[q].count += 1;
        }
      });

      const feat = sub.answers.most_valuable_feature;
      if (typeof feat === "string" && feat) {
        featureVotes[feat] = (featureVotes[feat] || 0) + 1;
      }
    });

    const ratingAverages: Record<string, number> = {};
    Object.entries(ratingTotals).forEach(([k, v]) => {
      ratingAverages[k] = v.count > 0 ? +(v.sum / v.count).toFixed(1) : 0;
    });

    const topFeature =
      Object.entries(featureVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    const overallAvg =
      Object.values(ratingAverages).reduce((s, v) => s + v, 0) /
      Object.values(ratingAverages).filter((v) => v > 0).length;

    return {
      total: submissions.length,
      ratingAverages,
      topFeature,
      overallAvg: isNaN(overallAvg) ? 0 : +overallAvg.toFixed(1),
    };
  }, [submissions]);

  function formatDate(ts: any) {
    if (!ts) return "—";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }

  function renderStars(val: number) {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-4 h-4 ${
              s <= val
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-slate-200"
            }`}
          />
        ))}
        <span className="text-xs font-bold text-slate-500 ml-1.5 tabular-nums">
          {val}
        </span>
      </div>
    );
  }

  // ---- LOADING ----
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-400">
            Loading survey submissions...
          </p>
        </div>
      </div>
    );
  }

  // ---- EMPTY STATE ----
  if (submissions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-[2rem] shadow-sm flex items-center justify-center text-slate-300 mb-6 rotate-12 transition-transform hover:rotate-0 duration-300">
          <ClipboardList className="w-10 h-10 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-800">
          No Survey Submissions Yet
        </h2>
        <p className="text-slate-500 mt-2 max-w-sm font-medium">
          When NXT Chapter users complete the Client Use Case Survey, their
          responses will appear here for review.
        </p>
      </div>
    );
  }

  // ---- MAIN VIEW ----
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 h-full overflow-y-auto pb-10">
      {/* Page Header */}
      <div className="space-y-1 pt-6">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-2xl">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
          </div>
          Survey Results
        </h1>
        <p className="text-slate-500 font-medium ml-[52px]">
          NXT Chapter Client Use Case Survey — all submissions from
          dashboard users.
        </p>
      </div>

      {/* Aggregate Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100 rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl">
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Total Responses
                  </p>
                  <p className="text-2xl font-black text-slate-900">
                    {stats.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100 rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <Star className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Overall Avg
                  </p>
                  <p className="text-2xl font-black text-slate-900">
                    {stats.overallAvg}
                    <span className="text-sm text-slate-400 font-semibold">
                      {" "}
                      / 5
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100 rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    NPS Score
                  </p>
                  <p className="text-2xl font-black text-slate-900">
                    {stats.ratingAverages.recommend_likelihood || "—"}
                    <span className="text-sm text-slate-400 font-semibold">
                      {" "}
                      / 5
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100 rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-50 rounded-xl">
                  <BarChart3 className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Top Feature
                  </p>
                  <p className="text-sm font-black text-slate-900 leading-tight mt-0.5">
                    {stats.topFeature}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rating Breakdown */}
      {stats && (
        <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-extrabold text-slate-800">
              Average Ratings by Category
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 font-medium">
              Across all {stats.total} submission{stats.total !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {RATING_QUESTIONS.map((q) => {
                const avg = stats.ratingAverages[q] || 0;
                const pct = (avg / 5) * 100;
                return (
                  <div key={q} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">
                        {QUESTION_LABELS[q] || q}
                      </span>
                      <span className="text-xs font-black text-slate-800 tabular-nums">
                        {avg} / 5
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          avg >= 4
                            ? "bg-emerald-500"
                            : avg >= 3
                            ? "bg-amber-400"
                            : "bg-red-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Submissions */}
      <div className="space-y-3">
        <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-500" />
          Individual Submissions
        </h2>

        {submissions.map((sub) => {
          const isExpanded = expandedId === sub.id;
          return (
            <Card
              key={sub.id}
              className="bg-white border-0 shadow-sm ring-1 ring-slate-100 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : sub.id)
                }
                className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm shrink-0">
                    {(sub.userName || sub.userEmail || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {sub.userName || "Anonymous User"}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {sub.userEmail || "—"}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(sub.submittedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {typeof sub.answers.overall_satisfaction === "number" && (
                    <div className="hidden sm:flex">
                      {renderStars(sub.answers.overall_satisfaction as number)}
                    </div>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 px-6 py-5 bg-slate-50/50 animate-in slide-in-from-top-1 fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(sub.answers).map(([key, val]) => (
                      <div
                        key={key}
                        className="bg-white rounded-xl p-4 border border-slate-100"
                      >
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                          {QUESTION_LABELS[key] || key}
                        </p>
                        {typeof val === "number" ? (
                          renderStars(val)
                        ) : (
                          <p className="text-sm font-medium text-slate-800 leading-relaxed">
                            {val || "—"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
