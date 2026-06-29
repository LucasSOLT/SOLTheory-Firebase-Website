"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import {
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Star,
  ChevronRight,
  ChevronLeft,
  Send,
  Plus,
  Trash2,
  Calendar,
  BarChart3,
  FileText,
  Eye,
  Edit3,
  ChevronDown,
  ChevronUp,
  GripVertical,
  X,
} from "lucide-react";
import { ALL_ORGS } from "@/lib/admin";

// ---- Constants ----
const ADMIN_EMAILS = ["lucas@soltheory.com", "steve@soltheory.com", "gerard@soltheory.com"];
const ORG_ID = "nxtchapter";
const ORG_NAME =
  ALL_ORGS.find((o) => o.id === ORG_ID)?.name || "NXT Chapter";

// ---- Helpers ----
function getWeekBounds(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (dt: Date) => dt.toISOString().split("T")[0];
  const monthDay = (dt: Date) =>
    dt.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const label = `Week of ${monthDay(monday)} – ${monthDay(sunday)}, ${sunday.getFullYear()}`;

  return { weekStart: fmt(monday), weekEnd: fmt(sunday), label };
}

function getWeeksList() {
  const now = new Date();
  const weeks: { weekStart: string; weekEnd: string; label: string }[] = [];

  for (let offset = -8; offset <= 3; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset * 7);
    weeks.push(getWeekBounds(d));
  }

  return weeks.reverse(); // most recent first
}

// ---- Types ----
type QuestionType = "rating" | "multiple_choice" | "text";

interface SurveyQuestion {
  id: string;
  question: string;
  subtitle?: string;
  type: QuestionType;
  options?: string[];
  required?: boolean;
}

interface WeeklySurvey {
  id?: string;
  weekStart: string;
  weekEnd: string;
  orgId: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

interface SurveyResponse {
  id: string;
  surveyId: string;
  weekStart: string;
  orgId: string;
  userId: string;
  userEmail: string;
  userName: string;
  answers: Record<string, string | number>;
  submittedAt: any;
}

// ---- Star Rating Component ----
function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-3 pt-4">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="group transition-transform hover:scale-110 active:scale-95 cursor-pointer"
        >
          <Star
            className={`w-8 h-8 transition-colors duration-150 ${
              star <= (hovered || value)
                ? "fill-slate-900 text-slate-900"
                : "fill-transparent text-slate-300 group-hover:text-slate-400"
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs font-medium text-slate-400 ml-3 tabular-nums">
          {value} / 5
        </span>
      )}
    </div>
  );
}

// ---- Main Component ----
export default function NxtChapterSurveyPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  // Derived
  const isAdmin = ADMIN_EMAILS.includes(user?.email || "");
  const currentWeekBounds = getWeekBounds(new Date());

  // State
  const [surveys, setSurveys] = useState<Map<string, WeeklySurvey>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<
    "library" | "builder" | "analytics" | "survey"
  >(isAdmin ? "library" : "survey");
  const [currentSurvey, setCurrentSurvey] = useState<WeeklySurvey | null>(
    null
  );

  // Builder state
  const [editQuestions, setEditQuestions] = useState<SurveyQuestion[]>([]);
  const [editTitle, setEditTitle] = useState("Weekly Feedback Survey");
  const [editDescription, setEditDescription] = useState(
    `Help us improve the ${ORG_NAME} dashboard experience. Your answers are confidential and reviewed only by the SOL Theory admin team.`
  );
  const [savingSurvey, setSavingSurvey] = useState(false);

  // Survey-taking state
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Analytics state
  const [responses, setResponses] = useState<SurveyResponse[]>([]);

  // ---- Data Loading ----
  useEffect(() => {
    if (!firestore || !user) return;

    const load = async () => {
      setLoading(true);
      try {
        // Fetch all surveys for this org
        const q = query(
          collection(firestore, "weekly_surveys"),
          where("orgId", "==", ORG_ID)
        );
        const snap = await getDocs(q);
        const map = new Map<string, WeeklySurvey>();
        snap.forEach((d) => {
          const data = d.data() as WeeklySurvey;
          data.id = d.id;
          map.set(data.weekStart, data);
        });
        setSurveys(map);

        // Non-admin: check if already submitted for current week
        if (!ADMIN_EMAILS.includes(user.email || "")) {
          const rq = query(
            collection(firestore, "weekly_survey_responses"),
            where("weekStart", "==", currentWeekBounds.weekStart),
            where("orgId", "==", ORG_ID),
            where("userId", "==", user.uid)
          );
          const rSnap = await getDocs(rq);
          if (!rSnap.empty) setAlreadySubmitted(true);

          // Auto-load current week's survey
          const curr = map.get(currentWeekBounds.weekStart);
          if (curr) setCurrentSurvey(curr);
        }
      } catch (err) {
        console.error("Failed to load surveys:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, user]);

  // Sync viewMode when isAdmin changes
  useEffect(() => {
    if (isAdmin && viewMode === "survey") setViewMode("library");
    if (!isAdmin && viewMode !== "survey") setViewMode("survey");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // ---- Admin Handlers ----
  const openBuilder = useCallback(
    (weekStart: string, weekEnd: string, existing?: WeeklySurvey) => {
      setSelectedWeek(weekStart);
      if (existing) {
        setEditTitle(existing.title);
        setEditDescription(existing.description);
        setEditQuestions([...existing.questions]);
      } else {
        setEditTitle("Weekly Feedback Survey");
        setEditDescription(
          `Help us improve the ${ORG_NAME} dashboard experience. Your answers are confidential and reviewed only by the SOL Theory admin team.`
        );
        setEditQuestions([
          {
            id: crypto.randomUUID(),
            question: "",
            type: "rating",
            required: true,
          },
        ]);
      }
      setViewMode("builder");
    },
    []
  );

  const saveSurvey = useCallback(async () => {
    if (!firestore || !user || !selectedWeek) return;
    setSavingSurvey(true);

    const weekData = getWeeksList().find((w) => w.weekStart === selectedWeek);
    const docId = `${ORG_ID}_${selectedWeek}`;

    const surveyDoc: WeeklySurvey = {
      weekStart: selectedWeek,
      weekEnd: weekData?.weekEnd || "",
      orgId: ORG_ID,
      title: editTitle,
      description: editDescription,
      questions: editQuestions.filter((q) => q.question.trim() !== ""),
      createdBy: user.email || "",
      createdAt: surveys.get(selectedWeek)?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(firestore, "weekly_surveys", docId), surveyDoc);
      surveyDoc.id = docId;
      setSurveys((prev) => new Map(prev).set(selectedWeek, surveyDoc));
      setViewMode("library");
    } catch (err) {
      console.error("Failed to save survey:", err);
    } finally {
      setSavingSurvey(false);
    }
  }, [
    firestore,
    user,
    selectedWeek,
    editTitle,
    editDescription,
    editQuestions,
    surveys,
  ]);

  const openAnalytics = useCallback(
    async (weekStart: string) => {
      if (!firestore) return;
      setSelectedWeek(weekStart);
      setCurrentSurvey(surveys.get(weekStart) || null);
      setViewMode("analytics");

      const survey = surveys.get(weekStart);
      if (!survey?.id) return;

      try {
        const rq = query(
          collection(firestore, "weekly_survey_responses"),
          where("surveyId", "==", survey.id)
        );
        const snap = await getDocs(rq);
        const res: SurveyResponse[] = [];
        snap.forEach((d) => res.push({ id: d.id, ...d.data() } as SurveyResponse));
        setResponses(res);
      } catch (err) {
        console.error("Failed to load responses:", err);
      }
    },
    [firestore, surveys]
  );

  const deleteSurvey = useCallback(
    async (weekStart: string) => {
      if (!firestore) return;
      const survey = surveys.get(weekStart);
      if (!survey?.id) return;

      if (!confirm("Delete this survey? This cannot be undone.")) return;

      try {
        await deleteDoc(doc(firestore, "weekly_surveys", survey.id));
        setSurveys((prev) => {
          const next = new Map(prev);
          next.delete(weekStart);
          return next;
        });
        if (viewMode !== "library") setViewMode("library");
      } catch (err) {
        console.error("Failed to delete survey:", err);
      }
    },
    [firestore, surveys, viewMode]
  );

  // ---- Client Handlers ----
  const handleSubmit = useCallback(async () => {
    if (!firestore || !user || !currentSurvey) return;
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, "weekly_survey_responses"), {
        surveyId: currentSurvey.id || "",
        weekStart: currentSurvey.weekStart,
        orgId: ORG_ID,
        userId: user.uid,
        userEmail: user.email || "",
        userName: user.displayName || "",
        answers,
        submittedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Survey submit error:", err);
    } finally {
      setSubmitting(false);
    }
  }, [firestore, user, currentSurvey, answers]);

  // ---- Question Builder Helpers ----
  const addQuestion = () => {
    setEditQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        question: "",
        type: "rating" as QuestionType,
        required: true,
      },
    ]);
  };

  const updateQuestion = (idx: number, patch: Partial<SurveyQuestion>) => {
    setEditQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    );
  };

  const removeQuestion = (idx: number) => {
    setEditQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const addOption = (qIdx: number) => {
    setEditQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: [...(q.options || []), ""] } : q
      )
    );
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setEditQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: (q.options || []).map((o, j) =>
                j === oIdx ? value : o
              ),
            }
          : q
      )
    );
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setEditQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: (q.options || []).filter((_, j) => j !== oIdx) }
          : q
      )
    );
  };

  // ---- Loading State ----
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 animate-in fade-in duration-300">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading surveys…</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // ADMIN: BUILDER VIEW
  // ============================================================
  if (isAdmin && viewMode === "builder") {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div>
            <button
              onClick={() => setViewMode("library")}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors mb-4 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Library
            </button>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              {surveys.has(selectedWeek || "") ? "Edit Survey" : "Create Survey"}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {getWeeksList().find((w) => w.weekStart === selectedWeek)?.label}
            </p>
          </div>

          {/* Title & Description */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Survey Title
              </label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                placeholder="Weekly Feedback Survey"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none transition-all"
                placeholder="Describe the survey purpose…"
              />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Questions</h2>
            {editQuestions.map((q, idx) => (
              <Card
                key={q.id}
                className="bg-white border border-slate-200 shadow-sm rounded-xl"
              >
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <GripVertical className="w-4 h-4 text-slate-300 mt-2.5 shrink-0" />
                    <div className="flex-1 space-y-3">
                      {/* Question text */}
                      <input
                        value={q.question}
                        onChange={(e) =>
                          updateQuestion(idx, { question: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                        placeholder={`Question ${idx + 1}`}
                      />

                      {/* Subtitle */}
                      <input
                        value={q.subtitle || ""}
                        onChange={(e) =>
                          updateQuestion(idx, { subtitle: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-600 focus:outline-none focus:border-slate-400 transition-all"
                        placeholder="Optional subtitle / hint"
                      />

                      {/* Type + Required row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <select
                          value={q.type}
                          onChange={(e) =>
                            updateQuestion(idx, {
                              type: e.target.value as QuestionType,
                              options:
                                e.target.value === "multiple_choice"
                                  ? q.options?.length
                                    ? q.options
                                    : [""]
                                  : undefined,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:border-slate-900 cursor-pointer"
                        >
                          <option value="rating">⭐ Rating (1-5)</option>
                          <option value="multiple_choice">
                            📋 Multiple Choice
                          </option>
                          <option value="text">✏️ Text</option>
                        </select>

                        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.required ?? true}
                            onChange={(e) =>
                              updateQuestion(idx, {
                                required: e.target.checked,
                              })
                            }
                            className="rounded border-slate-300 cursor-pointer"
                          />
                          Required
                        </label>
                      </div>

                      {/* Multiple choice options */}
                      {q.type === "multiple_choice" && (
                        <div className="space-y-2 pl-1">
                          {(q.options || []).map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className="flex items-center gap-2"
                            >
                              <div className="w-3 h-3 rounded-full border-2 border-slate-300 shrink-0" />
                              <input
                                value={opt}
                                onChange={(e) =>
                                  updateOption(idx, oIdx, e.target.value)
                                }
                                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:border-slate-400 transition-all"
                                placeholder={`Option ${oIdx + 1}`}
                              />
                              <button
                                onClick={() => removeOption(idx, oIdx)}
                                className="text-slate-300 hover:text-red-400 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(idx)}
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Add option
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Delete question */}
                    <button
                      onClick={() => removeQuestion(idx)}
                      className="text-slate-300 hover:text-red-500 transition-colors mt-2.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <button
              onClick={addQuestion}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setViewMode("library")}
              className="rounded-lg px-5 border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={saveSurvey}
              disabled={
                savingSurvey ||
                editQuestions.filter((q) => q.question.trim()).length === 0
              }
              className="rounded-lg px-6 bg-slate-900 hover:bg-slate-800 text-white font-medium disabled:opacity-40 cursor-pointer"
            >
              {savingSurvey ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Save & Publish
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // ADMIN: ANALYTICS VIEW
  // ============================================================
  if (isAdmin && viewMode === "analytics" && currentSurvey) {
    const surveyQuestions = currentSurvey.questions || [];

    return (
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div>
            <button
              onClick={() => setViewMode("library")}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors mb-4 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Library
            </button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                  {currentSurvey.title}
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  {getWeeksList().find(
                    (w) => w.weekStart === currentSurvey.weekStart
                  )?.label || currentSurvey.weekStart}{" "}
                  · {surveyQuestions.length} questions ·{" "}
                  {responses.length} responses
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const week = getWeeksList().find(
                      (w) => w.weekStart === currentSurvey.weekStart
                    );
                    openBuilder(
                      currentSurvey.weekStart,
                      week?.weekEnd || "",
                      currentSurvey
                    );
                  }}
                  className="rounded-lg border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteSurvey(currentSurvey.weekStart)}
                  className="rounded-lg border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Response summary */}
          {responses.length === 0 ? (
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
              <CardContent className="py-12 text-center">
                <BarChart3 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  No responses yet. Results will appear here once users submit
                  their surveys.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {surveyQuestions.map((q, qIdx) => {
                const qAnswers = responses
                  .map((r) => r.answers[q.id])
                  .filter((a) => a !== undefined && a !== "" && a !== 0);

                return (
                  <Card
                    key={q.id}
                    className="bg-white border border-slate-200 shadow-sm rounded-xl"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs shrink-0">
                          {qIdx + 1}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium text-slate-900 leading-snug">
                            {q.question}
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-400 mt-0.5">
                            {qAnswers.length} of {responses.length} answered
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-1 pb-5 pl-14">
                      {/* Rating: avg + distribution */}
                      {q.type === "rating" && (() => {
                        const nums = qAnswers.map(Number);
                        const avg =
                          nums.length > 0
                            ? nums.reduce((a, b) => a + b, 0) / nums.length
                            : 0;
                        const dist = [0, 0, 0, 0, 0];
                        nums.forEach((n) => {
                          if (n >= 1 && n <= 5) dist[n - 1]++;
                        });
                        const maxCount = Math.max(...dist, 1);
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Star className="w-5 h-5 fill-slate-900 text-slate-900" />
                              <span className="text-lg font-semibold text-slate-900 tabular-nums">
                                {avg.toFixed(1)}
                              </span>
                              <span className="text-xs text-slate-400">
                                / 5 average
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {[5, 4, 3, 2, 1].map((star) => (
                                <div
                                  key={star}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <span className="w-3 text-slate-400 text-right tabular-nums">
                                    {star}
                                  </span>
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-slate-700 rounded-full transition-all"
                                      style={{
                                        width: `${
                                          (dist[star - 1] / maxCount) * 100
                                        }%`,
                                      }}
                                    />
                                  </div>
                                  <span className="w-6 text-slate-400 tabular-nums text-right">
                                    {dist[star - 1]}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Multiple Choice: counts */}
                      {q.type === "multiple_choice" &&
                        q.options && (() => {
                          const counts: Record<string, number> = {};
                          q.options!.forEach((o) => (counts[o] = 0));
                          qAnswers.forEach((a) => {
                            if (typeof a === "string" && counts[a] !== undefined)
                              counts[a]++;
                          });
                          const maxCount = Math.max(
                            ...Object.values(counts),
                            1
                          );
                          return (
                            <div className="space-y-2">
                              {q.options!.map((opt) => (
                                <div
                                  key={opt}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-slate-700 truncate pr-2">
                                        {opt}
                                      </span>
                                      <span className="text-slate-400 tabular-nums shrink-0">
                                        {counts[opt]}
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-indigo-500 rounded-full transition-all"
                                        style={{
                                          width: `${
                                            (counts[opt] / maxCount) * 100
                                          }%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                      {/* Text: list answers */}
                      {q.type === "text" && (
                        <div className="space-y-2">
                          {qAnswers.length === 0 ? (
                            <p className="text-xs text-slate-300 italic">
                              No text responses.
                            </p>
                          ) : (
                            qAnswers.map((a, i) => (
                              <div
                                key={i}
                                className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed"
                              >
                                {String(a)}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // ADMIN: LIBRARY VIEW
  // ============================================================
  if (isAdmin && viewMode === "library") {
    const weeks = getWeeksList();

    return (
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                  Weekly Survey Manager
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                  {ORG_NAME}
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Create and manage weekly surveys for {ORG_NAME} dashboard users.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              {currentWeekBounds.label}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weeks.map((week) => {
              const survey = surveys.get(week.weekStart);
              const isCurrent =
                week.weekStart === currentWeekBounds.weekStart;
              const isFuture = week.weekStart > currentWeekBounds.weekStart;

              return (
                <Card
                  key={week.weekStart}
                  className={`relative rounded-xl border transition-all duration-200 hover:shadow-md group cursor-pointer ${
                    isCurrent
                      ? "border-indigo-300 ring-1 ring-indigo-100"
                      : survey
                      ? "border-slate-200 bg-white"
                      : "border-dashed border-slate-200 bg-white/60"
                  } ${isFuture && !survey ? "opacity-60" : ""}`}
                  onClick={() => {
                    if (survey) {
                      openAnalytics(week.weekStart);
                    } else {
                      openBuilder(week.weekStart, week.weekEnd);
                    }
                  }}
                >
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar
                          className={`w-4 h-4 ${
                            isCurrent ? "text-indigo-500" : "text-slate-300"
                          }`}
                        />
                        <span
                          className={`text-xs font-medium ${
                            isCurrent ? "text-indigo-600" : "text-slate-500"
                          }`}
                        >
                          {week.label.replace(/^Week of /, "")}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-semibold uppercase tracking-wide">
                          Current
                        </span>
                      )}
                    </div>

                    {survey ? (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-slate-900 leading-snug truncate">
                          {survey.title}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <FileText className="w-3 h-3" />
                            {survey.questions.length} questions
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Eye className="w-3 h-3" />
                            View
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-300 group-hover:text-slate-500 transition-colors">
                        <Plus className="w-4 h-4" />
                        <span className="text-xs">
                          {isFuture
                            ? "Schedule a survey"
                            : "No survey created"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // CLIENT: SUBMITTED / ALREADY SUBMITTED
  // ============================================================
  if (submitted || alreadySubmitted) {
    const questionCount = currentSurvey?.questions.length || 0;
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 mx-auto bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-slate-900" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Thank you for your feedback
            </h2>
            <p className="text-slate-400 mt-4 max-w-sm mx-auto text-sm leading-relaxed">
              {alreadySubmitted && !submitted
                ? "You've already submitted this week's survey. Your responses are recorded and will be reviewed by the SOL Theory admin team."
                : "Your responses have been submitted securely and will be reviewed by the SOL Theory admin team. Your input directly shapes the future of this platform."}
            </p>
          </div>
          {submitted && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="font-medium">
                {Object.keys(answers).length} of {questionCount} questions
                answered
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // CLIENT: NO SURVEY THIS WEEK
  // ============================================================
  if (!isAdmin && !currentSurvey) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-16 h-16 mx-auto bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              No survey this week
            </h2>
            <p className="text-slate-400 mt-2 max-w-xs mx-auto text-sm leading-relaxed">
              Check back next Monday! Weekly surveys are published at the
              start of each week.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // CLIENT: SURVEY FLOW
  // ============================================================
  if (!isAdmin && currentSurvey) {
    const surveyQuestions = currentSurvey.questions;
    const totalSteps = surveyQuestions.length;

    if (totalSteps === 0) {
      return (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-slate-400">
            This survey has no questions yet.
          </p>
        </div>
      );
    }

    const safeStep = Math.min(currentStep, totalSteps - 1);
    const question = surveyQuestions[safeStep];
    const progress = ((safeStep + 1) / totalSteps) * 100;
    const currentAnswer = answers[question.id];
    const isAnswered =
      currentAnswer !== undefined && currentAnswer !== "" && currentAnswer !== 0;
    const canProceed = !question.required || isAnswered;

    const setAnswer = (val: string | number) => {
      setAnswers((prev) => ({ ...prev, [question.id]: val }));
    };

    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-2xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-3 pb-2">
            <p className="text-xs font-medium text-indigo-500 tracking-wide uppercase">
              {currentWeekBounds.label}
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
              {currentSurvey.title || "Weekly Feedback Survey"}
            </h1>
            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
              {currentSurvey.description}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>
                Question {safeStep + 1} of {totalSteps}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <Card
            className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300"
            key={question.id}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0 mt-0.5">
                  {safeStep + 1}
                </div>
                <div>
                  <CardTitle className="text-lg font-medium text-slate-900 leading-snug">
                    {question.question}
                  </CardTitle>
                  {question.subtitle && (
                    <CardDescription className="text-slate-400 mt-2 text-sm">
                      {question.subtitle}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-8 pl-[4.5rem]">
              {/* Rating */}
              {question.type === "rating" && (
                <StarRating
                  value={(currentAnswer as number) || 0}
                  onChange={(v) => setAnswer(v)}
                />
              )}

              {/* Multiple Choice */}
              {question.type === "multiple_choice" && question.options && (
                <div className="space-y-2.5 pt-3">
                  {question.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(opt)}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all cursor-pointer ${
                        currentAnswer === opt
                          ? "border-slate-900 bg-slate-50 text-slate-900 font-medium"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all flex items-center justify-center ${
                            currentAnswer === opt
                              ? "border-slate-900 bg-slate-900"
                              : "border-slate-300"
                          }`}
                        >
                          {currentAnswer === opt && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        {opt}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Text */}
              {question.type === "text" && (
                <textarea
                  value={(currentAnswer as string) || ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={4}
                  className="w-full mt-3 px-4 py-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none transition-all"
                />
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={safeStep === 0}
              className="rounded-lg px-5 border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            {safeStep < totalSteps - 1 ? (
              <Button
                onClick={() =>
                  setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))
                }
                disabled={!canProceed}
                className="rounded-lg px-6 bg-slate-900 hover:bg-slate-800 text-white font-medium disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed || submitting}
                className="rounded-lg px-6 bg-slate-900 hover:bg-slate-800 text-white font-medium disabled:opacity-40 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Survey
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Skip hint */}
          {!question.required && (
            <p className="text-center text-xs text-slate-400">
              This question is optional — you can skip it.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
