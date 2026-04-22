"use client";

import { useState } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  CheckCircle2,
  Star,
  ChevronRight,
  ChevronLeft,
  Send,
  Sparkles,
} from "lucide-react";

// ---- Survey Question Definitions ----
type QuestionType = "rating" | "multiple_choice" | "text";

interface SurveyQuestion {
  id: string;
  question: string;
  subtitle?: string;
  type: QuestionType;
  options?: string[];
  required?: boolean;
}

const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "overall_satisfaction",
    question: "How satisfied are you with the overall NXT Chapter dashboard experience?",
    subtitle: "Rate your general feeling about the platform.",
    type: "rating",
    required: true,
  },
  {
    id: "visual_design",
    question: "How would you rate the visual design and style of the dashboard?",
    subtitle: "Does the look and feel inspire confidence in the product?",
    type: "rating",
    required: true,
  },
  {
    id: "ease_of_learning",
    question: "How easy was it to learn how to use the dashboard?",
    subtitle: "Think about your first few minutes navigating the interface.",
    type: "rating",
    required: true,
  },
  {
    id: "navigation_clarity",
    question: "Is the sidebar navigation clear and intuitive?",
    subtitle: "Can you easily find what you're looking for?",
    type: "multiple_choice",
    options: [
      "Very clear — I found everything immediately",
      "Mostly clear — only a few things were hard to find",
      "Somewhat unclear — I needed to explore a lot",
      "Confusing — I couldn't find what I needed",
    ],
    required: true,
  },
  {
    id: "most_valuable_feature",
    question: "Which feature do you find the most valuable?",
    subtitle: "Select the one you use or would use the most.",
    type: "multiple_choice",
    options: [
      "AI Agent Manager (Morpheus)",
      "Google Calendar integration",
      "Direct Messaging & Org Threads",
      "Analytics & Traffic dashboard",
      "Google Docs / Sheets / Slides",
      "YouTube integration",
      "Support Tickets",
      "FAQ section",
    ],
    required: true,
  },
  {
    id: "missing_feature",
    question: "What feature is currently missing that you would most like to see?",
    subtitle: "Be specific — your feedback directly shapes the roadmap.",
    type: "text",
    required: true,
  },
  {
    id: "ai_agent_usefulness",
    question: "How useful is the AI Agent Manager for your daily workflow?",
    subtitle: "Consider how often you rely on it for tasks.",
    type: "rating",
    required: true,
  },
  {
    id: "mobile_experience",
    question: "How would you rate the mobile experience?",
    subtitle: "If you haven't used it on mobile, select N/A.",
    type: "multiple_choice",
    options: [
      "Excellent — works perfectly on my phone",
      "Good — most things work fine",
      "Needs improvement — some features are hard to use",
      "Poor — I avoid using it on mobile",
      "N/A — I only use desktop",
    ],
    required: true,
  },
  {
    id: "loading_speed",
    question: "How would you rate the loading speed and performance?",
    subtitle: "Does the dashboard feel fast and responsive?",
    type: "rating",
    required: true,
  },
  {
    id: "communication_tools",
    question: "Are the communication tools (DMs, Org Threads) meeting your needs?",
    subtitle: "Think about messaging, notifications, and team collaboration.",
    type: "multiple_choice",
    options: [
      "Yes — they've completely replaced other tools for me",
      "Mostly — they work well for basic communication",
      "Partially — I still rely on external tools (Slack, Teams, etc.)",
      "Not yet — they need significant improvement",
    ],
    required: true,
  },
  {
    id: "recommend_likelihood",
    question: "How likely are you to recommend NXT Chapter to a colleague?",
    subtitle: "1 = Not at all, 5 = Absolutely would recommend.",
    type: "rating",
    required: true,
  },
  {
    id: "additional_feedback",
    question: "Any other feedback, suggestions, or ideas?",
    subtitle: "This is your open floor — tell us anything.",
    type: "text",
    required: false,
  },
];

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
    <div className="flex items-center gap-2 pt-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="group transition-transform hover:scale-125 active:scale-95 cursor-pointer"
        >
          <Star
            className={`w-9 h-9 transition-colors duration-150 ${
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                : "fill-transparent text-slate-300 group-hover:text-amber-200"
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs font-bold text-slate-400 ml-2 tabular-nums">
          {value} / 5
        </span>
      )}
    </div>
  );
}

// ---- Main Survey Component ----
export default function NxtChapterSurveyPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const question = SURVEY_QUESTIONS[currentStep];
  const totalSteps = SURVEY_QUESTIONS.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const currentAnswer = answers[question.id];
  const isAnswered =
    currentAnswer !== undefined && currentAnswer !== "" && currentAnswer !== 0;
  const canProceed = !question.required || isAnswered;

  const setAnswer = (val: string | number) => {
    setAnswers((prev) => ({ ...prev, [question.id]: val }));
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, "survey_submissions"), {
        surveyType: "nxt_chapter_client_use_case",
        userId: user.uid,
        userEmail: user.email || "",
        userName: user.displayName || "",
        answers,
        submittedAt: serverTimestamp(),
        dashboard: "nxtchapter",
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Survey submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- SUCCESS STATE ----
  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-24 h-24 mx-auto bg-emerald-50 rounded-[2rem] border border-emerald-100 flex items-center justify-center shadow-lg shadow-emerald-100/50">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900">
              Thank You!
            </h2>
            <p className="text-slate-500 mt-3 max-w-md mx-auto font-medium leading-relaxed">
              Your feedback has been submitted securely and will be reviewed by
              the SOL Theory admin team. Your input directly shapes the future
              of this platform.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <Sparkles className="w-4 h-4" />
            <span className="font-semibold">
              {Object.keys(answers).length} / {totalSteps} questions answered
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ---- SURVEY FLOW ----
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pb-2">
          <div className="w-14 h-14 mx-auto bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center mb-4 shadow-sm">
            <ClipboardList className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Client Use Case Survey
          </h1>
          <p className="text-slate-500 text-sm font-medium max-w-lg mx-auto">
            Help us improve the NXT Chapter dashboard experience. Your answers
            are confidential and reviewed only by the SOL Theory admin team.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>
              Question {currentStep + 1} of {totalSteps}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <Card className="bg-white border-0 shadow-md ring-1 ring-slate-100 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300" key={question.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm shrink-0 mt-0.5">
                {currentStep + 1}
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 leading-snug">
                  {question.question}
                </CardTitle>
                {question.subtitle && (
                  <CardDescription className="text-slate-500 font-medium mt-1.5">
                    {question.subtitle}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-6 pl-[4.25rem]">
            {/* Rating */}
            {question.type === "rating" && (
              <StarRating
                value={(currentAnswer as number) || 0}
                onChange={(v) => setAnswer(v)}
              />
            )}

            {/* Multiple Choice */}
            {question.type === "multiple_choice" && question.options && (
              <div className="space-y-2 pt-2">
                {question.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswer(opt)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer ${
                      currentAnswer === opt
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm"
                        : "border-slate-100 bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all flex items-center justify-center ${
                          currentAnswer === opt
                            ? "border-indigo-500 bg-indigo-500"
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
                className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-slate-100 bg-white text-sm text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="rounded-xl px-5 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {currentStep < totalSteps - 1 ? (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
              disabled={!canProceed}
              className="rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-200/50 disabled:opacity-40 cursor-pointer"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed || submitting}
              className="rounded-xl px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-200/50 disabled:opacity-40 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Submitting...
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

        {/* Skip hint for optional questions */}
        {!question.required && (
          <p className="text-center text-xs text-slate-400 font-medium">
            This question is optional — you can skip it.
          </p>
        )}
      </div>
    </div>
  );
}
