/**
 * jarvis-knowledge-base.ts — Static Knowledge Base for Jarvis AI
 * 
 * This module provides a comprehensive text description of the Insight dashboard
 * that gets injected into Jarvis's system prompt when answering user questions
 * via the Ctrl+K omnibar. This allows Jarvis to answer platform-related questions
 * like "How do I create an action board item?" without needing a vector DB or RAG.
 */

export const JARVIS_KNOWLEDGE_BASE = `
## Insight Dashboard — Platform Knowledge Base

You have access to the following knowledge about the Insight dashboard platform. Use it to answer user questions about features, navigation, and how things work.

### Navigation & Keyboard Shortcuts
- **Ctrl+K (or ⌘K on Mac):** Opens the AI search bar (this omnibar). You can search for pages, run quick commands, or ask Jarvis questions.
- **Sidebar:** The left sidebar has two sections — "Menu" (core tools) and "Flagship Tools" (productivity apps). Hover to expand, or pin it open with the pin icon.
- **Quick Commands:** From this search bar, you can use "Summarize my tasks", "What's on my calendar?", or "Search my inbox" for instant summaries.

### Homepage
- The dashboard homepage shows a personalized overview of your organization.
- It includes quick links to recent pages, activity feed, and key metrics.

### Agent Manager (Jarvis)
- Located under Menu → Agent Manager.
- This is where you chat with AI agents. Jarvis is the default assistant.
- You can select different AI models (GPT, Claude, Gemini, Nemotron, Qwen).
- Agents have a "Soul" (personality/instructions) and a "Brain" (knowledge context).
- You can create custom agents with specialized instructions for different tasks.

### AI Knowledge Base
- Located under Menu → AI Knowledge Base.
- Upload documents, text, and files to give your AI agents context about your business.
- Supports PDF, DOCX, TXT, and other document formats.
- Documents are chunked and embedded for RAG (retrieval-augmented generation).

### Insight Walkthroughs
- Located under Menu → Insight Walkthroughs.
- Interactive tutorials that guide you through different features of the platform.
- Great for onboarding new team members.

### CRM (Customer Relationship Management)
- Located under Flagship Tools → CRM.
- Manage contacts, companies, and deals in a pipeline view.
- **Adding a contact:** Click the "+ Add Contact" button. Fill in name, email, phone, company, and other fields.
- **Pipeline stages:** Contacts move through stages like Lead, Qualified, Proposal, Negotiation, Won, Lost.
- **Filtering:** Use the search bar and filters to find specific contacts by name, email, company, or status.
- **Bulk actions:** Select multiple contacts for bulk email, status changes, or exports.
- **Custom fields:** Add custom fields to track information specific to your business.

### Email (Gmail Integration)
- Located under Flagship Tools → Email.
- Connect your Gmail account to send and receive emails directly from Insight.
- **Composing:** Click "Compose" to write a new email. You can use AI to help draft emails.
- **Templates:** Save and reuse email templates.
- **Tracking:** See when emails are opened and links are clicked.

### Business Intelligence
- Located under Flagship Tools → Business Intelligence.
- View analytics, reports, and data visualizations about your business.
- Includes charts, graphs, and customizable dashboards.

### Action Board
- Located under Flagship Tools → Action Board.
- A Kanban-style task management board.
- **Creating a task:** Click "+ Add Task" in any column (To Do, Doing, Done).
- **Task details:** Each task has a title, description, priority (Low/Medium/High), due date, and assignee.
- **Moving tasks:** Drag and drop tasks between columns, or click to change status.
- **Filtering:** Filter by assignee, priority, or due date.
- **Archiving:** Archive completed tasks to keep the board clean.
- **Overdue tasks:** Tasks past their due date are marked as overdue with visual indicators.

### Timesheets
- Located under Flagship Tools → Timesheets.
- Track time spent on projects and tasks.
- Log hours, add descriptions, and categorize by project.
- Export timesheets for billing or reporting.

### Media Library
- Located under Flagship Tools → Media Library.
- Upload, organize, and manage files and media assets.
- **Uploading:** Click "Upload" or drag and drop files.
- **Folders:** Create folders to organize files.
- **File types:** Supports images, videos, documents, and other file types.
- **Shared with Me:** View files shared by other team members.
- **Trash:** Deleted files go to trash and can be recovered.
- **Storage:** Shows how much storage you've used vs. your quota.

### Agentic Campaigning (Instagram)
- Located under Flagship Tools → Agentic Campaigning.
- AI-powered social media campaign management for Instagram.
- Create, schedule, and publish Instagram posts with AI-generated captions.
- Connect your Instagram Business account to get started.

### Agentic Prospecting
- Located under Flagship Tools → Agentic Prospecting.
- AI-powered lead generation and prospecting tool.
- Search for grants, funding opportunities, and business leads.
- AI helps identify and qualify potential prospects.

### Google Calendar
- Access your Google Calendar events.
- View, create, and manage calendar events.
- Requires Google account connection in Settings → Integrations.

### YouTube Creator
- Tools for YouTube content creation and management.
- Manage your YouTube channel directly from Insight.

### Google Docs, Sheets, Slides, Drive
- Access your Google Workspace files (Docs, Sheets, Slides, Drive) directly from the dashboard.
- Edit and collaborate on documents without leaving Insight.

### Direct Messages & Org Thread
- Located under Menu → Messages.
- **Direct Messages (DM):** Private conversations between team members.
- **Org Thread:** Organization-wide communication channel where all members can post and discuss.

### Settings
- Located at the bottom of the sidebar (gear icon).
- **General:** Organization settings, branding, and preferences.
- **Profile:** Update your name, avatar, and personal information.
- **Integrations:** Connect Google, Gmail, Instagram, and other services.
- **Team:** Manage team members, roles, and permissions.
- **Billing:** View subscription status and manage billing.

### Tips
- Use Ctrl+K to quickly navigate anywhere in the dashboard.
- Pin the sidebar for persistent navigation, or let it auto-collapse to save screen space.
- Ask Jarvis anything — from summarizing tasks to drafting emails to answering questions about the platform.
`.trim();
