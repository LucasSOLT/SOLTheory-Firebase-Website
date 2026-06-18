"use client";

import { useState } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Star,
  ChevronRight,
  ChevronLeft,
  Send,
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
        <div className="text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 mx-auto bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-slate-900" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Thank you for your feedback
            </h2>
            <p className="text-slate-400 mt-4 max-w-sm mx-auto text-sm leading-relaxed">
              Your responses have been submitted securely and will be reviewed by
              the SOL Theory admin team. Your input directly shapes the future
              of this platform.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <span className="font-medium">
              {Object.keys(answers).length} of {totalSteps} questions answered
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ---- SURVEY FLOW ----
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 pb-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
            Client Use Case Survey
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            Help us improve the NXT Chapter dashboard experience. Your answers
            are confidential and reviewed only by the SOL Theory admin team.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>
              Question {currentStep + 1} of {totalSteps}
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
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300" key={question.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0 mt-0.5">
                {currentStep + 1}
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
            disabled={currentStep === 0}
            className="rounded-lg px-5 border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {currentStep < totalSteps - 1 ? (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
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
          <p className="text-center text-xs text-slate-400">
            This question is optional — you can skip it.
          </p>
        )}
      </div>
    </div>
  );
}
