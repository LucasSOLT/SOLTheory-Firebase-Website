"use client";

import React, { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, ArrowRight, LifeBuoy } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { usePathname, useRouter } from "next/navigation";

export const FAQ_LIST = [
  {
    question: "Why does my Gmail sync disconnect or say 'Auth Error'?",
    answer: "This happens when Google's security revokes your token or if you block popups. To fix this, click the 'Reconnect Gmail Account' button inside the Observer Panel and ensure you grant full permissions during the Google SignIn popup."
  },
  {
    question: "The AI Agent hit a 'Quota' error or the chat slowed down.",
    answer: "If you send excessively massive image files directly to the agent over a long period, your browser's local memory fills up. Simply refresh the page; your text history is saved, and internal memory will be cleared to speed up operation."
  },
  {
    question: "I cannot promote a team member in an Organization Channel.",
    answer: "Only the user who originally created the channel, or an assigned 'Admin', can change user roles natively. Open the Channel Info panel on the right and use the dropdown next to their name. If it snaps back, you do not have permission."
  },
  {
    question: "My Google Drive files are not appearing in the observer panel.",
    answer: "Google Drive requires a secondary, isolated authorization to read your organization's files. Click the 'Cloud' icon above the AI chat input to explicitly grant Drive access to your workspace."
  },
  {
    question: "A support ticket is stuck on 'Unanswered' (Red).",
    answer: "Support tickets automatically monitor activity. To flip a ticket to 'Answered' (Green), simply click on the ticket to expand it, type a response in the comment section at the bottom, and hit Reply."
  },
  {
    question: "File uploads are failing or not sending in the Agent Chat.",
    answer: "The knowledge ingestion engine currently only parses specific file types to protect security. Make sure your upload is formatted as a PNG, JPEG, PDF, or Standard Text (TXT) file, and keep sizes reasonable."
  },
  {
    question: "Jarvis Voice Integration is completely silent or grayed out.",
    answer: "Voice processing requires explicit hardware permissions. Check the 'Lock' icon next to your URL bar and ensure that Microphone access is toggled 'Allow' for this dashboard. Re-click the microphone icon after granting access."
  },
  {
    question: "I created a new channel, but my team cannot see it.",
    answer: "By default, Organization channels are completely private. To allow others to join, you must explicitly invite their email address using the 'Add People' function in the Channel Info sidebar."
  },
  {
    question: "My past AI chat sessions disappeared on a new computer.",
    answer: "For supreme data privacy, AI agent conversations act as local instances pinned to your machine's local storage rather than syncing globally. Logging into a new device will spin up a fresh set of local encrypted sessions."
  },
  {
    question: "I archived a resolved support ticket and now I can't find it.",
    answer: "Archived tickets are totally purged from your Inbox and Sent streams to reduce clutter. You can find all of them safely stored by clicking the 'Archived' view button at the top of the Support Tickets dashboard."
  }
];

export function FAQView() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { isDarkMode } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // Extract orgId from the path: /portal/dashboard/[orgId]/faq
  const pathSegments = pathname.split('/');
  const orgId = pathSegments[3] || '';

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleSupportClick = () => {
    router.push(`/portal/dashboard/${orgId}/settings?tab=support`);
  };

  const containerClass = isDarkMode
    ? "bg-slate-800/90 rounded-3xl border border-slate-700/80 shadow-md overflow-hidden"
    : "bg-[#faf8f3] rounded-3xl border border-slate-200 shadow-sm overflow-hidden";

  const headerClass = isDarkMode
    ? "p-6 border-b border-slate-700 bg-slate-800/90"
    : "p-6 border-b border-slate-100 bg-[#faf6ed]/50";

  const questionTextClass = isDarkMode ? "font-bold text-slate-100 text-[15px] pr-8" : "font-bold text-slate-800 text-[15px] pr-8";
  const answerTextClass = isDarkMode ? "text-sm text-slate-200 leading-relaxed font-medium" : "text-sm text-slate-600 leading-relaxed font-medium";

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
      <div className={`flex flex-col md:flex-row md:items-center justify-between pb-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} mb-8 pt-6 gap-4`}>
        <div>
          <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Help & <span className="text-indigo-500">FAQ</span>
          </h1>
          <p className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Common troubleshooting solutions and operational guides for your workspace.
          </p>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${isDarkMode ? 'bg-indigo-950/60 border-indigo-800 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
          <HelpCircle className="w-6 h-6" />
        </div>
      </div>

      <div className={containerClass}>
        <div className={headerClass}>
          <h2 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            <AlertCircle className="w-4 h-4 text-amber-500" /> Top 10 Common Issues
          </h2>
        </div>

        <div className={`divide-y ${isDarkMode ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
          {FAQ_LIST.map((faq, index) => (
            <div key={index} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-750/70' : 'hover:bg-[#f2ece0]'}`}>
              <button
                type="button"
                onClick={() => toggleOpen(index)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none cursor-pointer"
              >
                <span className={questionTextClass}>{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-indigo-500 shrink-0" />
                ) : (
                  <ChevronDown className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                )}
              </button>

              {openIndex === index && (
                <div className="px-6 pb-6 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className={`rounded-2xl p-5 flex items-start gap-4 border ${isDarkMode ? 'bg-indigo-950/40 border-indigo-900/60 text-indigo-100' : 'bg-indigo-50/70 border-indigo-100 text-slate-700'}`}>
                    <CheckCircle2 className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                    <p className={answerTextClass}>{faq.answer}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Prominent clickable support ticket button */}
      <div className="pt-6 pb-4 flex flex-col items-center justify-center gap-3">
        <p className={`text-xs uppercase tracking-wider font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Didn&apos;t find what you need?
        </p>
        <button
          type="button"
          onClick={handleSupportClick}
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Submit a Support Ticket</span>
          <ArrowRight className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
