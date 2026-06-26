"use client";

import React, { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import {
  LayoutDashboard,
  Plus,
  X,
  GripVertical,
  Trash2,
  ChevronDown,
  CheckCircle2,
  Clock,
  Circle,
  MoreHorizontal,
  ArrowRight,
  Inbox,
  Check,
  XCircle,
  Users,
  User as UserIcon,
  Filter,
  Archive,
  Search,
  Shield,
  AlertTriangle,
  CalendarDays,
  Sparkles,
  Timer,
  Zap,
  Mail,
  ChevronRight,
  Edit2,
  MessageCircle,
  ArchiveRestore,
  Send,
  Paperclip,
  ImageIcon,
  FileUp,
  Eye,
  FileText,
} from "lucide-react";
import { logActivity } from '@/lib/activity-logger';
import { useTranslation } from '@/lib/i18n';

// â”€â”€ Types â”€â”€
type Priority = "High" | "Medium" | "Low";
type ColumnId = "todo" | "doing" | "done";
type AssignmentStatus = "direct" | "pending_approval" | "accepted" | "denied";
type ViewFilter = "my_tasks" | "specific_user" | "all_users";
type LifecycleStatus = "new" | "in_progress" | "on_time" | "late";

interface TaskComment {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  authorEmail: string;
  createdAt: Timestamp | null;
}

interface ActionBoardTask {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  priority: Priority;
  column: ColumnId;
  createdBy: string;
  createdByEmail: string;
  createdByName?: string;
  assignedTo: string;
  assignedToEmail: string;
  assignedToName?: string;
  assignmentStatus: AssignmentStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  deniedAt?: Timestamp | null;
  // Lifecycle fields
  startDate?: Timestamp | null;
  dueDate?: Timestamp | null;
  completedAt?: Timestamp | null;
  isLate?: boolean;
  lateNotifiedAt?: Timestamp | null;
  // Automations
  automations?: TaskAutomations;
  // Archive
  isArchived?: boolean;
  // Comments
  comments?: TaskComment[];
  attachments?: { url: string; name: string; type: string; size: number }[];
}

type EmailTrigger = "assigned" | "in_progress" | "completed" | "overdue";

interface TaskAutomations {
  emails?: string[];
  emailTriggers?: EmailTrigger[];
  slackWebhook?: string;
  googleAction?: string;
}

interface OrgMember {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
}

interface ColumnDef {
  id: ColumnId;
  label: string;
  headerBg: string;
  accentPill: string;
  icon: React.ReactNode;
  dropBg: string;
  dropBorder: string;
}

// ── Constants ──
// COLUMNS is now generated inside the component to support i18n and dark mode

const PRIORITY_STYLES: Record<Priority, string> = {
  High: "bg-red-50 text-red-600 border border-red-200",
  Medium: "bg-amber-50 text-amber-600 border border-amber-200",
  Low: "bg-blue-50 text-blue-600 border border-blue-200",
};

const LIFECYCLE_BADGE: Record<LifecycleStatus, { label: string; style: string; icon: React.ReactNode }> = {
  new: { label: "New", style: "bg-blue-50 text-blue-600 border-blue-200", icon: <Sparkles className="w-3 h-3" /> },
  in_progress: { label: "In Progress", style: "bg-amber-50 text-amber-600 border-amber-200", icon: <Timer className="w-3 h-3" /> },
  on_time: { label: "Completed", style: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  late: { label: "Late", style: "bg-red-50 text-red-600 border-red-200", icon: <AlertTriangle className="w-3 h-3" /> },
};

const ADMIN_EMAILS = ["lucas@soltheory.com", "steve@soltheory.com", "gerard@soltheory.com"];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEADLINE_CHECK_INTERVAL = 60_000; // Check every 60 seconds

// â”€â”€ Helper: compute lifecycle status â”€â”€
function getLifecycleStatus(task: ActionBoardTask): LifecycleStatus {
  const now = Date.now();

  // Done column = completed
  if (task.column === "done") {
    // Check if it was completed late
    if (task.isLate) return "late";
    return "on_time";
  }

  // Check if past due
  if (task.dueDate) {
    const dueMs = task.dueDate.toMillis();
    if (now > dueMs) return "late";
  }

  // Currently being worked on
  if (task.column === "doing") return "in_progress";

  // Default: new/to-do
  return "new";
}

function fromDatetimeLocal(val: string): Date | null {
  if (!val) return null;
  return new Date(val);
}

function toDatetimeLocalString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

// â”€â”€ Helper: days until/since due â”€â”€
function getDueDelta(dueDate: Timestamp | null | undefined): { label: string; isOverdue: boolean; daysLeft: number } | null {
  if (!dueDate) return null;
  const now = Date.now();
  const dueMs = dueDate.toMillis();
  const diff = dueMs - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return { label: `${Math.abs(days)}d overdue`, isOverdue: true, daysLeft: days };
  if (days === 0) return { label: "Due today", isOverdue: false, daysLeft: 0 };
  if (days === 1) return { label: "Due tomorrow", isOverdue: false, daysLeft: 1 };
  return { label: `${days}d left`, isOverdue: false, daysLeft: days };
}

/* ── Confetti for completing a task ── */
function ActionBoardConfetti({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = [
      "#6366f1", "#f43f5e", "#22c55e", "#eab308", "#3b82f6",
      "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4",
    ];

    interface Particle {
      x: number; y: number; w: number; h: number;
      vx: number; vy: number; rot: number; vr: number;
      color: string; opacity: number;
    }

    const particles: Particle[] = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width * 0.5 + (Math.random() - 0.5) * canvas.width * 0.6,
        y: canvas.height * 0.3 + (Math.random() - 0.5) * 120,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 14,
        vy: -6 - Math.random() * 10,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: 1,
      });
    }

    let frame = 0;
    const maxFrames = 150;

    const animate = () => {
      if (frame >= maxFrames) { onDone(); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.vy += 0.25;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.opacity = Math.max(0, 1 - frame / maxFrames);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      frame++;
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}


export default function ActionBoardPage() {
  return (
    <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /></div>}>
      <ActionBoardContent />
    </Suspense>
  );
}

function ActionBoardContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  // ── Dark Mode ──
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const check = () => setIsDarkMode(localStorage.getItem('insight_theme') === 'dark');
    check();
    const interval = setInterval(check, 500);
    window.addEventListener('storage', check);
    return () => { clearInterval(interval); window.removeEventListener('storage', check); };
  }, []);

  // ── Dynamic Column Definitions (supports i18n + dark mode) ──
  const COLUMNS: ColumnDef[] = [
    {
      id: "todo",
      label: t.abToDo,
      headerBg: isDarkMode ? "bg-slate-700" : "bg-slate-100",
      accentPill: isDarkMode ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-700",
      icon: <Circle className="w-3.5 h-3.5" />,
      dropBg: isDarkMode ? "bg-blue-900/20" : "bg-blue-50/50",
      dropBorder: "border-blue-300",
    },
    {
      id: "doing",
      label: t.abDoing,
      headerBg: isDarkMode ? "bg-slate-700" : "bg-amber-50",
      accentPill: isDarkMode ? "bg-amber-900/50 text-amber-300" : "bg-amber-100 text-amber-700",
      icon: <Clock className="w-3.5 h-3.5" />,
      dropBg: isDarkMode ? "bg-amber-900/20" : "bg-amber-50/50",
      dropBorder: "border-amber-300",
    },
    {
      id: "done",
      label: t.abDone,
      headerBg: isDarkMode ? "bg-slate-700" : "bg-emerald-50",
      accentPill: isDarkMode ? "bg-emerald-900/50 text-emerald-300" : "bg-emerald-100 text-emerald-700",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      dropBg: isDarkMode ? "bg-emerald-900/20" : "bg-emerald-50/50",
      dropBorder: "border-emerald-300",
    },
  ];

  // Derive org from URL path – /portal/dashboard/nxtchapter/... vs /portal/dashboard/soltheory/...
  const ORG_ID = pathname.includes('/nxtchapter') ? 'nxtchapter' : 'soltheory';

  // Highlight task from "Needs your attention" widget
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  useEffect(() => {
    const hId = searchParams.get('highlight');
    if (hId) {
      setHighlightedTaskId(hId);
      // Scroll to it after a brief delay for DOM to render
      setTimeout(() => {
        const el = document.getElementById(`task-card-${hId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      // Remove highlight after 2.5 seconds
      const timer = setTimeout(() => setHighlightedTaskId(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // ––– Core State –––
  const [tasks, setTasks] = useState<ActionBoardTask[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("member");
  const [isLoading, setIsLoading] = useState(true);

  // â”€â”€ UI State â”€â”€
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);
  const [archiveFilterUser, setArchiveFilterUser] = useState<string>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [restoreDropdownId, setRestoreDropdownId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const draggedTaskRef = useRef<string | null>(null);

  // â”€â”€ Filter State (Admin) â”€â”€
  const [viewFilter, setViewFilter] = useState<ViewFilter>("my_tasks");
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // â”€â”€ Form State â”€â”€
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("Medium");
  const [newColumn, setNewColumn] = useState<ColumnId>("todo");
  const [newAssignee, setNewAssignee] = useState<string>("self");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  // Automations form
  const [autoEmailChips, setAutoEmailChips] = useState<string[]>([]);
  const [autoEmailInput, setAutoEmailInput] = useState("");
  const [autoEmailTriggers, setAutoEmailTriggers] = useState<EmailTrigger[]>([]);
  const [isAutomationsOpen, setIsAutomationsOpen] = useState(false);
  // Comments state
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  // Attachments state
  const [pendingAttachments, setPendingAttachments] = useState<{file: File; preview?: string}[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // —— Derived ——
  const isAdmin = currentUserRole === "admin" || ADMIN_EMAILS.includes(user?.email || "");

  // Ref for deadline monitor to avoid re-running effect on every task change
  const tasksRef = useRef<ActionBoardTask[]>([]);
  tasksRef.current = tasks;
  const lateProcessedRef = useRef<Set<string>>(new Set());
  const fireAutomationsRef = useRef<(task: ActionBoardTask, trigger: EmailTrigger) => Promise<void>>(null!);

  // ── Fetch current user role ──
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const fetchRole = async () => {
      try {
        const userDoc = await getDoc(doc(firestore, "users", user.uid));
        const data = userDoc.data();
        setCurrentUserRole(data?.role || "member");
      } catch { setCurrentUserRole("member"); }
    };
    fetchRole();
  }, [firestore, user?.uid]);

  // ——— Fetch org members for assignee picker ———
  useEffect(() => {
    if (!firestore) return;
    const fetchMembers = async () => {
      try {
        const usersSnap = await getDocs(collection(firestore, "users"));
        const members: OrgMember[] = [];
        usersSnap.docs.forEach(d => {
          const data = d.data();
          const email = data.email || data.profile?.email || "";
          if (email) {
            // Only include users who belong to this org, or cross-org admins
            const userOrg = data.organization || "";
            const isSameOrg = userOrg === ORG_ID;
            const isCrossOrgAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
            if (isSameOrg || isCrossOrgAdmin) {
              members.push({
                uid: d.id,
                email,
                displayName: data.displayName || data.profile?.displayName || data.name || "",
                photoURL: data.photoURL || data.profile?.photoURL || "",
                role: data.role || "member",
              });
            }
          }
        });
        setOrgMembers(members);
      } catch (err) {
        console.warn("[ActionBoard] Failed to fetch org members:", err);
      }
    };
    fetchMembers();
  }, [firestore, ORG_ID]);

  // â”€â”€ Real-time task listener â”€â”€
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    setIsLoading(true);
    const tasksRef = collection(firestore, "action_board_tasks");
    const q = query(tasksRef, where("orgId", "==", ORG_ID));

    const unsub = onSnapshot(q, (snap) => {
      const allTasks: ActionBoardTask[] = [];
      const nowMs = Date.now();

      snap.docs.forEach(d => {
        const data = d.data();
        const task: ActionBoardTask = {
          id: d.id,
          orgId: data.orgId,
          title: data.title,
          description: data.description,
          priority: data.priority,
          column: data.column,
          createdBy: data.createdBy,
          createdByEmail: data.createdByEmail,
          createdByName: data.createdByName,
          assignedTo: data.assignedTo,
          assignedToEmail: data.assignedToEmail,
          assignedToName: data.assignedToName,
          assignmentStatus: data.assignmentStatus,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          deniedAt: data.deniedAt,
          startDate: data.startDate || null,
          dueDate: data.dueDate || null,
          completedAt: data.completedAt || null,
          isLate: data.isLate || false,
          lateNotifiedAt: data.lateNotifiedAt || null,
          automations: data.automations || undefined,
          isArchived: data.isArchived || false,
          comments: data.comments || [],
        };

        // Auto-delete denied tasks older than 30 days
        if (task.assignmentStatus === "denied" && task.deniedAt) {
          const deniedMs = task.deniedAt.toMillis();
          if (nowMs - deniedMs > THIRTY_DAYS_MS) {
            deleteDoc(doc(firestore, "action_board_tasks", d.id)).catch(() => {});
            return;
          }
        }

        allTasks.push(task);
      });

      setTasks(allTasks);
      setIsLoading(false);
    }, (err) => {
      console.error("[ActionBoard] Listener error:", err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [firestore, user?.uid, ORG_ID]);

  // â”€â”€ Background deadline monitor â”€â”€
  // Checks every minute for tasks that have passed their due date and flags them
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const checkDeadlines = async () => {
      const nowMs = Date.now();
      const currentTasks = tasksRef.current;

      for (const task of currentTasks) {
        // Skip if already processed in this session
        if (lateProcessedRef.current.has(task.id)) continue;

        // Only check non-done tasks with a due date that aren't already flagged
        if (
          task.column !== "done" &&
          task.dueDate &&
          !task.isLate &&
          task.assignmentStatus !== "denied" &&
          task.assignmentStatus !== "pending_approval"
        ) {
          try {
            const dueMs = task.dueDate.toMillis();
            if (nowMs > dueMs) {
              // Mark as processed BEFORE the write to prevent duplicates
              lateProcessedRef.current.add(task.id);
              await updateDoc(doc(firestore, "action_board_tasks", task.id), {
                isLate: true,
                lateNotifiedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              console.log(`[ActionBoard] Task "${task.title}" marked as LATE`);
              // Fire overdue automations
              if (fireAutomationsRef.current) fireAutomationsRef.current({ ...task, isLate: true }, "overdue");
            }
          } catch (err) {
            // Remove from processed set so it can be retried
            lateProcessedRef.current.delete(task.id);
            console.warn("[ActionBoard] Failed to mark task late:", err);
          }
        }
      }
    };

    // Initial check + recurring interval
    const timeout = setTimeout(checkDeadlines, 2000); // Small delay to let tasks load
    const interval = setInterval(checkDeadlines, DEADLINE_CHECK_INTERVAL);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [firestore, user?.uid]);

  // â”€â”€ Task filtering logic â”€â”€
  const getVisibleBoardTasks = useCallback((): ActionBoardTask[] => {
    if (!user?.uid) return [];
    const boardStatuses: AssignmentStatus[] = ["direct", "accepted"];
    let filtered = tasks.filter(t => boardStatuses.includes(t.assignmentStatus) && !t.isArchived);

    if (viewFilter === "my_tasks") {
      filtered = filtered.filter(t => t.assignedTo === user.uid || t.createdBy === user.uid);
    } else if (viewFilter === "specific_user" && filterUserId) {
      filtered = filtered.filter(t => t.assignedTo === filterUserId || t.createdBy === filterUserId);
    }
    return filtered;
  }, [tasks, user?.uid, viewFilter, filterUserId]);

  const pendingTasks = tasks.filter(
    t => t.assignedTo === user?.uid && t.assignmentStatus === "pending_approval"
  );

  const deniedTasks = tasks.filter(
    t => t.assignmentStatus === "denied" && (t.createdBy === user?.uid || t.assignedTo === user?.uid)
  );

  const allArchivedTasks = tasks.filter(
    t => t.isArchived === true && (t.createdBy === user?.uid || t.assignedTo === user?.uid || isAdmin)
  );

  // Apply archive user filter (admin only)
  const archivedTasks = isAdmin && archiveFilterUser !== "all"
    ? allArchivedTasks.filter(t => t.assignedTo === archiveFilterUser || t.createdBy === archiveFilterUser)
    : allArchivedTasks;

  // Late task count for notification
  const lateTasks = tasks.filter(t => {
    if (t.column === "done" || t.assignmentStatus === "denied") return false;
    if (!t.dueDate) return false;
    return t.dueDate.toMillis() < Date.now() && (t.assignedTo === user?.uid || t.createdBy === user?.uid);
  });

  // ── File Attachment Handlers ──
  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).filter(f => f.size <= 10 * 1024 * 1024); // 10MB limit
    const previews = newFiles.map(f => ({
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
    }));
    setPendingAttachments(prev => [...prev, ...previews]);
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadAttachments = async (taskId: string): Promise<{url: string; name: string; type: string; size: number}[]> => {
    if (!storage || pendingAttachments.length === 0) return [];
    setUploadingFiles(true);
    try {
      const uploads = await Promise.all(
        pendingAttachments.map(async ({ file }) => {
          const path = `action_board_attachments/${user!.uid}/${taskId}/${Date.now()}_${file.name}`;
          const sRef = storageRef(storage, path);
          await uploadBytes(sRef, file);
          const url = await getDownloadURL(sRef);
          return { url, name: file.name, type: file.type, size: file.size };
        })
      );
      return uploads;
    } finally {
      setUploadingFiles(false);
      setPendingAttachments([]);
    }
  };

  // â”€â”€ Handlers â”€â”€
  const addTask = async () => {
    if (!newTitle.trim() || !user?.uid || !firestore) return;

    const assigneeUid = newAssignee === "self" ? user.uid : newAssignee;
    const assigneeMember = orgMembers.find(m => m.uid === assigneeUid);
    const isSelfAssign = assigneeUid === user.uid;

    let status: AssignmentStatus;
    if (isSelfAssign) status = "direct";
    else if (isAdmin) status = "direct";
    else status = "pending_approval";

    const startDateObj = fromDatetimeLocal(newStartDate);
    const dueDateObj = fromDatetimeLocal(newDueDate);

    const automationsData = buildAutomations();

    const taskData: Record<string, any> = {
      orgId: ORG_ID,
      title: newTitle.trim(),
      description: newDesc.trim() || "",
      priority: newPriority,
      column: status === "direct" ? newColumn : "todo",
      createdBy: user.uid,
      createdByEmail: user.email || "",
      createdByName: user.displayName || "",
      assignedTo: assigneeUid,
      assignedToEmail: isSelfAssign ? (user.email || "") : (assigneeMember?.email || ""),
      assignedToName: isSelfAssign ? (user.displayName || "") : (assigneeMember?.displayName || ""),
      assignmentStatus: status,
      startDate: startDateObj ? Timestamp.fromDate(startDateObj) : null,
      dueDate: dueDateObj ? Timestamp.fromDate(dueDateObj) : null,
      completedAt: null,
      isLate: false,
      lateNotifiedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Only include automations field if it has data (avoid null/undefined in Firestore)
    if (automationsData) {
      taskData.automations = automationsData;
    }

    try {
      console.log("[ActionBoard] Creating task:", taskData);
      const docRef = await addDoc(collection(firestore, "action_board_tasks"), taskData);
      console.log("[ActionBoard] Task created with ID:", docRef.id);
      // Upload attachments if any
      if (pendingAttachments.length > 0) {
        const attachments = await uploadAttachments(docRef.id);
        if (attachments.length > 0) {
          await updateDoc(doc(firestore, "action_board_tasks", docRef.id), { attachments });
        }
      }
      logActivity(firestore, 'action_board_created', { email: user?.email || '', displayName: user?.displayName }, `Task: ${taskData.title}`);
      // Fire "assigned" trigger for new tasks
      if (automationsData) {
        fireAutomations({
          ...taskData,
          id: docRef.id,
          automations: automationsData,
          createdAt: null,
          updatedAt: null,
        } as ActionBoardTask, "assigned");
      }
    } catch (err: any) {
      console.error("[ActionBoard] Failed to create task:", err);
      alert(`Failed to create task: ${err.message || err}`);
    }

    setNewTitle(""); setNewDesc(""); setNewPriority("Medium"); setNewColumn("todo");
    setNewAssignee("self"); setAssigneeSearch(""); setNewStartDate(""); setNewDueDate("");
    setAutoEmailChips([]); setAutoEmailInput(""); setAutoEmailTriggers([]); setIsAutomationsOpen(false);
    setIsCommentsOpen(false); setCommentInput("");
    setPendingAttachments([]);
    setIsModalOpen(false);
  };

  const openNewTaskModal = () => {
    setEditingTaskId(null);
    setNewTitle(""); setNewDesc(""); setNewPriority("Medium"); setNewColumn("todo");
    setNewAssignee("self"); setAssigneeSearch(""); setNewStartDate(""); setNewDueDate("");
    setAutoEmailChips([]); setAutoEmailInput(""); setAutoEmailTriggers([]);
    setIsAutomationsOpen(false);
    setIsCommentsOpen(false); setCommentInput("");
    setIsModalOpen(true);
  };

  const openNewTaskModalInColumn = (columnId: ColumnId) => {
    openNewTaskModal();
    setNewColumn(columnId);
  };

  const openEditTaskModal = (task: ActionBoardTask) => {
    setEditingTaskId(task.id);
    setNewTitle(task.title);
    setNewDesc(task.description || "");
    setNewPriority(task.priority);
    setNewColumn(task.column);
    setNewAssignee(task.assignedTo === user?.uid ? "self" : task.assignedTo);
    setAssigneeSearch("");
    setNewStartDate(task.startDate ? toDatetimeLocalString(task.startDate.toDate()) : "");
    setNewDueDate(task.dueDate ? toDatetimeLocalString(task.dueDate.toDate()) : "");

    const auto = task.automations || {};
    setAutoEmailChips(auto.emails || []);
    setAutoEmailInput("");
    setAutoEmailTriggers(auto.emailTriggers || []);
    setIsAutomationsOpen(!!(auto.emails && auto.emails.length > 0));
    setIsCommentsOpen(false);
    setCommentInput("");

    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTaskId(null);
    setNewTitle(""); setNewDesc(""); setNewPriority("Medium"); setNewColumn("todo");
    setNewAssignee("self"); setAssigneeSearch(""); setNewStartDate(""); setNewDueDate("");
    setAutoEmailChips([]); setAutoEmailInput(""); setAutoEmailTriggers([]);
    setIsAutomationsOpen(false);
    setIsCommentsOpen(false); setCommentInput("");
    setPendingAttachments([]);
  };

  const saveTask = async () => {
    if (!newTitle.trim() || !user?.uid || !firestore || !editingTaskId) return;

    const assigneeUid = newAssignee === "self" ? user.uid : newAssignee;
    const assigneeMember = orgMembers.find(m => m.uid === assigneeUid);
    const isSelfAssign = assigneeUid === user.uid;

    const task = tasks.find(t => t.id === editingTaskId);
    const isAssigneeChanged = task ? task.assignedTo !== assigneeUid : true;

    let status = task ? task.assignmentStatus : "direct";
    if (isAssigneeChanged) {
      if (isSelfAssign) status = "direct";
      else if (isAdmin) status = "direct";
      else status = "pending_approval";
    }

    const startDateObj = fromDatetimeLocal(newStartDate);
    const dueDateObj = fromDatetimeLocal(newDueDate);

    const automationsData = buildAutomations();

    const taskData: Record<string, any> = {
      title: newTitle.trim(),
      description: newDesc.trim() || "",
      priority: newPriority,
      column: newColumn,
      assignedTo: assigneeUid,
      assignedToEmail: isSelfAssign ? (user.email || "") : (assigneeMember?.email || ""),
      assignedToName: isSelfAssign ? (user.displayName || "") : (assigneeMember?.displayName || ""),
      assignmentStatus: status,
      startDate: startDateObj ? Timestamp.fromDate(startDateObj) : null,
      dueDate: dueDateObj ? Timestamp.fromDate(dueDateObj) : null,
      updatedAt: serverTimestamp(),
    };

    if (newColumn === "done") {
      if (task?.column !== "done") {
        taskData.completedAt = serverTimestamp();
        if (dueDateObj && Date.now() <= dueDateObj.getTime()) {
          taskData.isLate = false;
        }
      }
    } else {
      if (task?.column === "done") {
        taskData.completedAt = null;
      }
    }

    if (automationsData) {
      taskData.automations = automationsData;
    } else {
      taskData.automations = null;
    }

    try {
      console.log("[ActionBoard] Updating task:", editingTaskId, taskData);
      await updateDoc(doc(firestore, "action_board_tasks", editingTaskId), taskData);
      // Upload new attachments if any
      if (pendingAttachments.length > 0) {
        const newAttachments = await uploadAttachments(editingTaskId);
        const existingAttachments = tasks.find(t => t.id === editingTaskId)?.attachments || [];
        await updateDoc(doc(firestore, "action_board_tasks", editingTaskId), { attachments: [...existingAttachments, ...newAttachments] });
      }
      console.log("[ActionBoard] Task updated successfully");
      logActivity(firestore, 'action_board_updated', { email: user?.email || '', displayName: user?.displayName }, `Updated task: ${newTitle.trim()}`);

      if (newColumn === "done" && task && task.column !== "done") {
        fireAutomations({
          ...task,
          ...taskData,
          column: "done",
          completedAt: Timestamp.now(),
          startDate: startDateObj ? Timestamp.fromDate(startDateObj) : null,
          dueDate: dueDateObj ? Timestamp.fromDate(dueDateObj) : null,
        } as ActionBoardTask, "completed");
        setShowConfetti(true);
      }
      if (newColumn === "doing" && task && task.column !== "doing") {
        fireAutomations({
          ...task,
          ...taskData,
          column: "doing",
        } as ActionBoardTask, "in_progress");
      }
      if (newColumn === "todo" && task && task.column !== "todo") {
        fireAutomations({
          ...task,
          ...taskData,
          column: "todo",
        } as ActionBoardTask, "assigned");
      }
      // If automations were UPDATED on a task that's already in a trigger column
      // (e.g., task is already Done and user adds new email recipients),
      // re-fire the automation so the new recipients get notified
      if (automationsData && task && newColumn === task.column) {
        const prevEmails = task.automations?.emails || [];
        const newEmails = automationsData.emails || [];
        const prevTriggers = task.automations?.emailTriggers || [];
        const newTriggers = automationsData.emailTriggers || [];
        const emailsChanged = JSON.stringify(prevEmails.sort()) !== JSON.stringify(newEmails.sort());
        const triggersChanged = JSON.stringify(prevTriggers.sort()) !== JSON.stringify(newTriggers.sort());
        if ((emailsChanged || triggersChanged) && newEmails.length > 0) {
          const triggerForColumn: Record<string, EmailTrigger> = { done: "completed", doing: "in_progress", todo: "assigned" };
          const currentTrigger = triggerForColumn[newColumn];
          if (currentTrigger && (newTriggers.length === 0 || newTriggers.includes(currentTrigger))) {
            console.log(`[ActionBoard] Automations changed on task in "${newColumn}" - re-firing ${currentTrigger} trigger`);
            fireAutomations({
              ...task,
              ...taskData,
              automations: automationsData,
            } as ActionBoardTask, currentTrigger);
          }
        }
      }
    } catch (err: any) {
      console.error("[ActionBoard] Failed to update task:", err);
      alert(`Failed to update task: ${err.message || err}`);
    }

    handleCloseModal();
  };

  const deleteTask = async (id: string) => {
    if (!firestore) return;
    const task = tasks.find(t => t.id === id);
    try {
      await deleteDoc(doc(firestore, "action_board_tasks", id));
      logActivity(firestore, 'action_board_deleted', { email: user?.email || '', displayName: user?.displayName }, `Deleted task: ${task?.title || id}`);
    }
    catch (err) { console.error("[ActionBoard] Delete failed:", err); }
    setOpenMenuId(null);
  };

  // Build automations object from form
  const buildAutomations = (): TaskAutomations | null => {
    const emails = autoEmailChips;
    const hasAny = emails.length > 0;
    if (!hasAny) return null;
    const auto: TaskAutomations = {};
    if (emails.length > 0) auto.emails = emails;
    if (autoEmailTriggers.length > 0) auto.emailTriggers = autoEmailTriggers;
    return auto;
  };

  // Fire automations for a specific trigger
  const fireAutomations = async (task: ActionBoardTask, trigger: EmailTrigger) => {
    if (!task.automations) return;
    const { emails, emailTriggers } = task.automations;
    if (!emails || emails.length === 0) return;
    // Only fire if this trigger is enabled (or if no triggers are set, default to completed for backwards compat)
    if (emailTriggers && emailTriggers.length > 0 && !emailTriggers.includes(trigger)) return;
    if (!emailTriggers || emailTriggers.length === 0) {
      if (trigger !== "completed") return;
    }

    try {
      await fetch("/api/action-board/on-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: {
            title: task.title,
            description: task.description,
            priority: task.priority,
            assignedToEmail: task.assignedToEmail,
            assignedToName: task.assignedToName,
            createdByEmail: task.createdByEmail,
            createdByName: task.createdByName,
            completedAt: new Date().toISOString(),
            isLate: task.isLate || false,
          },
          automations: { emails },
          trigger,
          orgId: ORG_ID,
          userId: user?.uid || null,
        }),
      });
      console.log(`[ActionBoard] Automations fired for "${task.title}" (trigger: ${trigger})`);
    } catch (err) {
      console.warn("[ActionBoard] Automation dispatch failed (silent):", err);
    }
  };
  fireAutomationsRef.current = fireAutomations;

  const moveTask = async (id: string, to: ColumnId) => {
    if (!firestore) return;
    const task = tasks.find(t => t.id === id);
    const updateData: Record<string, any> = { column: to, updatedAt: serverTimestamp() };

    // If moving to "Done", record completion time and check if on-time
    if (to === "done") {
      updateData.completedAt = serverTimestamp();
      // If completed before due date, suppress late status
      if (task?.dueDate && Date.now() <= task.dueDate.toMillis()) {
        updateData.isLate = false;
      }
    } else {
      // Moving out of Done? Clear completion
      if (task?.column === "done") {
        updateData.completedAt = null;
      }
    }

    try {
      await updateDoc(doc(firestore, "action_board_tasks", id), updateData);
      logActivity(firestore, 'action_board_updated', { email: user?.email || '', displayName: user?.displayName }, `Moved task "${task?.title || id}" to ${to}`);
      // Fire automations AFTER successful Firestore update
      if (to === "done" && task) {
        logActivity(firestore, 'action_board_completed', { email: user?.email || '', displayName: user?.displayName }, `Completed task: ${task.title}`);
        fireAutomations({ ...task, column: "done", completedAt: Timestamp.now() }, "completed");
        setShowConfetti(true);
      }
      if (to === "doing" && task && task.column !== "doing") {
        fireAutomations({ ...task, column: "doing" }, "in_progress");
      }
      if (to === "todo" && task && task.column !== "todo") {
        fireAutomations({ ...task, column: "todo" }, "assigned");
      }
    } catch (err) { console.error("[ActionBoard] Move failed:", err); }
    setOpenMenuId(null);
  };

  const archiveTask = async (id: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "action_board_tasks", id), {
        isArchived: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) { console.error("[ActionBoard] Archive failed:", err); }
    setOpenMenuId(null);
  };

  const restoreTask = async (id: string, targetUid?: string, targetEmail?: string, targetName?: string) => {
    if (!firestore) return;
    try {
      const updateData: Record<string, any> = {
        isArchived: false,
        column: "done" as ColumnId,
        updatedAt: serverTimestamp(),
      };
      // If restoring to a different user (admin feature)
      if (targetUid && targetEmail) {
        updateData.assignedTo = targetUid;
        updateData.assignedToEmail = targetEmail;
        updateData.assignedToName = targetName || targetEmail;
      }
      await updateDoc(doc(firestore, "action_board_tasks", id), updateData);
      setRestoreDropdownId(null);
    } catch (err) { console.error("[ActionBoard] Restore failed:", err); }
  };

  const addComment = async (taskId: string) => {
    if (!firestore || !user?.uid || !commentInput.trim()) return;
    const comment: TaskComment = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      text: commentInput.trim(),
      authorUid: user.uid,
      authorName: user.displayName || "",
      authorEmail: user.email || "",
      createdAt: Timestamp.now(),
    };
    try {
      await updateDoc(doc(firestore, "action_board_tasks", taskId), {
        comments: arrayUnion(comment),
        updatedAt: serverTimestamp(),
      });
      setCommentInput("");
    } catch (err) { console.error("[ActionBoard] Add comment failed:", err); }
  };

  const acceptTask = async (id: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "action_board_tasks", id), {
        assignmentStatus: "accepted", column: "todo", updatedAt: serverTimestamp(),
      });
    } catch (err) { console.error("[ActionBoard] Accept failed:", err); }
  };

  const denyTask = async (id: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "action_board_tasks", id), {
        assignmentStatus: "denied", deniedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (err) { console.error("[ActionBoard] Deny failed:", err); }
  };

  // Drag & Drop
  const onDragStart = (e: React.DragEvent, taskId: string) => {
    draggedTaskRef.current = taskId;
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.4";
  };
  const onDragEnd = (e: React.DragEvent) => {
    draggedTaskRef.current = null; setDragOverColumn(null);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
  };
  const onDragOver = (e: React.DragEvent, colId: ColumnId) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverColumn(colId);
  };
  const onDragLeave = () => setDragOverColumn(null);
  const onDrop = (e: React.DragEvent, colId: ColumnId) => {
    e.preventDefault();
    if (draggedTaskRef.current) moveTask(draggedTaskRef.current, colId);
    setDragOverColumn(null);
  };

  // Helpers
  const formatDate = (ts: Timestamp | null) => {
    if (!ts) return "Just now";
    return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatDatetime = (ts: Timestamp | null | undefined) => {
    if (!ts) return "";
    return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const visibleTasks = getVisibleBoardTasks();
  const tasksForColumn = (colId: ColumnId) => visibleTasks.filter(t => t.column === colId);

  const filteredAssignees = orgMembers.filter(m => {
    if (!assigneeSearch.trim()) return true;
    const q = assigneeSearch.toLowerCase();
    return (m.displayName?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  });

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return "?";
  };

  const getAvatarColor = (uid: string) => {
    const colors = [
      "from-indigo-400 to-purple-500", "from-emerald-400 to-teal-500",
      "from-amber-400 to-orange-500", "from-pink-400 to-rose-500",
      "from-cyan-400 to-blue-500", "from-violet-400 to-fuchsia-500",
    ];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // Loading State
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${isDarkMode ? 'bg-slate-900' : 'bg-[#faf6ed]'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${isDarkMode ? 'bg-indigo-900/50' : 'bg-indigo-100'} flex items-center justify-center text-indigo-600 animate-pulse`}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.abLoadingActionBoard}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-[#faf6ed] text-slate-900'} font-sans overflow-hidden`}>
      {showConfetti && <ActionBoardConfetti onDone={() => setShowConfetti(false)} />}

      {/* Page Header */}
      <div className="shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-extrabold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
              <div className={`w-10 h-10 rounded-xl ${isDarkMode ? 'bg-indigo-900/50' : 'bg-indigo-100'} flex items-center justify-center text-indigo-600`}>
                <LayoutDashboard className="w-5 h-5" />
              </div>
              {t.abTitle}
              {isAdmin && (
                <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-purple-900/50 text-purple-300 border border-purple-700' : 'bg-purple-100 text-purple-700 border border-purple-200'} flex items-center gap-1`}>
                  <Shield className="w-3 h-3" /> {t.abAdmin}
                </span>
              )}
            </h1>
            <p className={`mt-1.5 text-sm ml-[52px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.abSubtitle}</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Late Tasks Alert */}
            {lateTasks.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                {lateTasks.length} {t.abLate}
              </div>
            )}

            {/* Archive - always visible, left of Incoming */}
            <button onClick={() => { setIsArchiveOpen(true); setConfirmDeleteId(null); setRestoreDropdownId(null); }} className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300' : 'border-slate-200 bg-[#fefcf6] hover:bg-[#faf6ed] text-slate-600'} transition-colors text-sm font-medium cursor-pointer`}>
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">{t.abArchive}</span>
              {(deniedTasks.length + allArchivedTasks.length) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-500 text-white text-[10px] font-bold flex items-center justify-center">{deniedTasks.length + allArchivedTasks.length}</span>
              )}
            </button>

            {/* Incoming Tasks */}
            <button onClick={() => setIsInboxOpen(true)} className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300' : 'border-slate-200 bg-[#fefcf6] hover:bg-[#faf6ed] text-slate-600'} transition-colors text-sm font-medium cursor-pointer`}>
              <Inbox className="w-4 h-4" />
              <span className="hidden sm:inline">{t.abIncoming}</span>
              {pendingTasks.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">{pendingTasks.length}</span>
              )}
            </button>

            {/* Admin Filter */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-colors text-sm font-medium cursor-pointer ${viewFilter !== "my_tasks" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : isDarkMode ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300" : "border-slate-200 bg-[#fefcf6] hover:bg-[#faf6ed] text-slate-600"}`}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">{viewFilter === "my_tasks" ? t.abMyTasks : viewFilter === "all_users" ? t.abAllUsers : t.abFiltered}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {isFilterOpen && (
                  <div className={`absolute right-0 top-12 w-64 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#fefcf6] border-slate-200'} border rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150`}>
                    <div className="p-2">
                      <button onClick={() => { setViewFilter("my_tasks"); setIsFilterOpen(false); }} className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${viewFilter === "my_tasks" ? "bg-indigo-50 text-indigo-700 font-semibold" : isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-[#faf6ed]"}`}>
                        <UserIcon className="w-4 h-4" /> {t.abMyTasks}
                      </button>
                      <button onClick={() => { setViewFilter("all_users"); setIsFilterOpen(false); }} className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${viewFilter === "all_users" ? "bg-indigo-50 text-indigo-700 font-semibold" : isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-[#faf6ed]"}`}>
                        <Users className="w-4 h-4" /> {t.abAllUsers}
                      </button>
                    </div>
                    <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} p-2`}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3.5 py-1">{t.abSpecificUser}</p>
                      {orgMembers.filter(m => m.uid !== user?.uid).slice(0, 8).map(m => (
                        <button key={m.uid} onClick={() => { setViewFilter("specific_user"); setFilterUserId(m.uid); setIsFilterOpen(false); }} className={`w-full text-left px-3.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${viewFilter === "specific_user" && filterUserId === m.uid ? "bg-indigo-50 text-indigo-700 font-semibold" : isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-[#faf6ed]"}`}>
                          <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(m.uid)} flex items-center justify-center text-white text-[9px] font-bold`}>{getInitials(m.displayName, m.email)}</div>
                          <span className="truncate">{m.displayName || m.email}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add Task */}
            <button onClick={openNewTaskModal} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-slate-800'} text-white transition-colors font-semibold text-sm shadow-md hover:shadow-lg cursor-pointer active:scale-[0.97]`}>
              <Plus className="w-4 h-4" /> {t.abAddTask}
            </button>
          </div>
        </div>
      </div>

      {/* â•â• Board Columns â•â• */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 sm:px-8 pb-6">
        <div className="flex gap-4 sm:gap-6 h-full min-w-[720px]">
          {COLUMNS.map(col => {
            const colTasks = tasksForColumn(col.id);
            const isDragOver = dragOverColumn === col.id;
            const lateCount = colTasks.filter(t => getLifecycleStatus(t) === "late").length;

            return (
              <div
                key={col.id}
                className={`flex-1 flex flex-col rounded-2xl border transition-all duration-200 min-w-[220px] ${isDragOver ? `${col.dropBorder} ${col.dropBg} border-dashed border-2` : isDarkMode ? "border-slate-700 bg-slate-800/80 shadow-sm" : "border-slate-200/50 bg-[#f8fafc]/80 shadow-sm"}`}
                onDragOver={e => onDragOver(e, col.id)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className={`px-4 py-3.5 ${col.headerBg} rounded-t-2xl border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200/60'} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${col.accentPill}`}>
                      {col.icon} {col.label}
                    </span>
                    {lateCount > 0 && col.id !== "done" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-600">
                        <AlertTriangle className="w-2.5 h-2.5" /> {lateCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-bold text-slate-400 ${isDarkMode ? 'bg-slate-600/70' : 'bg-white/70'} px-2 py-0.5 rounded-md`}>{colTasks.length}</span>
                </div>

                {/* Task Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className={`w-12 h-12 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center mb-3`}>{col.icon}</div>
                      <p className="text-xs text-slate-400 font-medium">{t.abNoTasksYet}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{t.abDragCardHere}</p>
                    </div>
                  ) : (
                    colTasks.map(task => {
                      const lifecycle = getLifecycleStatus(task);
                      const badge = LIFECYCLE_BADGE[lifecycle];
                      const dueDelta = getDueDelta(task.dueDate);
                      const isLateTask = lifecycle === "late";

                      return (
                        <div
                          key={task.id}
                          id={`task-card-${task.id}`}
                          draggable
                          onDragStart={e => onDragStart(e, task.id)}
                          onDragEnd={onDragEnd}
                          className={`group ${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-xl p-3.5 pl-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-grab active:cursor-grabbing active:shadow-lg active:scale-[1.01] relative border border-l-4 ${
                            openMenuId === task.id ? "z-50" : "z-10 hover:z-20"
                          } ${
                            highlightedTaskId === task.id
                              ? "border-indigo-400 ring-2 ring-indigo-300/60 shadow-lg shadow-indigo-200/40 animate-pulse"
                              : isLateTask && task.column !== "done"
                                ? isDarkMode ? "border-red-700 bg-red-900/20 ring-1 ring-red-800/50" : "border-red-300 bg-red-50/30 ring-1 ring-red-200/50"
                                : isDarkMode ? "border-slate-700" : "border-slate-200/80"
                          } ${
                            task.priority === "High" ? "border-l-red-500" : task.priority === "Medium" ? "border-l-amber-500" : "border-l-sky-500"
                          }`}
                        >
                          {/* Priority + Lifecycle + Menu */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <GripVertical className="absolute left-1 top-4 w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${PRIORITY_STYLES[task.priority]}`}>
                                {task.priority}
                              </span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 border flex items-center gap-0.5 ${badge.style}`}>
                                {badge.icon} {badge.label}
                              </span>
                            </div>
                            <div className="relative">
                              <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === task.id ? null : task.id); }} className={`w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors opacity-0 group-hover:opacity-100`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                              {openMenuId === task.id && (
                                <div onClick={e => e.stopPropagation()} className={`absolute right-0 top-8 w-44 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#fefcf6] border-slate-200'} border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150`}>
                                  {COLUMNS.filter(c => c.id !== task.column).map(c => (
                                    <button key={c.id} onClick={(e) => { e.stopPropagation(); moveTask(task.id, c.id); }} className={`w-full text-left px-3.5 py-2.5 text-sm ${isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-[#faf6ed]'} transition-colors flex items-center gap-2`}>
                                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" /> {t.abMoveTo} {c.label}
                                    </button>
                                  ))}
                                  <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`} />
                                  {(task.createdBy === user?.uid || isAdmin) && (
                                    <>
                                      <button onClick={(e) => { e.stopPropagation(); openEditTaskModal(task); }} className={`w-full text-left px-3.5 py-2.5 text-sm ${isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-[#faf6ed]'} transition-colors flex items-center gap-2`}>
                                        <Edit2 className="w-3.5 h-3.5 text-slate-400" /> {t.abEditTask}
                                      </button>
                                      {task.column === "done" ? (
                                        <button onClick={(e) => { e.stopPropagation(); archiveTask(task.id); }} className={`w-full text-left px-3.5 py-2.5 text-sm ${isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-[#faf6ed]'} transition-colors flex items-center gap-2`}>
                                          <Archive className="w-3.5 h-3.5 text-slate-400" /> {t.abArchive}
                                        </button>
                                      ) : (
                                        <div className="relative group/archive">
                                          <button disabled className="w-full text-left px-3.5 py-2.5 text-sm text-slate-300 cursor-not-allowed flex items-center gap-2">
                                            <Archive className="w-3.5 h-3.5" /> {t.abArchive}
                                          </button>
                                          <div className="invisible group-hover/archive:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] font-medium rounded-lg whitespace-nowrap z-[60] shadow-lg pointer-events-none">
                                            {t.abArchiveAvailableOnDone}
                                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
                                          </div>
                                        </div>
                                      )}
                                      <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="w-full text-left px-3.5 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">
                                        <Trash2 className="w-3.5 h-3.5" /> {t.abDelete}
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className={`text-sm font-semibold leading-snug mb-1 ${task.column === "done" ? "text-slate-500 line-through" : isDarkMode ? "text-white" : "text-slate-800"}`}>{task.title}</h3>

                          {/* Description */}
                          {task.description && (
                            <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">{task.description}</p>
                          )}

                          {/* Attachments */}
                          {task.attachments && task.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {task.attachments.slice(0, 3).map((att, i) => (
                                att.type.startsWith('image/') ? (
                                  <img key={i} src={att.url} alt={att.name} className="w-14 h-14 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); setLightboxUrl(att.url); }} />
                                ) : (
                                  <div key={i} className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); window.open(att.url, '_blank'); }}>
                                    <Paperclip className="w-4 h-4 text-slate-400" />
                                    <span className="text-[8px] text-slate-400 truncate max-w-[50px]">{att.name.split('.').pop()}</span>
                                  </div>
                                )
                              ))}
                              {task.attachments.length > 3 && (
                                <div className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-semibold">+{task.attachments.length - 3}</div>
                              )}
                            </div>
                          )}

                          {/* Dates Row */}
                          {(task.startDate || task.dueDate) && (
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              {task.startDate && (
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" /> Start: {formatDatetime(task.startDate)}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className={`text-[10px] flex items-center gap-1 font-medium ${dueDelta?.isOverdue ? "text-red-500" : dueDelta && dueDelta.daysLeft <= 1 ? "text-amber-500" : "text-slate-400"}`}>
                                  <Clock className="w-3 h-3" />
                                  Due: {formatDatetime(task.dueDate)}
                                  {dueDelta && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${dueDelta.isOverdue ? "bg-red-100 text-red-600" : dueDelta.daysLeft <= 1 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                                      {dueDelta.label}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Completed on-time indicator */}
                          {task.column === "done" && task.completedAt && !task.isLate && (
                            <div className="flex items-center gap-1 mb-2">
                              <span className="text-[10px] text-emerald-500 font-medium bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {t.abCompletedOnTime} · {formatDatetime(task.completedAt)}
                              </span>
                            </div>
                          )}
                          {task.column === "done" && task.isLate && (
                            <div className="flex items-center gap-1 mb-2">
                              <span className="text-[10px] text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {t.abCompletedLate} · {formatDatetime(task.completedAt)}
                              </span>
                            </div>
                          )}

                          {/* Assigned By */}
                          {task.createdBy !== task.assignedTo && task.assignedTo === user?.uid && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="text-[10px] text-indigo-500 font-medium bg-indigo-50 px-2 py-0.5 rounded-md">
                                {t.abAssignedBy} {task.createdByName || task.createdByEmail}
                              </span>
                            </div>
                          )}

                          {/* Automations badge */}
                          {task.automations && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                                <Zap className="w-2.5 h-2.5" />
                                {[
                                  task.automations.emails?.length ? `${task.automations.emails.length} email${task.automations.emails.length > 1 ? "s" : ""}` : null,
                                  task.automations.slackWebhook ? "Slack" : null,
                                  task.automations.googleAction === "calendar_event" ? "Calendar" : task.automations.googleAction === "draft_email" ? "Gmail Draft" : null,
                                ].filter(Boolean).join(" · ")} {t.abOnComplete}
                              </span>
                            </div>
                          )}

                          {/* Footer */}
                          <div className={`flex items-center justify-between pt-2 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                            <span className="text-[10px] text-slate-400 font-medium">{formatDate(task.createdAt)}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-slate-400 max-w-[100px] truncate">{task.assignedToName || task.assignedToEmail}</span>
                              <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(task.assignedTo)} border-2 border-white shadow-sm flex items-center justify-center text-white text-[8px] font-bold`} title={task.assignedToName || task.assignedToEmail}>
                                {getInitials(task.assignedToName, task.assignedToEmail)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick Add */}
                <div className="p-3 pt-0">
                  <button onClick={() => openNewTaskModalInColumn(col.id)} className={`w-full py-2.5 rounded-xl border border-dashed ${isDarkMode ? 'border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-700/50' : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-[#faf6ed]'} text-xs font-semibold transition-all flex items-center justify-center gap-1.5`}>
                    <Plus className="w-3.5 h-3.5" /> {t.abAddCard}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Add Task Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={handleCloseModal}>
          <div className={`${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-[#fefcf6]'} rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()} onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (items) {
              const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
              if (imageItems.length > 0) {
                e.preventDefault();
                const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
                const previews = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
                setPendingAttachments(prev => [...prev, ...previews]);
              }
            }
          }}>
            {/* Modal Header */}
            <div className={`px-6 py-5 border-b flex items-center justify-between sticky top-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#fefcf6] border-slate-100'} rounded-t-2xl z-10`}>
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                {editingTaskId ? (
                  <>
                    <Edit2 className="w-5 h-5 text-indigo-500" /> {t.abEditTask}
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-indigo-500" /> {t.abNewTask}
                  </>
                )}
              </h3>
              <button onClick={handleCloseModal} className={`w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>{t.abTitle_label} <span className="text-red-400">*</span></label>
                <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && newTitle.trim() && (editingTaskId ? saveTask() : addTask())} placeholder={t.abWhatNeedsDone} className={`w-full px-4 py-3 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus:bg-slate-800' : 'border-slate-200 bg-[#faf6ed] text-slate-800 focus:bg-[#fefcf6]'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm`} />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>{t.abDescription_label} <span className={`${isDarkMode ? 'text-slate-500' : 'text-slate-300'} font-normal normal-case`}>{t.abOptional}</span></label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t.abAddDetails} rows={3} className={`w-full px-4 py-3 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus:bg-slate-800' : 'border-slate-200 bg-[#faf6ed] text-slate-800 focus:bg-[#fefcf6]'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm resize-none`} />
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-1.5`}>
                  <Paperclip className="w-3.5 h-3.5" /> {t.abAttachments}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full border-2 border-dashed ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400 hover:border-indigo-500 hover:text-indigo-400' : 'border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50'} rounded-xl px-4 py-3 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer`}
                >
                  <FileUp className="w-4 h-4" /> {t.abUploadFiles}
                </button>
                {pendingAttachments.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {pendingAttachments.map((att, i) => (
                      <div key={i} className={`relative group rounded-lg overflow-hidden border ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
                        {att.preview ? (
                          <img src={att.preview} alt={att.file.name} className="w-full h-20 object-cover" />
                        ) : (
                          <div className="w-full h-20 flex items-center justify-center text-slate-400">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => removePendingAttachment(i)} className="text-white bg-red-500 rounded-full p-1 cursor-pointer">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className={`text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} truncate px-1 py-0.5`}>{att.file.name}</p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Show existing attachments when editing */}
                {editingTaskId && (() => { const tk = tasks.find(t => t.id === editingTaskId); return tk?.attachments?.length ? (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {tk.attachments.map((att, i) => (
                      <div key={`existing-${i}`} className={`relative rounded-lg overflow-hidden border ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                        {att.type.startsWith('image/') ? (
                          <img src={att.url} alt={att.name} className="w-full h-20 object-cover" />
                        ) : (
                          <div className="w-full h-20 flex items-center justify-center text-slate-400">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}
                        <p className={`text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} truncate px-1 py-0.5`}>{att.name}</p>
                      </div>
                    ))}
                  </div>
                ) : null; })()}
              </div>

              {/* Priority + Column */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>{t.abPriority}</label>
                  <div className="relative">
                    <select value={newPriority} onChange={e => setNewPriority(e.target.value as Priority)} className={`w-full appearance-none px-4 py-3 pr-10 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white focus:bg-slate-800' : 'border-slate-200 bg-[#faf6ed] text-slate-800 focus:bg-[#fefcf6]'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm cursor-pointer`}>
                      <option value="High">{"\uD83D\uDD34"} {t.abHigh}</option>
                      <option value="Medium">{"\uD83D\uDFE1"} {t.abMedium}</option>
                      <option value="Low">{"\uD83D\uDD35"} {t.abLow}</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>{t.abColumn}</label>
                  <div className="relative">
                    <select value={newColumn} onChange={e => setNewColumn(e.target.value as ColumnId)} className={`w-full appearance-none px-4 py-3 pr-10 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white focus:bg-slate-800' : 'border-slate-200 bg-[#faf6ed] text-slate-800 focus:bg-[#fefcf6]'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm cursor-pointer`}>
                      <option value="todo">{t.abToDo}</option>
                      <option value="doing">{t.abDoing}</option>
                      <option value="done">{t.abDone}</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Start Date + Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {t.abStartDate}</span>
                  </label>
                  <input type="datetime-local" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} className={`w-full px-3 py-3 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white focus:bg-slate-800' : 'border-slate-200 bg-[#faf6ed] text-slate-800 focus:bg-[#fefcf6]'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm cursor-pointer`} />
                </div>
                <div>
                  <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.abDueDate}</span>
                  </label>
                  <input type="datetime-local" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} min={newStartDate || undefined} className={`w-full px-3 py-3 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white focus:bg-slate-800' : 'border-slate-200 bg-[#faf6ed] text-slate-800 focus:bg-[#fefcf6]'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm cursor-pointer`} />
                </div>
              </div>

              {/* Assign To */}
              <div>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>{t.abAssignTo}</label>
                <div className="space-y-2">
                  <button onClick={() => setNewAssignee("self")} className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${newAssignee === "self" ? `border-indigo-300 ${isDarkMode ? 'bg-indigo-950/70 text-indigo-200 ring-2 ring-indigo-500/30' : 'bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'}` : `border-slate-700 ${isDarkMode ? 'bg-slate-900 hover:bg-slate-700 text-white' : 'bg-[#faf6ed] hover:bg-[#fefcf6]'}`}`}>
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(user?.uid || "")} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>{getInitials(user?.displayName || undefined, user?.email || undefined)}</div>
                    <div><span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.abMyself}</span><span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} ml-2`}>{user?.email}</span></div>
                    {newAssignee === "self" && <CheckCircle2 className="w-4 h-4 text-indigo-500 ml-auto" />}
                  </button>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} placeholder={t.abSearchTeam} className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus:bg-slate-800' : 'border-slate-200 bg-[#faf6ed] text-slate-800 focus:bg-[#fefcf6]'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm`} />
                  </div>

                  <div className={`max-h-36 overflow-y-auto space-y-1 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-100 bg-white'} p-1`}>
                    {filteredAssignees.filter(m => m.uid !== user?.uid).slice(0, 10).map(m => (
                      <button key={m.uid} onClick={() => setNewAssignee(m.uid)} className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors ${newAssignee === m.uid ? (isDarkMode ? "bg-indigo-950/80 ring-1 ring-indigo-800 text-white" : "bg-indigo-50 ring-1 ring-indigo-200 text-indigo-900") : (isDarkMode ? "hover:bg-slate-700 text-slate-300" : "hover:bg-[#faf6ed] text-slate-700")}`}>
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(m.uid)} flex items-center justify-center text-white text-[9px] font-bold`}>{getInitials(m.displayName, m.email)}</div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'} truncate block`}>{m.displayName || m.email}</span>
                          {m.displayName && <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} truncate block`}>{m.email}</span>}
                        </div>
                        {m.role === "admin" && <span className="text-[9px] font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">ADMIN</span>}
                        {newAssignee === m.uid && <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />}
                      </button>
                    ))}
                    {filteredAssignees.filter(m => m.uid !== user?.uid).length === 0 && (
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} text-center py-3`}>{t.abNoTeamMembers}</p>
                    )}
                  </div>

                  {newAssignee !== "self" && (
                    <div className={`text-xs px-3 py-2 rounded-lg ${isAdmin ? (isDarkMode ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/60" : "bg-emerald-50 text-emerald-600") : (isDarkMode ? "bg-amber-950/50 text-amber-400 border border-amber-900/60" : "bg-amber-50 text-amber-600")}`}>
                      {isAdmin ? `✓ ${t.abAdminAssignDirect}` : `⏳ ${t.abRequiresApproval}`}
                    </div>
                  )}
                </div>
              </div>
              {/* ── Email Automations ── */}
              <div className={`border ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200'} rounded-xl overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setIsAutomationsOpen(!isAutomationsOpen)}
                  className={`w-full flex items-center justify-between px-4 py-3 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-[#faf6ed] hover:bg-slate-100 text-slate-600'} transition-colors text-left`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                    {t.abEmailNotifications}
                    {autoEmailChips.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    )}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isAutomationsOpen ? "rotate-90" : ""}`} />
                </button>

                {isAutomationsOpen && (
                  <div className={`p-4 space-y-5 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-[#fefcf6]'}`}>
                    <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.abSendNotifications}</p>

                    {/* Email Chip Input */}
                    <div>
                      <label className={`flex items-center gap-1.5 text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-505'} uppercase tracking-wider mb-1.5`}>
                        <Mail className="w-3 h-3 text-blue-500" /> {t.abRecipients}
                      </label>
                      <div className={`min-h-[42px] flex flex-wrap items-center gap-1.5 px-2.5 py-2 rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-900 focus-within:bg-slate-800' : 'border-slate-200 bg-[#faf6ed] focus-within:bg-[#fefcf6]'} focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all`}>
                        {autoEmailChips.map((email, i) => (
                          <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-indigo-950/80 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'} text-xs font-medium animate-in fade-in slide-in-from-left-1 duration-150`}>
                            {email}
                            <button type="button" onClick={() => setAutoEmailChips(prev => prev.filter((_, idx) => idx !== i))} className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-indigo-200 transition-colors ml-0.5">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        <input
                          value={autoEmailInput}
                          onChange={e => {
                            const val = e.target.value;
                            if (val.endsWith(",")) {
                              const email = val.slice(0, -1).trim();
                              if (email && email.includes("@") && !autoEmailChips.includes(email)) {
                                setAutoEmailChips(prev => [...prev, email]);
                              }
                              setAutoEmailInput("");
                            } else {
                              setAutoEmailInput(val);
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const email = autoEmailInput.trim();
                              if (email && email.includes("@") && !autoEmailChips.includes(email)) {
                                setAutoEmailChips(prev => [...prev, email]);
                              }
                              setAutoEmailInput("");
                            }
                            if (e.key === "Backspace" && !autoEmailInput && autoEmailChips.length > 0) {
                              setAutoEmailChips(prev => prev.slice(0, -1));
                            }
                          }}
                          placeholder={autoEmailChips.length === 0 ? t.abTypeEmailEnter : t.abAddAnother}
                          className={`flex-1 min-w-[140px] bg-transparent outline-none text-xs ${isDarkMode ? 'text-white' : 'text-slate-700'} placeholder:text-slate-400 py-0.5`}
                        />
                      </div>
                    </div>

                    {/* Trigger Buttons */}
                    {autoEmailChips.length > 0 && (
                      <div>
                        <label className={`flex items-center gap-1.5 text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>
                          <Zap className="w-3 h-3 text-amber-500" /> {t.abSendWhen}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { id: "assigned" as EmailTrigger, label: t.abTaskAssigned, icon: <Circle className="w-3.5 h-3.5" />, desc: t.abMovedToToDo, activeColor: isDarkMode ? "bg-blue-950/80 border-blue-800 text-blue-300" : "bg-blue-50 border-blue-300 text-blue-700", dotColor: "bg-blue-400" },
                            { id: "in_progress" as EmailTrigger, label: t.abInProgressTrigger, icon: <Timer className="w-3.5 h-3.5" />, desc: t.abMovedToDoing, activeColor: isDarkMode ? "bg-amber-950/80 border-amber-800 text-amber-300" : "bg-amber-50 border-amber-300 text-amber-700", dotColor: "bg-amber-400" },
                            { id: "completed" as EmailTrigger, label: t.abCompletedTrigger, icon: <CheckCircle2 className="w-3.5 h-3.5" />, desc: t.abMovedToDone, activeColor: isDarkMode ? "bg-emerald-950/80 border-emerald-800 text-emerald-300" : "bg-emerald-50 border-emerald-300 text-emerald-700", dotColor: "bg-emerald-400" },
                            { id: "overdue" as EmailTrigger, label: t.abOverdueTrigger, icon: <AlertTriangle className="w-3.5 h-3.5" />, desc: t.abPastDueDate, activeColor: isDarkMode ? "bg-red-950/80 border-red-800 text-red-300" : "bg-red-50 border-red-300 text-red-700", dotColor: "bg-red-400" },
                          ]).map(trigger => {
                            const isActive = autoEmailTriggers.includes(trigger.id);
                            return (
                              <button
                                key={trigger.id}
                                type="button"
                                onClick={() => {
                                  setAutoEmailTriggers(prev =>
                                    prev.includes(trigger.id) ? prev.filter(t => t !== trigger.id) : [...prev, trigger.id]
                                  );
                                }}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-200 ${isActive ? trigger.activeColor : isDarkMode ? "border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-[#faf6ed]"}`}
                              >
                                <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${isActive ? "border-current bg-current" : "border-slate-300"}`}>
                                  {isActive && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-semibold block">{trigger.label}</span>
                                  <span className={`text-[10px] block ${isActive ? "opacity-70" : isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{trigger.desc}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {autoEmailTriggers.length === 0 && (
                          <p className="text-[10px] text-amber-500 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {t.abSelectTrigger}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Comments Section (Edit mode only) ── */}
              {editingTaskId && (
                <div className={`border ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200'} rounded-xl overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                    className={`w-full flex items-center justify-between px-4 py-3 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-[#faf6ed] hover:bg-slate-100 text-slate-600'} transition-colors text-left`}
                  >
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <MessageCircle className="w-3.5 h-3.5 text-indigo-500" />
                      {t.abComments}
                      {(() => { const tk = tasks.find(t => t.id === editingTaskId); return tk?.comments && tk.comments.length > 0 ? <span className={`text-[10px] font-bold ${isDarkMode ? 'bg-indigo-950 text-indigo-300' : 'bg-indigo-100 text-indigo-600'} px-1.5 py-0.5 rounded-full ml-1`}>{tk.comments.length}</span> : null; })()}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isCommentsOpen ? "rotate-90" : ""}`} />
                  </button>

                  {isCommentsOpen && (
                    <div className={`p-4 space-y-3 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-[#fefcf6]'}`}>
                      {/* Existing comments */}
                      {(() => {
                        const tk = tasks.find(t => t.id === editingTaskId);
                        const comments = tk?.comments || [];
                        if (comments.length === 0) return (
                          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-center py-4`}>{t.abNoComments}</p>
                        );
                        return comments.map((c: TaskComment) => (
                          <div key={c.id} className="flex gap-2.5 animate-in fade-in duration-150">
                            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(c.authorUid)} flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5`}>
                              {getInitials(c.authorName, c.authorEmail)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{c.authorName || c.authorEmail}</span>
                                <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{c.createdAt ? c.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Just now"}</span>
                              </div>
                              <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} leading-relaxed mt-0.5`}>{c.text}</p>
                            </div>
                          </div>
                        ));
                      })()}

                      {/* Add comment input */}
                      <div className={`flex items-center gap-2 pt-2 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(user?.uid || "")} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                          {getInitials(user?.displayName || undefined, user?.email || undefined)}
                        </div>
                        <input
                          value={commentInput}
                          onChange={e => setCommentInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && commentInput.trim()) { e.preventDefault(); addComment(editingTaskId); } }}
                          placeholder={t.abWriteComment}
                          className={`flex-1 px-3 py-2 rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus:bg-slate-800' : 'border-slate-200 bg-[#faf6ed] text-slate-800 focus:bg-[#fefcf6]'} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-xs`}
                        />
                        <button
                          type="button"
                          onClick={() => addComment(editingTaskId)}
                          disabled={!commentInput.trim()}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 sticky bottom-0 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-[#fefcf6]'}`}>
              <button onClick={handleCloseModal} className={`px-5 py-2.5 rounded-xl text-sm font-semibold ${isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'} transition-colors`}>{t.abCancel}</button>
              {editingTaskId ? (
                <button onClick={saveTask} disabled={!newTitle.trim()} className={`px-6 py-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-slate-800'} text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md cursor-pointer`}>{t.abSaveChanges}</button>
              ) : (
                <button onClick={addTask} disabled={!newTitle.trim()} className={`px-6 py-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-slate-800'} text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md cursor-pointer`}>{t.abCreateTask}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Incoming Tasks Drawer ── */}
      {isInboxOpen && (
        <div className="fixed inset-0 z-[9998] flex justify-end" onClick={() => setIsInboxOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200" />
          <div className={`relative w-full max-w-md ${isDarkMode ? 'bg-slate-900 border-l border-slate-700 text-white' : 'bg-[#fefcf6]'} shadow-2xl h-full animate-in slide-in-from-right duration-300 flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-5 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} flex items-center justify-between shrink-0`}>
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                <Inbox className="w-5 h-5 text-amber-500" /> {t.abIncomingTasks}
                {pendingTasks.length > 0 && <span className={`text-xs font-bold ${isDarkMode ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-amber-100 text-amber-700'} px-2 py-0.5 rounded-lg`}>{pendingTasks.length}</span>}
              </h3>
              <button onClick={() => setIsInboxOpen(false)} className={`w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} transition-colors`}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {pendingTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className={`w-14 h-14 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center mb-4`}><Inbox className="w-6 h-6 text-slate-300" /></div>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} font-medium`}>{t.abNoPendingTasks}</p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-300'} mt-1`}>{t.abTasksAssignedHere}</p>
                </div>
              ) : (
                pendingTasks.map(task => (
                  <div key={task.id} className={`${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-[#fefcf6] border-slate-200'} border rounded-xl p-4 shadow-sm`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-amber-950/50 text-amber-400 border border-amber-800' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>{t.abPending}</span>
                    </div>
                    <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'} mb-1`}>{task.title}</h4>
                    {task.description && <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-500'} leading-relaxed mb-2`}>{task.description}</p>}
                    {(task.startDate || task.dueDate) && (
                      <div className="flex items-center gap-3 mb-2 text-[10px] text-slate-400">
                        {task.startDate && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {t.abStartDate}: {formatDatetime(task.startDate)}</span>}
                        {task.dueDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.abDueDate}: {formatDatetime(task.dueDate)}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(task.createdBy)} flex items-center justify-center text-white text-[8px] font-bold`}>{getInitials(task.createdByName, task.createdByEmail)}</div>
                      <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.abAssignedBy} <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{task.createdByName || task.createdByEmail}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => acceptTask(task.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"><Check className="w-4 h-4" /> {t.abAccept}</button>
                      <button onClick={() => denyTask(task.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl ${isDarkMode ? 'bg-slate-900 border-red-900 text-red-400 hover:bg-red-955/30' : 'bg-[#fefcf6] border border-red-200 text-red-500'} text-sm font-semibold transition-colors cursor-pointer`}><XCircle className="w-4 h-4" /> {t.abDeny}</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Archive Drawer ── */}
      {isArchiveOpen && (
        <div className="fixed inset-0 z-[9998] flex justify-end" onClick={() => { setIsArchiveOpen(false); setConfirmDeleteId(null); setRestoreDropdownId(null); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200" />
          <div className={`relative w-full max-w-md ${isDarkMode ? 'bg-slate-900 border-l border-slate-700 text-white' : 'bg-[#fefcf6]'} shadow-2xl h-full animate-in slide-in-from-right duration-300 flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-5 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}><Archive className="w-5 h-5 text-slate-400" /> {t.abArchive} <span className={`text-xs font-bold ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'} px-2 py-0.5 rounded-lg`}>{allArchivedTasks.length}</span></h3>
                <button onClick={() => { setIsArchiveOpen(false); setConfirmDeleteId(null); setRestoreDropdownId(null); }} className={`w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} transition-colors`}><X className="w-4 h-4" /></button>
              </div>
              {/* Admin user filter */}
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={archiveFilterUser}
                    onChange={e => setArchiveFilterUser(e.target.value)}
                    className={`text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-800' : 'bg-[#faf6ed] border-slate-200 text-slate-600 focus:ring-indigo-200'} border rounded-lg px-2.5 py-1.5 flex-1 focus:outline-none focus:ring-2`}
                  >
                    <option value="all">{t.abAllUsers}</option>
                    {orgMembers.map(m => (
                      <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* ── Archived Section ── */}
              {archivedTasks.length > 0 && (
                <>
                  <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider px-1 pt-2`}>{t.abArchivedAssignments}</p>
                  {archivedTasks.map(task => (
                    <div key={task.id} className={`${isDarkMode ? 'bg-slate-800 border-emerald-900 text-white' : 'bg-[#fefcf6] border-emerald-200'} border rounded-xl p-4 shadow-sm`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>{t.abArchived}</span>
                      </div>
                      <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-700'} mb-1`}>{task.title}</h4>
                      {task.description && <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-500'} leading-relaxed mb-2 line-clamp-2`}>{task.description}</p>}
                      <div className="text-[10px] text-slate-400 mb-2 flex items-center gap-3">
                        <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {task.assignedToName || task.assignedToEmail}</span>
                        {task.completedAt && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> {formatDatetime(task.completedAt)}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-2 gap-2">
                        {/* Restore button with user picker for admins */}
                        <div className="relative">
                          {isAdmin ? (
                            <>
                              <button onClick={() => setRestoreDropdownId(restoreDropdownId === task.id ? null : task.id)} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors font-medium cursor-pointer">
                                <ArchiveRestore className="w-3 h-3" /> {t.abRestore}
                                <ChevronDown className={`w-3 h-3 transition-transform ${restoreDropdownId === task.id ? "rotate-180" : ""}`} />
                              </button>
                              {restoreDropdownId === task.id && (
                                <div className={`absolute left-0 bottom-full mb-1 w-52 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-[#fefcf6] border-slate-200'} border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150`}>
                                  <button onClick={() => restoreTask(task.id)} className={`w-full text-left px-3 py-2 text-xs ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-[#faf6ed]'} transition-colors flex items-center gap-2`}>
                                    <ArchiveRestore className="w-3 h-3 text-indigo-400" /> {t.abRestoreOriginal}
                                  </button>
                                  <div className={`border-t ${isDarkMode ? 'border-slate-850 border-slate-700' : 'border-slate-100'}`} />
                                  <p className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t.abRestoreToUser}</p>
                                  {orgMembers.map(m => (
                                    <button key={m.uid} onClick={() => restoreTask(task.id, m.uid, m.email, m.displayName || m.email)} className={`w-full text-left px-3 py-2 text-xs ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-[#faf6ed]'} transition-colors flex items-center gap-2`}>
                                      <UserIcon className="w-3 h-3 text-slate-400" /> {m.displayName || m.email}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <button onClick={() => restoreTask(task.id)} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors font-medium cursor-pointer">
                              <ArchiveRestore className="w-3 h-3" /> {t.abRestore}
                            </button>
                          )}
                        </div>
                        {/* Permanent delete with confirmation */}
                        {confirmDeleteId === task.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-red-500 font-medium">{t.abDeleteForever}</span>
                            <button onClick={() => { deleteTask(task.id); setConfirmDeleteId(null); }} className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-md transition-colors cursor-pointer">{t.abYes}</button>
                            <button onClick={() => setConfirmDeleteId(null)} className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-300 bg-slate-700 hover:bg-slate-600' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'} px-2 py-0.5 rounded-md transition-colors cursor-pointer`}>{t.abNo}</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(task.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer">
                            <Trash2 className="w-3 h-3" /> {t.abDelete}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── Denied Section ── */}
              {deniedTasks.length > 0 && (
                <>
                  <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-550' : 'text-slate-400'} uppercase tracking-wider px-1 pt-2`}>{t.abDeniedTasks}</p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400 bg-slate-950/80 border border-slate-800' : 'text-slate-400 bg-[#faf6ed]'} px-3 py-2 rounded-lg`}>{t.abDeniedAutoDelete}</p>
                  {deniedTasks.map(task => (
                    <div key={task.id} className={`${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-[#fefcf6] border-slate-200'} border rounded-xl p-4 shadow-sm opacity-70`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-red-950/50 text-red-400 border border-red-900' : 'bg-red-50 text-red-500 border border-red-200'}`}>{t.abDenied}</span>
                      </div>
                      <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-1 line-through`}>{task.title}</h4>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-400">{t.abDenied} {task.deniedAt ? formatDate(task.deniedAt) : "recently"}</span>
                        <button onClick={() => deleteTask(task.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"><Trash2 className="w-3 h-3" /> {t.abDeleteNow}</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {deniedTasks.length === 0 && archivedTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className={`w-14 h-14 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center mb-4`}><Archive className="w-6 h-6 text-slate-300" /></div>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-400'} font-medium`}>{t.abNoArchivedAssignments}</p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-300'} mt-1`}>{t.abArchivedWillAppear}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Click-away listeners */}
      {openMenuId && <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />}
      {isFilterOpen && <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Attachment" className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" />
          <button onClick={() => setLightboxUrl(null)} className="absolute top-6 right-6 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
