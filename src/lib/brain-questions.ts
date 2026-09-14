/**
 * @file brain-questions.ts
 * @description Defines the 20 Personal AI Brain questions and 20 Organization AI Brain questions.
 * Also provides a compiler that converts raw answers into a clean markdown briefing for JARVIS context injection.
 */

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export type BrainQuestionType = 'text' | 'textarea' | 'single-select' | 'multi-select';

export interface BrainQuestion {
  /** Unique key used as the answer field name, e.g. "preferred_name" */
  key: string;
  /** Human-readable category header (grouped visually) */
  category: string;
  /** The question prompt displayed to the user */
  label: string;
  /** Subtitle / helper text displayed below the label */
  hint?: string;
  /** Input type */
  type: BrainQuestionType;
  /** For single-select and multi-select: the available options */
  options?: string[];
  /** Placeholder text for text/textarea inputs */
  placeholder?: string;
}

export type BrainProfileAnswers = Record<string, string | string[]>;

export interface BrainProfileData {
  answers: BrainProfileAnswers;
  completedCount: number;
  totalCount: number;
  compiledBriefing: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByEmail?: string;
}

/* ─── Personal AI Brain: 20 Questions ────────────────────────────────────────── */

export const PERSONAL_BRAIN_QUESTIONS: BrainQuestion[] = [
  // ── Identity & Role ──
  {
    key: 'preferred_name',
    category: 'Identity & Role',
    label: 'Preferred Name & Pronouns',
    hint: 'How should JARVIS address you?',
    type: 'text',
    placeholder: 'e.g. Lucas (He/Him)',
  },
  {
    key: 'title_responsibilities',
    category: 'Identity & Role',
    label: 'Current Title & Core Responsibilities',
    hint: 'Your role and what you own day-to-day.',
    type: 'textarea',
    placeholder: 'e.g. Founder & Lead Architect. Responsible for product direction, engineering, and partner growth.',
  },
  {
    key: 'expertise_areas',
    category: 'Identity & Role',
    label: 'Primary Professional Expertise',
    hint: 'Select all areas where you have deep expertise.',
    type: 'multi-select',
    options: [
      'Software Engineering',
      'Executive Leadership',
      'Product Design',
      'Marketing & Growth',
      'Sales & BD',
      'Finance & Accounting',
      'Operations & Logistics',
      'Legal & Compliance',
      'Data & Analytics',
      'Human Resources',
      'Customer Success',
      'Creative & Content',
    ],
  },
  {
    key: 'timezone_hours',
    category: 'Identity & Role',
    label: 'Timezone & Typical Working Hours',
    hint: 'Helps JARVIS schedule and respect your availability.',
    type: 'text',
    placeholder: 'e.g. US Mountain Time (MT). 9:00 AM – 6:00 PM',
  },

  // ── Communication Style ──
  {
    key: 'communication_style',
    category: 'Communication Style',
    label: 'Preferred Direct Communication Style',
    hint: 'How should JARVIS talk to you?',
    type: 'single-select',
    options: [
      'Concise & Direct (bullet points)',
      'Detailed & Thorough',
      'Socratic & Exploratory',
      'Casual & Conversational',
      'Executive Brevity',
    ],
  },
  {
    key: 'email_persona',
    category: 'Communication Style',
    label: 'Email & External Drafting Persona',
    hint: 'The tone JARVIS should use when drafting outbound emails.',
    type: 'single-select',
    options: [
      'Friendly & Professional',
      'Warm & Relationship-Driven',
      'Direct & Action-Oriented',
      'Academic / Highly Technical',
    ],
  },
  {
    key: 'disagreement_handling',
    category: 'Communication Style',
    label: 'How should JARVIS handle disagreement or uncertainty?',
    type: 'single-select',
    options: [
      'Challenge me directly with evidence',
      'Present diplomatic pros & cons',
      'Follow my lead unless there is fatal risk',
      'Always give 2-3 alternatives',
    ],
  },
  {
    key: 'explanation_preference',
    category: 'Communication Style',
    label: 'Explanation & Reasoning Preference',
    hint: 'How should JARVIS structure its responses?',
    type: 'single-select',
    options: [
      'Bottom line first (TL;DR followed by details)',
      'Step-by-step reasoning',
      'Executable code / actions only',
    ],
  },

  // ── Work Habits & Tools ──
  {
    key: 'daily_priorities',
    category: 'Work Habits & Tools',
    label: 'Top 3 Daily Productivity Priorities',
    hint: 'What does a productive day look like for you?',
    type: 'textarea',
    placeholder: 'e.g. 1. Code review & architectural plans.\n2. Client communications.\n3. System monitoring.',
  },
  {
    key: 'software_stack',
    category: 'Work Habits & Tools',
    label: 'Primary Daily Software Stack',
    hint: 'Tools JARVIS should assume you use regularly.',
    type: 'multi-select',
    options: [
      'VS Code',
      'GitHub',
      'Gmail',
      'Google Workspace',
      'Slack',
      'Discord',
      'Linear',
      'Notion',
      'Figma',
      'Supabase',
      'Firebase',
      'Stripe',
      'Jira',
      'Asana',
    ],
  },
  {
    key: 'deliverable_formats',
    category: 'Work Habits & Tools',
    label: 'Preferred Deliverable Formats',
    hint: 'How should JARVIS format its outputs for you?',
    type: 'multi-select',
    options: [
      'Bulleted Action Checklists',
      'Executable Code Blocks',
      'Markdown Comparison Tables',
      'One-Page Executive Memos',
      'Draft Ready-to-Send Emails',
    ],
  },
  {
    key: 'decision_framework',
    category: 'Work Habits & Tools',
    label: 'Decision-Making Framework',
    type: 'single-select',
    options: [
      'Data-driven & metrics first',
      'Fast MVP iteration',
      'Intuition & UX first',
      'Consensus & team collaboration',
    ],
  },

  // ── Goals & Priorities ──
  {
    key: 'milestones_6_12',
    category: 'Goals & Priorities',
    label: 'Key Milestones for the Next 6–12 Months',
    type: 'textarea',
    placeholder: 'e.g. Scale enterprise customer base, achieve 99.9% platform uptime, roll out automated campaign pipelines.',
  },
  {
    key: 'active_projects',
    category: 'Goals & Priorities',
    label: 'Active High-Priority Projects',
    type: 'textarea',
    placeholder: 'e.g. PACT dual-scope memory integration, multi-org permission auditing, automated grant scout pipeline.',
  },
  {
    key: 'bottlenecks',
    category: 'Goals & Priorities',
    label: 'Biggest Operational Bottlenecks or Pain Points',
    type: 'textarea',
    placeholder: 'e.g. Context-switching between admin emails and coding; writing repetitive outbound summaries.',
  },
  {
    key: 'vip_contacts',
    category: 'Goals & Priorities',
    label: 'Key Stakeholders & VIP Contacts to Recognize',
    hint: 'Names and roles of people JARVIS should recognize as important.',
    type: 'textarea',
    placeholder: 'e.g. John Smith (CTO, Partner Org), Jane Doe (Board Advisor).',
  },

  // ── Boundaries & Rules ──
  {
    key: 'confirmation_required',
    category: 'Boundaries & Rules',
    label: 'Tasks to NEVER Run Without Explicit Confirmation',
    type: 'multi-select',
    options: [
      'Sending external emails',
      'Deleting database records',
      'Committing financial contracts',
      'Scheduling calendar events',
      'Social media posting',
      'Modifying user permissions',
    ],
  },
  {
    key: 'proactivity_level',
    category: 'Boundaries & Rules',
    label: 'Assistant Proactivity Level',
    type: 'single-select',
    options: [
      'Reactive (respond only to direct prompts)',
      'Moderately Proactive (suggest relevant next steps)',
      'Highly Proactive (anticipate roadblocks and draft ahead)',
    ],
  },
  {
    key: 'jargon_tone',
    category: 'Boundaries & Rules',
    label: 'Jargon & Tone Guardrails',
    type: 'single-select',
    options: [
      'Plain English (no buzzwords)',
      'Industry standard technical terms',
      'Casual & colloquial allowed',
    ],
  },
  {
    key: 'custom_rules',
    category: 'Boundaries & Rules',
    label: 'Personal Quirks or Custom Rules for JARVIS',
    hint: 'Anything else JARVIS should always remember about how you work.',
    type: 'textarea',
    placeholder: "e.g. Never use generic corporate filler ('I hope this email finds you well'); always cite specific file paths; assume strong technical competence.",
  },
];

/* ─── Organization AI Brain: 20 Questions ────────────────────────────────────── */

export const ORG_BRAIN_QUESTIONS: BrainQuestion[] = [
  // ── Company Identity ──
  {
    key: 'company_name',
    category: 'Company Identity',
    label: 'Legal Company Name, DBA & Brand Name',
    type: 'text',
    placeholder: 'e.g. SOL Theory Inc. (DBA SOL Theory)',
  },
  {
    key: 'mission_statement',
    category: 'Company Identity',
    label: 'One-Sentence Mission Statement / Elevator Pitch',
    type: 'textarea',
    placeholder: 'e.g. SOL Theory empowers organizations with intelligent, agentic AI workflows that multiply team velocity and automate complex operations.',
  },
  {
    key: 'core_values',
    category: 'Company Identity',
    label: 'Core Organizational Values',
    type: 'multi-select',
    options: [
      'Innovation',
      'Speed of Execution',
      'Extreme Ownership',
      'Transparency',
      'Customer Obsession',
      'Simplicity',
      'Quality Craftsmanship',
      'Diversity & Inclusion',
      'Sustainability',
      'Integrity',
    ],
  },
  {
    key: 'industry_vertical',
    category: 'Company Identity',
    label: 'Primary Industry & Vertical',
    type: 'single-select',
    options: [
      'B2B SaaS / Enterprise Software',
      'AI & Automation',
      'Professional Consulting Services',
      'Healthcare & Life Sciences',
      'FinTech',
      'Non-Profit & Grants',
      'E-Commerce & Retail',
      'Education & EdTech',
      'Real Estate & Property',
      'Media & Entertainment',
    ],
  },

  // ── Products & Services ──
  {
    key: 'products_solutions',
    category: 'Products & Services',
    label: 'Core Products & Solutions Offered',
    hint: 'Summarize your product tiers, modules, or service packages.',
    type: 'textarea',
    placeholder: 'e.g. Insight AI Platform (core SaaS), Agentic Campaign Engine, Grant Discovery Scout, CRM & Pipeline tools.',
  },
  {
    key: 'ideal_customer_profile',
    category: 'Products & Services',
    label: 'Ideal Customer Profile (ICP) & Target Audience',
    type: 'textarea',
    placeholder: 'e.g. Growing SMBs, grant-seeking non-profits, and fast-moving tech startups looking for operational automation.',
  },
  {
    key: 'value_proposition',
    category: 'Products & Services',
    label: 'Key Value Proposition & Competitive Differentiator',
    hint: 'Why do customers choose you over alternatives?',
    type: 'textarea',
    placeholder: 'e.g. All-in-one AI command center with personalized memory; no data silos or vendor lock-in.',
  },
  {
    key: 'business_model',
    category: 'Products & Services',
    label: 'Business Model & Pricing Structure',
    type: 'single-select',
    options: [
      'Monthly / Annual SaaS Subscription',
      'Retainer / Advisory Consulting',
      'Fixed-Price Deliverables',
      'Usage-Based / Credits',
      'Performance / Revenue Share',
      'Hybrid',
    ],
  },

  // ── Brand Voice & Messaging ──
  {
    key: 'brand_voice',
    category: 'Brand Voice & Messaging',
    label: 'Official Brand Voice & Tone',
    type: 'single-select',
    options: [
      'Visionary & Authoritative',
      'Approachable & Human',
      'Corporate & Polished',
      'Bold & Edgy',
      'Technical & Rigorous',
    ],
  },
  {
    key: 'terms_prioritize_avoid',
    category: 'Brand Voice & Messaging',
    label: 'Terms to Prioritize vs. Terms to Avoid',
    type: 'textarea',
    placeholder: "e.g. Use: 'partners', 'intelligent workflows', 'agentic'. Avoid: 'cheap', 'vendor', 'outsourcing'.",
  },
  {
    key: 'brand_aesthetics',
    category: 'Brand Voice & Messaging',
    label: 'Brand Colors & Aesthetic Identity',
    type: 'text',
    placeholder: 'e.g. Indigo & Slate tones; modern minimalist aesthetic; dark-mode native.',
  },
  {
    key: 'company_boilerplate',
    category: 'Brand Voice & Messaging',
    label: 'Official Company Boilerplate Summary',
    hint: 'Standard 2-paragraph company description for PR, pitches, and proposals.',
    type: 'textarea',
    placeholder: 'e.g. SOL Theory Inc. is a technology company...',
  },

  // ── Team & Governance ──
  {
    key: 'leadership_team',
    category: 'Team & Governance',
    label: 'Key Leadership & Department Heads',
    hint: 'Names, titles, and areas of ownership.',
    type: 'textarea',
    placeholder: 'e.g. Lucas Huff — Founder & CEO (Product, Engineering)\nJane Doe — VP Operations (Finance, HR)',
  },
  {
    key: 'decision_structure',
    category: 'Team & Governance',
    label: 'Decision-Making & Approval Structure',
    type: 'single-select',
    options: [
      'Founder / Executive Led',
      'Decentralized & Autonomous Teams',
      'Committee / Board Approval',
      'Matrixed Project Leads',
    ],
  },
  {
    key: 'internal_channels',
    category: 'Team & Governance',
    label: 'Primary Internal Communication Channels',
    type: 'multi-select',
    options: [
      'Slack',
      'Discord',
      'Google Meet',
      'Notion',
      'GitHub Discussions',
      'Email',
      'Weekly Standups',
      'Microsoft Teams',
      'Zoom',
    ],
  },
  {
    key: 'org_working_hours',
    category: 'Team & Governance',
    label: 'Organization Working Hours & Core Sync Time',
    type: 'text',
    placeholder: 'e.g. Distributed team across US Mountain and Eastern; core sync 10 AM – 3 PM MT.',
  },

  // ── Tech Stack & Ops ──
  {
    key: 'tech_stack',
    category: 'Tech Stack & Ops',
    label: 'Core Infrastructure & Technology Stack',
    type: 'multi-select',
    options: [
      'Next.js / React',
      'TypeScript',
      'Supabase',
      'Firebase',
      'Tailwind CSS',
      'Google Cloud',
      'AWS',
      'Vercel',
      'Stripe',
      'PostgreSQL',
      'Node.js',
      'Python',
      'Docker',
      'Kubernetes',
    ],
  },
  {
    key: 'compliance_standards',
    category: 'Tech Stack & Ops',
    label: 'Compliance & Security Standards',
    type: 'multi-select',
    options: [
      'SOC 2',
      'HIPAA',
      'GDPR',
      'CCPA',
      'Strict NDA / Confidentiality',
      'Standard Commercial',
      'FedRAMP',
      'PCI DSS',
    ],
  },
  {
    key: 'escalation_protocol',
    category: 'Tech Stack & Ops',
    label: 'Standard Escalation Protocol for Urgent Issues',
    hint: 'Who to alert for outages, security flags, or critical client escalations.',
    type: 'textarea',
    placeholder: 'e.g. P0: Page Lucas immediately via Slack + SMS. P1: Post in #incidents channel. P2: Standard support queue.',
  },
  {
    key: 'off_limits_topics',
    category: 'Tech Stack & Ops',
    label: 'Confidential / Off-Limits Topics for AI',
    hint: 'Information JARVIS must never reveal or quote externally.',
    type: 'textarea',
    placeholder: 'e.g. Internal cap table, unreleased pricing models, proprietary trade secrets, specific revenue figures.',
  },
];

/* ─── Briefing Compiler ──────────────────────────────────────────────────────── */

/**
 * Compiles the raw question-answer pairs into a clean, structured markdown briefing
 * that can be injected directly into JARVIS's system prompt.
 *
 * @param scope - 'personal' or 'org'
 * @param questions - The question definitions (PERSONAL_BRAIN_QUESTIONS or ORG_BRAIN_QUESTIONS)
 * @param answers - The user's answers keyed by question key
 * @param entityName - The user's display name or the organization name
 */
export function compileBrainProfileToText(
  scope: 'personal' | 'org',
  questions: BrainQuestion[],
  answers: BrainProfileAnswers,
  entityName: string
): string {
  const header = scope === 'personal'
    ? `# Personal AI Brain Profile: ${entityName}`
    : `# Organization Brain Profile: ${entityName}`;

  const lines: string[] = [header, ''];

  // Group questions by category
  const categories = new Map<string, BrainQuestion[]>();
  for (const q of questions) {
    if (!categories.has(q.category)) {
      categories.set(q.category, []);
    }
    categories.get(q.category)!.push(q);
  }

  for (const [category, qs] of categories) {
    const categoryAnswered = qs.some(q => {
      const val = answers[q.key];
      return val && (Array.isArray(val) ? val.length > 0 : val.trim().length > 0);
    });
    if (!categoryAnswered) continue;

    lines.push(`## ${category}`);

    for (const q of qs) {
      const val = answers[q.key];
      if (!val) continue;

      const displayVal = Array.isArray(val) ? val.join(', ') : val.trim();
      if (!displayVal) continue;

      lines.push(`- **${q.label}**: ${displayVal}`);
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Counts how many questions have been answered.
 */
export function countAnswered(questions: BrainQuestion[], answers: BrainProfileAnswers): number {
  let count = 0;
  for (const q of questions) {
    const val = answers[q.key];
    if (val && (Array.isArray(val) ? val.length > 0 : typeof val === 'string' && val.trim().length > 0)) {
      count++;
    }
  }
  return count;
}

/**
 * Returns unique category names in the order they appear in the questions array.
 */
export function getCategories(questions: BrainQuestion[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const q of questions) {
    if (!seen.has(q.category)) {
      seen.add(q.category);
      result.push(q.category);
    }
  }
  return result;
}
