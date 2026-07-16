"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ClipboardList,
  ShieldCheck,
  Heart,
  DollarSign,
  AlertTriangle,
  ExternalLink,
  Lightbulb,
  CheckCircle2,
  FileText,
  Building2,
  Globe,
  Landmark,
  ScrollText,
  Link as LinkIcon,
  Zap,
  Star,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface SectionData {
  id: string;
  title: string;
  icon: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  iconGradient: string;
  content: React.ReactNode;
}

/* ═══════════════════════════════════════════════════════════
   Pro Tip Component
   ═══════════════════════════════════════════════════════════ */

function ProTip({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div
      className={`rounded-xl p-4 flex gap-3 items-start ${
        isDark
          ? "bg-amber-900/20 border border-amber-700/40"
          : "bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/70"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isDark ? "bg-amber-800/40" : "bg-amber-100"
        }`}
      >
        <Lightbulb className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
      </div>
      <div className="min-w-0">
        <p
          className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
            isDark ? "text-amber-400" : "text-amber-600"
          }`}
        >
          Pro Tip
        </p>
        <div className={`text-sm leading-relaxed ${isDark ? "text-amber-200/90" : "text-amber-800"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Numbered Step Component
   ═══════════════════════════════════════════════════════════ */

function Step({
  num,
  title,
  detail,
  isDark,
}: {
  num: number;
  title: string;
  detail?: string;
  isDark: boolean;
}) {
  return (
    <div className="flex gap-3 items-start">
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black ${
          isDark ? "bg-indigo-900/50 text-indigo-300 border border-indigo-700/40" : "bg-indigo-50 text-indigo-600 border border-indigo-200"
        }`}
      >
        {num}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-bold leading-snug ${isDark ? "text-slate-200" : "text-slate-800"}`}>
          {title}
        </p>
        {detail && (
          <p className={`text-[13px] mt-0.5 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Bullet Item Component
   ═══════════════════════════════════════════════════════════ */

function Bullet({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div className="flex gap-2.5 items-start">
      <CheckCircle2
        className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? "text-emerald-500/70" : "text-emerald-500"}`}
      />
      <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>{children}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Warning Item Component
   ═══════════════════════════════════════════════════════════ */

function Warning({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div className="flex gap-2.5 items-start">
      <AlertTriangle
        className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? "text-red-400/70" : "text-red-500"}`}
      />
      <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>{children}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   External Link Component
   ═══════════════════════════════════════════════════════════ */

function ExtLink({
  href,
  label,
  description,
  isDark,
}: {
  href: string;
  label: string;
  description?: string;
  isDark: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all group ${
        isDark
          ? "border-slate-700 bg-slate-800/50 hover:border-indigo-600 hover:bg-indigo-900/20"
          : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isDark ? "bg-slate-700" : "bg-slate-100"
        } group-hover:bg-indigo-100`}
      >
        <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-bold truncate ${
            isDark ? "text-indigo-400 group-hover:text-indigo-300" : "text-indigo-600 group-hover:text-indigo-700"
          }`}
        >
          {label}
        </p>
        {description && (
          <p className={`text-[12px] truncate ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            {description}
          </p>
        )}
      </div>
      <ChevronRight
        className={`w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
          isDark ? "text-indigo-400" : "text-indigo-500"
        }`}
      />
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════
   Collapsible Section Component
   ═══════════════════════════════════════════════════════════ */

function CollapsibleSection({
  section,
  isOpen,
  onToggle,
  isDark,
}: {
  section: SectionData;
  isOpen: boolean;
  onToggle: () => void;
  isDark: boolean;
}) {
  const Icon = section.icon;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
        isDark ? "bg-slate-900 border-slate-800" : "bg-[#fefdfb] border-slate-200"
      } ${isOpen ? (isDark ? "shadow-lg shadow-slate-900/50" : "shadow-md shadow-slate-200/60") : ""}`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className={`w-full px-5 py-4 flex items-center gap-3 text-left group transition-all cursor-pointer ${
          isDark ? "hover:bg-slate-800/50" : "hover:bg-slate-50/80"
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${section.iconGradient}`}
        >
          <Icon className="w-5 h-5 text-white" />{/* eslint-disable-line */}
        </div>
        <h2
          className={`flex-1 text-sm font-extrabold tracking-tight ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {section.title}
        </h2>
        <ChevronDown
          className={`w-5 h-5 transition-transform duration-300 ${
            isDark ? "text-slate-500" : "text-slate-400"
          } ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Content */}
      {isOpen && (
        <div
          className={`px-5 pb-5 pt-1 border-t animate-in fade-in slide-in-from-top-1 duration-200 ${
            isDark ? "border-slate-800" : "border-slate-100"
          }`}
        >
          {section.content}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════════ */

export default function GrantWritingGuidePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDarkMode } = useTheme();

  // Determine org from pathname for breadcrumb link
  const orgSlug = pathname?.includes("/nxtchapter/") ? "nxtchapter" : "soltheory";

  // Track open sections — all open by default
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["federal-process", "federal-reqs", "foundation", "budget", "mistakes", "links"])
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () =>
    setOpenSections(new Set(["federal-process", "federal-reqs", "foundation", "budget", "mistakes", "links"]));
  const collapseAll = () => setOpenSections(new Set());

  /* ─── Theme Vars ─── */
  const bg = isDarkMode ? "bg-slate-950" : "bg-[#f5f1e8]";
  const textPrimary = isDarkMode ? "text-white" : "text-slate-900";
  const textSecondary = isDarkMode ? "text-slate-400" : "text-slate-500";

  const font: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  } as React.CSSProperties;

  /* ─── Section Definitions ─── */
  const sections: SectionData[] = [
    {
      id: "federal-process",
      title: "Federal Grant Application Process (Step-by-Step)",
      icon: ClipboardList,
      iconGradient: "bg-gradient-to-br from-indigo-500 to-blue-600",
      content: (
        <div className="space-y-4 pt-3">
          <Step num={1} title="Register your organization on SAM.gov" detail="Takes 7–10 business days. Start this early — you cannot submit without it." isDark={isDarkMode} />
          <Step num={2} title="Obtain a Unique Entity ID (UEI)" detail="Replaces the old DUNS number. Issued automatically during SAM.gov registration." isDark={isDarkMode} />
          <Step num={3} title="Create a Grants.gov account" detail="Separate from SAM.gov. You need both to apply for federal grants." isDark={isDarkMode} />
          <Step num={4} title="Find opportunities using CFDA numbers or keyword search" detail="Browse Grants.gov or use agency-specific portals (e.g., eRA Commons for NIH)." isDark={isDarkMode} />
          <Step num={5} title="Download the full NOFO (Notice of Funding Opportunity)" detail="The NOFO contains everything: eligibility, evaluation criteria, required forms, and deadlines." isDark={isDarkMode} />
          <Step num={6} title="Review eligibility requirements carefully" detail="Confirm your org type, geographic location, and programmatic focus all qualify." isDark={isDarkMode} />
          <Step num={7} title="Prepare your SF-424 Application form" detail="The standard federal face sheet. Double-check your UEI and SAM.gov info matches." isDark={isDarkMode} />
          <Step num={8} title="Write the project narrative" detail="Usually 10–25 pages. Address every evaluation criterion in the order listed in the NOFO." isDark={isDarkMode} />
          <Step num={9} title="Prepare the budget (SF-424A) and budget justification" detail="Every line item needs a clear justification. Round numbers look estimated — be precise." isDark={isDarkMode} />
          <Step num={10} title="Gather required attachments" detail="Letters of support, key personnel resumes, organizational chart, logic model, etc." isDark={isDarkMode} />
          <Step num={11} title="Submit via Grants.gov at least 24–48 hours before deadline" detail="The system can be slow near deadlines. Late submissions are automatically rejected." isDark={isDarkMode} />
          <Step num={12} title="Save your confirmation number and tracking ID" detail="Screenshot everything. You'll need these if there are submission issues." isDark={isDarkMode} />

          <ProTip isDark={isDarkMode}>
            Create a master checklist for each grant with every required document listed. Cross-reference it against the NOFO&apos;s table of contents before submitting.
          </ProTip>
        </div>
      ),
    },
    {
      id: "federal-reqs",
      title: "Common Federal Requirements",
      icon: ShieldCheck,
      iconGradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
      content: (
        <div className="space-y-3 pt-3">
          <Bullet isDark={isDarkMode}>
            <strong>SAM.gov registration</strong> — Must be renewed annually. Set a calendar reminder 30 days before expiration.
          </Bullet>
          <Bullet isDark={isDarkMode}>
            <strong>UEI number</strong> — Your Unique Entity Identifier. It replaced the DUNS number in April 2022.
          </Bullet>
          <Bullet isDark={isDarkMode}>
            <strong>Negotiated Indirect Cost Rate Agreement (NICRA)</strong> — Negotiate with your cognizant federal agency. If you don&apos;t have one, you can use the 10% de minimis rate under 2 CFR 200.
          </Bullet>
          <Bullet isDark={isDarkMode}>
            <strong>Single Audit</strong> — Required if your organization spends $750K+ in federal funds in a fiscal year (per 2 CFR 200 Subpart F).
          </Bullet>
          <Bullet isDark={isDarkMode}>
            <strong>SF-424, SF-424A, SF-424B forms</strong> — The standard application, budget, and assurances forms used by most federal agencies.
          </Bullet>
          <Bullet isDark={isDarkMode}>
            <strong>Drug-Free Workplace certification</strong> — Required for all federal grant recipients.
          </Bullet>
          <Bullet isDark={isDarkMode}>
            <strong>Lobbying certification</strong> — You must certify that no federal funds will be used for lobbying activities.
          </Bullet>

          <ProTip isDark={isDarkMode}>
            Keep a &quot;compliance binder&quot; (digital or physical) with current copies of all certifications, your NICRA letter, single audit, and board resolution authorizing grant applications. This saves hours when deadlines hit.
          </ProTip>
        </div>
      ),
    },
    {
      id: "foundation",
      title: "Philanthropic / Foundation Applications",
      icon: Heart,
      iconGradient: "bg-gradient-to-br from-pink-500 to-rose-600",
      content: (
        <div className="space-y-5 pt-3">
          {/* LOIs */}
          <div>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Letters of Inquiry (LOIs)
            </h3>
            <div className="space-y-2">
              <Bullet isDark={isDarkMode}>Typically 2–3 pages; acts as a screening tool before a full proposal is invited.</Bullet>
              <Bullet isDark={isDarkMode}>Include: organization overview, problem statement, proposed solution, target population, budget summary, and amount requested.</Bullet>
              <Bullet isDark={isDarkMode}>Tone should be concise and compelling — think of it as an executive summary of your proposal.</Bullet>
            </div>
          </div>

          {/* Common Attachments */}
          <div>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Common Attachments
            </h3>
            <div className="space-y-2">
              <Bullet isDark={isDarkMode}>IRS Form 990 tax return (most recent)</Bullet>
              <Bullet isDark={isDarkMode}>Annual report</Bullet>
              <Bullet isDark={isDarkMode}>Board of directors list with affiliations</Bullet>
              <Bullet isDark={isDarkMode}>Most recent financial audit</Bullet>
              <Bullet isDark={isDarkMode}>IRS determination letter (501(c)(3) status)</Bullet>
            </div>
          </div>

          {/* Research */}
          <div>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Foundation Research
            </h3>
            <div className="space-y-2">
              <Bullet isDark={isDarkMode}>Check IRS 990-PF filings (via ProPublica Nonprofit Explorer) to see giving patterns, average grant size, and grantee lists.</Bullet>
              <Bullet isDark={isDarkMode}>Look at the foundation&apos;s website for stated priorities, geographic focus, and application timelines.</Bullet>
            </div>
          </div>

          {/* Timeline & Relationships */}
          <div>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Follow-up & Relationship Building
            </h3>
            <div className="space-y-2">
              <Bullet isDark={isDarkMode}>Expect response timelines of 3–6 months from submission. Some foundations respond even slower.</Bullet>
              <Bullet isDark={isDarkMode}>Attend foundation events and conferences — personal connections with program officers make a difference.</Bullet>
              <Bullet isDark={isDarkMode}>Always send a thank-you letter, even if you&apos;re denied. Maintain the relationship for future cycles.</Bullet>
            </div>
          </div>

          <ProTip isDark={isDarkMode}>
            Before writing any proposal, call the program officer. A 10-minute conversation can save you 40 hours of writing on a grant you were never going to win.
          </ProTip>
        </div>
      ),
    },
    {
      id: "budget",
      title: "Budget Preparation Tips",
      icon: DollarSign,
      iconGradient: "bg-gradient-to-br from-amber-500 to-orange-600",
      content: (
        <div className="space-y-5 pt-3">
          {/* Direct vs. Indirect */}
          <div
            className={`rounded-xl p-4 ${
              isDarkMode ? "bg-slate-800/50 border border-slate-700" : "bg-slate-50 border border-slate-200"
            }`}
          >
            <h3 className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Direct vs. Indirect Costs
            </h3>
            <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              <strong>Direct costs</strong> are expenses specifically tied to the project (staff salaries, supplies, travel).{" "}
              <strong>Indirect costs</strong> are shared organizational expenses (rent, utilities, admin) allocated as a percentage of direct costs.
            </p>
          </div>

          {/* Budget Categories */}
          <div>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Standard Budget Categories
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["Personnel", "Fringe Benefits", "Travel", "Equipment", "Supplies", "Contractual", "Other", "Indirect"].map(
                (cat) => (
                  <div
                    key={cat}
                    className={`px-3 py-2 rounded-lg text-center text-xs font-bold ${
                      isDarkMode
                        ? "bg-slate-800 text-slate-300 border border-slate-700"
                        : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    {cat}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Key Points */}
          <div className="space-y-3">
            <Bullet isDark={isDarkMode}>
              <strong>Personnel:</strong> Include salaries + fringe benefits. Fringe is typically 25–35% of salary (FICA, health insurance, retirement, workers&apos; comp).
            </Bullet>
            <Bullet isDark={isDarkMode}>
              <strong>Cost sharing / matching:</strong> Some grants require you to match a percentage with your own funds. Document match sources clearly.
            </Bullet>
            <Bullet isDark={isDarkMode}>
              <strong>In-kind contributions:</strong> Donated goods, services, or volunteer time. Must be documented with fair market value and verification letters.
            </Bullet>
            <Bullet isDark={isDarkMode}>
              <strong>Budget justification:</strong> A narrative that explains WHY each cost is necessary and HOW you calculated the amount. Reviewers read this closely.
            </Bullet>
          </div>

          <ProTip isDark={isDarkMode}>
            Use precise numbers, not rounded estimates. &quot;$47,250 for a Program Coordinator at 75% FTE&quot; is far more convincing than &quot;$50,000 for staff.&quot;
          </ProTip>
        </div>
      ),
    },
    {
      id: "mistakes",
      title: "Common Mistakes to Avoid",
      icon: AlertTriangle,
      iconGradient: "bg-gradient-to-br from-red-500 to-rose-600",
      content: (
        <div className="space-y-3 pt-3">
          <Warning isDark={isDarkMode}>
            <strong>Submitting at the last minute</strong> — Grants.gov can be extremely slow near deadlines. Upload at least 24–48 hours early.
          </Warning>
          <Warning isDark={isDarkMode}>
            <strong>Not reading the NOFO completely</strong> — Every word matters. Missing a single requirement can disqualify you.
          </Warning>
          <Warning isDark={isDarkMode}>
            <strong>Exceeding page limits or font size requirements</strong> — Reviewers will literally stop reading at the page limit.
          </Warning>
          <Warning isDark={isDarkMode}>
            <strong>Missing required forms or attachments</strong> — Create a checklist from the NOFO and verify every item before submission.
          </Warning>
          <Warning isDark={isDarkMode}>
            <strong>Not having an active SAM.gov registration</strong> — If it expired, you cannot receive funds even if approved.
          </Warning>
          <Warning isDark={isDarkMode}>
            <strong>Using jargon instead of clear language</strong> — Reviewers may not be subject-matter experts. Write for a smart generalist.
          </Warning>
          <Warning isDark={isDarkMode}>
            <strong>Not addressing all evaluation criteria</strong> — If the NOFO lists 5 criteria, your narrative must explicitly address all 5, ideally with headers that match.
          </Warning>
          <Warning isDark={isDarkMode}>
            <strong>Requesting more than the funding ceiling</strong> — Your application will be automatically disqualified.
          </Warning>
          <Warning isDark={isDarkMode}>
            <strong>Forgetting to include letters of support</strong> — These demonstrate community buy-in and partnerships. Get them early.
          </Warning>
          <Warning isDark={isDarkMode}>
            <strong>Not proofreading</strong> — Typos and formatting errors suggest carelessness and undermine credibility.
          </Warning>

          <ProTip isDark={isDarkMode}>
            Have someone who knows nothing about your project read the narrative. If they can&apos;t explain it back to you, your writing isn&apos;t clear enough.
          </ProTip>
        </div>
      ),
    },
    {
      id: "links",
      title: "Useful Links & Resources",
      icon: LinkIcon,
      iconGradient: "bg-gradient-to-br from-violet-500 to-purple-600",
      content: (
        <div className="space-y-3 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ExtLink href="https://sam.gov" label="SAM.gov" description="System for Award Management — registration required for all federal grants" isDark={isDarkMode} />
            <ExtLink href="https://www.grants.gov" label="Grants.gov" description="Federal grant search and application portal" isDark={isDarkMode} />
            <ExtLink href="https://www.usaspending.gov" label="USASpending.gov" description="Track federal spending and past awards" isDark={isDarkMode} />
            <ExtLink href="https://projects.propublica.org/nonprofits/" label="ProPublica Nonprofit Explorer" description="Search 990 filings and nonprofit financials" isDark={isDarkMode} />
            <ExtLink href="https://apps.irs.gov/app/eos/" label="IRS Tax Exempt Org Search" description="Verify 501(c)(3) status" isDark={isDarkMode} />
            <ExtLink href="https://fconline.foundationcenter.org/" label="Foundation Directory (Candid)" description="Foundation research and funder profiles" isDark={isDarkMode} />
            <ExtLink href="https://www.ecfr.gov" label="eCFR" description="Electronic Code of Federal Regulations" isDark={isDarkMode} />
            <ExtLink href="https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200" label="2 CFR 200 (Uniform Guidance)" description="The rules governing all federal grants" isDark={isDarkMode} />
          </div>

          <ProTip isDark={isDarkMode}>
            Bookmark 2 CFR 200 — it governs cost principles, audit requirements, and administrative requirements for all federal awards. When in doubt, reference it.
          </ProTip>
        </div>
      ),
    },
  ];

  return (
    <div className={`w-full h-full overflow-y-auto -mx-4 -mb-4 md:-mx-10 md:-mb-10 ${bg} animate-in fade-in duration-500`} style={font}>
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => router.push(`/portal/dashboard/${orgSlug}/grant-statuses`)}
            className={`flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
              isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Grant Statuses
          </button>
          <ChevronRight className={`w-3 h-3 ${isDarkMode ? "text-slate-600" : "text-slate-300"}`} />
          <span className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            Writing Guide
          </span>
        </div>

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-extrabold tracking-tight ${textPrimary}`}>
                Grant Writing Quick-Reference Guide
              </h1>
              <p className={`text-xs mt-0.5 ${textSecondary}`}>
                Everything you need to know, in one bookmarkable page
              </p>
            </div>
          </div>

          {/* Expand / Collapse controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isDarkMode
                  ? "border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                  : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-400"
              }`}
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isDarkMode
                  ? "border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                  : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-400"
              }`}
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* ── Quick Stats Bar ── */}
        <div
          className={`rounded-2xl border p-4 flex flex-wrap items-center gap-6 ${
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-[#fefdfb] border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${isDarkMode ? "text-amber-400" : "text-amber-500"}`} />
            <span className={`text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              12-Step Federal Process
            </span>
          </div>
          <div className={`w-px h-4 ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`} />
          <div className="flex items-center gap-2">
            <Star className={`w-4 h-4 ${isDarkMode ? "text-indigo-400" : "text-indigo-500"}`} />
            <span className={`text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              6 Reference Sections
            </span>
          </div>
          <div className={`w-px h-4 ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`} />
          <div className="flex items-center gap-2">
            <Lightbulb className={`w-4 h-4 ${isDarkMode ? "text-emerald-400" : "text-emerald-500"}`} />
            <span className={`text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              Pro Tips in Every Section
            </span>
          </div>
          <div className={`w-px h-4 ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`} />
          <div className="flex items-center gap-2">
            <Globe className={`w-4 h-4 ${isDarkMode ? "text-violet-400" : "text-violet-500"}`} />
            <span className={`text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              8 Essential Links
            </span>
          </div>
        </div>

        {/* ── Sections ── */}
        <div className="space-y-4">
          {sections.map((section) => (
            <CollapsibleSection
              key={section.id}
              section={section}
              isOpen={openSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              isDark={isDarkMode}
            />
          ))}
        </div>

        {/* ── Footer ── */}
        <div className={`text-center py-6 text-xs ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>
          <p className="font-semibold">
            Grant Writing Quick-Reference Guide • SOLTheory Portal
          </p>
          <p className="mt-1">
            Bookmark this page and return to it whenever you&apos;re preparing an application.
          </p>
        </div>
      </div>
    </div>
  );
}
