# SOLTheory Insight — Pilot Program Context

> **Version:** 1.0.0  
> **Target Date:** Pilot-ready by ~October 7, 2026 (2–3 weeks from Sept 17, 2026)  
> **Audience:** Nonprofit organizations  

---

## 1. Executive Summary

SOLTheory's **Insight** platform is being prepared for a structured **pilot launch** with nonprofit organizations. 

These organizations will use Insight as a comprehensive digital operations environment. **JARVIS** serves as the centerpiece: an executive digital assistant that maintains intricate organization-wide and personal context, operating as the most advanced, knowledgeable, and effective AI assistant these organizations have ever used.

---

## 2. Core Offerings (Pilot-Ready Focus)

The primary value proposition for pilot organizations consists of four unified pillars + core operations:

| Pillar | Component | Pilot Role & Purpose |
|---|---|---|
| **1** | **JARVIS (Agent Manager)** | Executive assistant equipped with active, verified tools: Email (Gmail read/preview/send/trash/labels), Calendar (Google Calendar scheduling/Meet links), CRM (Contact CRUD, books, resolution), Storage (reading & searching Media Library), Conversational Memory, and Web Search. |
| **2** | **AI Brain** | Dual-tier context storage: Personal Assistant Context (individual preferences/workflow) vs. Organization-wide Knowledge Base (SOPs, mission, bylaws, FAQs, donor guidelines). Allows users and admins to train JARVIS directly on their organization. |
| **3** | **General Storage (Media Library)** | Central document and asset vault for nonprofit files. Indexed and accessible by JARVIS to read and reference in conversations and tasks. |
| **4** | **P.A.C.T.** | *Persistent Autonomous Context Tracker* — extracts conversational facts automatically, maintains personal and org-scoped memory, and manages automated memory retention. |
| **5** | **Contacts (CRM)** | Promoted to **main offering** (out of Beta). Full contact management, donor/lead pipeline boards, activity tracking, and natural-language entity resolution for JARVIS. |

---

## 3. Operations Management Tools

In addition to JARVIS and AI Brain, pilot organizations utilize these operational tools:

- **Action Board**: Kanban project management, task assignments, approvals, time logging, and overdue tracking.
- **Timesheets**: Heatmap matrix grid, hourly tracking, service and customer rate calculations, and payroll export.
- **Admin Dashboard**: Dedicated governance console for organization admins to audit and track every user action (real-time audit log) and manage team members, roles, and account statuses.

---

## 4. Secondary & Beta Features (Tagged with Disclaimer Popup)

These tools are functional but are **not** part of the primary pilot offering. They carry a prominent "Beta" label and trigger a popup disclaimer explaining they are active works-in-progress:

- **Business Intelligence**: Visual analytics dashboard (billable revenue, win rates, post activity).
- **Agentic Prospecting**: Federal & Philanthropic Grant Scouts.
- **Gmail UI**: Standalone webmail interface (separate from JARVIS's email tools).
- **Agentic Campaigning**: Multi-platform social campaigns (Instagram, etc.).

---

## 5. Architectural Guardrails & Rules

1. **Frozen Code Compliance**: Never modify the production-frozen files listed in `AGENTS.md` (Instagram 15 files, BI 15 files, CRM 27 files, Gmail UI 2 files).
2. **Security**: Never expose secrets to client code (`NEXT_PUBLIC_` restricted to public IDs only). All API routes must enforce `verifyRequest`, `verifyAdmin`, or `verifyOrgMember`.
3. **Role-Based Access Control (RBAC)**:
   - `oracle`: God-mode (Lucas / soltheory.com).
   - `admin`: Full organization control (user management, settings, audit logs).
   - `user`: Standard operational access (JARVIS, tasks, timesheets, contacts).
   - `read-only`: View-only permissions.
