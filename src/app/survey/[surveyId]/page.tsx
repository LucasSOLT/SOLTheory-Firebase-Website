"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useFirestore } from "@/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, ArrowRight, ArrowLeft, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublicSurveyPage() {
  const { surveyId } = useParams();
  const firestore = useFirestore();

  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(0); // 0 = intro/name, 1...N = questions, N+1 = done
  const [participantName, setParticipantName] = useState("");
  const [participantOrg, setParticipantOrg] = useState("");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!firestore || !surveyId) return;
    const fetchSurvey = async () => {
      try {
        const docRef = doc(firestore, "custom_surveys", surveyId as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setSurvey({ id: snap.id, ...snap.data() });
        } else {
          setError("Survey not found.");
        }
      } catch (err) {
        console.error(err);
        setError("Error loading survey.");
      }
      setLoading(false);
    };
    fetchSurvey();
  }, [firestore, surveyId]);

  const handleNext = () => {
    if (currentStep === 0 && (!participantName.trim() || !participantOrg.trim())) {
      alert("Please enter your name and organization to continue.");
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const handleSubmit = async () => {
    if (!firestore || !survey) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, "custom_survey_responses"), {
        surveyId: survey.id,
        surveyTitle: survey.title,
        participantName,
        participantOrg,
        answers,
        submittedAt: serverTimestamp()
      });
      setCurrentStep(survey.questions.length + 1);
    } catch (err) {
      console.error(err);
      alert("Failed to submit survey. Please try again.");
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (error || !survey) {
    return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4"><h1 className="text-2xl font-black text-slate-800">{error || "Survey not found"}</h1></div>;
  }

  const isIntro = currentStep === 0;
  const isDone = currentStep > survey.questions.length;
  const isLastQuestion = currentStep === survey.questions.length;

  const currentQuestion = !isIntro && !isDone ? survey.questions[currentStep - 1] : null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">

        {/* Progress Bar */}
        {!isIntro && !isDone && (
          <div className="w-full h-1.5 bg-slate-100">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${(currentStep / survey.questions.length) * 100}%` }}
            />
          </div>
        )}

        <div className="p-8 sm:p-12 min-h-[400px] flex flex-col justify-center">

          {/* STEP 0: Intro */}
          {isIntro && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{survey.title}</h1>
              <p className="text-slate-500 font-medium text-lg">{survey.description}</p>

              {/* Show author name if provided */}
              {survey.authorName && (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-400 pt-2">
                  <UserCircle className="w-4 h-4" />
                  <span>Created by {survey.authorName}</span>
                </div>
              )}

              <div className="space-y-4 pt-6 mt-6 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Organization</label>
                  <input
                    type="text"
                    value={participantOrg}
                    onChange={(e) => setParticipantOrg(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-8">
                <Button onClick={handleNext} className="w-full sm:w-auto h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg gap-2 shadow-lg shadow-indigo-600/20">
                  Start Survey <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* QUESTIONS */}
          {!isIntro && !isDone && currentQuestion && (
            <div key={currentQuestion.id} className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300 flex-1 flex flex-col justify-center">
              <span className="text-sm font-black text-indigo-500 tracking-widest uppercase">Question {currentStep} of {survey.questions.length}</span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{currentQuestion.prompt}</h2>

              <div className="pt-4">
                {currentQuestion.type === "text" && (
                  <textarea
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})}
                    placeholder="Type your answer here..."
                    className="w-full h-32 p-4 rounded-2xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800 resize-none"
                  />
                )}

                {currentQuestion.type === "choice" && (
                  <div className="space-y-3">
                    {currentQuestion.options?.map((opt: string) => (
                      <button
                        key={opt}
                        onClick={() => setAnswers({...answers, [currentQuestion.id]: opt})}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all font-bold cursor-pointer ${answers[currentQuestion.id] === opt ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-white"}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {currentQuestion.type === "rating" && (
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setAnswers({...answers, [currentQuestion.id]: n})}
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 transition-all font-black text-xl flex items-center justify-center cursor-pointer ${answers[currentQuestion.id] === n ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "border-slate-100 bg-slate-50 text-slate-400 hover:border-indigo-200 hover:text-indigo-600 hover:bg-white"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-8 mt-auto">
                <Button onClick={handlePrev} variant="ghost" className="font-bold text-slate-500 hover:text-slate-800 gap-2 cursor-pointer">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>

                {isLastQuestion ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || answers[currentQuestion.id] === undefined || answers[currentQuestion.id] === ""}
                    className="h-12 px-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Survey"} <CheckCircle2 className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={answers[currentQuestion.id] === undefined || answers[currentQuestion.id] === ""}
                    className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    Next <ArrowRight className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* DONE */}
          {isDone && (
            <div className="flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95 fade-in duration-500">
              <div className="w-24 h-24 bg-emerald-100 rounded-[2rem] rotate-12 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <h1 className="text-4xl font-black text-slate-900">Thank You!</h1>
              <p className="text-slate-500 font-medium text-lg max-w-md">Your responses have been successfully recorded.</p>
              <p className="text-sm font-bold text-slate-400 mt-8 pt-8 border-t border-slate-100">Powered by SOL Theory</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
