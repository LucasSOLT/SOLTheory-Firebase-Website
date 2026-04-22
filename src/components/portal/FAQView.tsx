"use client";

import React, { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";

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

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-700 h-full overflow-y-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 mb-8 pt-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            Help & <span className="text-indigo-600">FAQ</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Common troubleshooting solutions and operational guides for your workspace.
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
          <HelpCircle className="w-6 h-6 text-indigo-600" />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mix-blend-multiply">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Top 10 Common Issues
          </h2>
        </div>
        
        <div className="divide-y divide-slate-100">
          {FAQ_LIST.map((faq, index) => (
            <div key={index} className="transition-colors hover:bg-slate-50">
              <button 
                onClick={() => toggleOpen(index)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
              >
                <span className="font-bold text-slate-800 text-[15px] pr-8">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-indigo-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                )}
              </button>
              
              {openIndex === index && (
                <div className="px-6 pb-6 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-xl p-5 flex items-start gap-4">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="pt-8 pb-4 text-center">
         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Need more help? Submit a support ticket!</p>
      </div>
    </div>
  );
}
