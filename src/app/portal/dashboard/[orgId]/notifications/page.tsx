'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { useTheme } from '@/components/ThemeProvider';
import {
  useNotificationStore,
  useMergedNotifications,
  type DisplayNotification,
} from '@/stores/notification-store';
import {
  ArrowLeft,
  Bell,
  BellOff,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  ClipboardList,
  GraduationCap,
  Clock,
  Sparkles,
  Ticket,
  FileText,
  Hash,
  Check,
  Trash2,
  X,
} from 'lucide-react';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Monochrome icon for a notification, derived from its type (persisted) or id prefix (computed). */
function getIconComponent(n: DisplayNotification) {
  switch (n.type) {
    case 'action_board_assigned':
      return ClipboardList;
    case 'onboarding_assigned':
    case 'onboarding_phase_completed':
    case 'onboarding_document_completed':
    case 'onboarding_blueprint_completed':
      return GraduationCap;
    case 'timesheet_entry':
      return Clock;
    case 'grant_found':
      return Sparkles;
    case 'heartbeat':
      return RefreshCw;
  }
  const id = n.id;
  if (id.startsWith('task-overdue-')) return AlertTriangle;
  if (id.startsWith('task-')) return ClipboardList;
  if (id.startsWith('org-msg-')) return Hash;
  if (id.startsWith('dm-')) return MessageSquare;
  if (id.startsWith('ticket-') || id.startsWith('new-ticket-')) return Ticket;
  if (id.startsWith('survey-')) return FileText;
  if (id.startsWith('heartbeat-')) return RefreshCw;
  return Bell;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

type GroupKey = 'today' | 'yesterday' | 'week' | 'older';
const GROUP_LABELS: Record<GroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Earlier this week',
  older: 'Older',
};
const DAY = 24 * 60 * 60 * 1000;

function getGroup(time: number, now: number): GroupKey {
  const today = startOfDay(new Date(now));
  if (time >= today) return 'today';
  if (time >= today - DAY) return 'yesterday';
  if (time >= today - 6 * DAY) return 'week';
  return 'older';
}

function formatClock(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** '5m ago', '3h ago', 'Yesterday 3:12 PM', 'Mon 9:04 AM', 'Sep 12', 'Sep 12, 2025' */
function formatRelative(time: number, now: number) {
  if (!time) return '';
  const diff = now - time;
  const d = new Date(time);
  const group = getGroup(time, now);
  if (group === 'today') {
    if (diff < 60 * 1000) return 'Just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  }
  if (group === 'yesterday') return `Yesterday ${formatClock(d)}`;
  if (group === 'week') return `${d.toLocaleDateString([], { weekday: 'short' })} ${formatClock(d)}`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString([], sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function NotificationsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const { user } = useUser();
  const { isDarkMode } = useTheme();
  const uid = user?.uid;

  const loaded = useNotificationStore((s) => s.loaded);
  const fetchPersisted = useNotificationStore((s) => s.fetchPersisted);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const remove = useNotificationStore((s) => s.remove);
  const clearAllPersisted = useNotificationStore((s) => s.clearAll);
  const markComputedRead = useNotificationStore((s) => s.markComputedRead);
  const dismissComputed = useNotificationStore((s) => s.dismissComputed);
  const notifications = useMergedNotifications();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The user may land here directly — load persisted notifications on mount.
  // Computed (live) notifications arrive from the dashboard layout via the store.
  useEffect(() => {
    if (uid) fetchPersisted();
  }, [uid, fetchPersisted]);

  // Keep relative timestamps fresh
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, filter],
  );
  const groups = useMemo(() => {
    const order: GroupKey[] = ['today', 'yesterday', 'week', 'older'];
    const map: Record<GroupKey, DisplayNotification[]> = { today: [], yesterday: [], week: [], older: [] };
    visible.forEach((n) => map[getGroup(n.time, now)].push(n));
    return order.filter((k) => map[k].length > 0).map((k) => ({ key: k, items: map[k] }));
  }, [visible, now]);

  /* ── Actions ── */
  const markOneRead = (n: DisplayNotification) => {
    if (n.read) return;
    if (n.source === 'persisted') markRead([n.id]);
    else markComputedRead([n.id], uid);
  };

  const handleOpen = (n: DisplayNotification) => {
    markOneRead(n);
    if (n.link) router.push(n.link);
  };

  const handleDelete = (n: DisplayNotification) => {
    if (n.source === 'persisted') remove([n.id]);
    else dismissComputed([n.id]);
  };

  const handleMarkAllRead = () => {
    markAllRead();
    const computedUnread = notifications.filter((n) => n.source === 'computed' && !n.read).map((n) => n.id);
    if (computedUnread.length) markComputedRead(computedUnread, uid);
  };

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), 5000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmClear(false);
    if (notifications.some((n) => n.source === 'persisted')) clearAllPersisted();
    const computedIds = notifications.filter((n) => n.source === 'computed').map((n) => n.id);
    if (computedIds.length) dismissComputed(computedIds);
  };

  /* ── Palette (editorial: Claude-like light / ChatGPT-like dark) ── */
  const c = isDarkMode
    ? {
        canvas: 'bg-[#212121]',
        card: 'bg-[#2F2F2F]',
        border: 'border-[#383838]',
        divide: 'divide-[#383838]',
        text: 'text-[#ECECEC]',
        textSecondary: 'text-[#B4B4B4]',
        textMuted: 'text-[#737373]',
        hover: 'hover:bg-[#383838]',
        iconBg: 'bg-[#383838]',
        iconText: 'text-[#B4B4B4]',
        dot: 'bg-[#ECECEC]',
        primaryBtn: 'bg-[#ECECEC] text-[#171717] hover:bg-white',
        segBg: 'bg-[#2F2F2F] border-[#383838]',
        segActive: 'bg-[#383838] text-[#ECECEC]',
        segIdle: 'text-[#B4B4B4] hover:text-[#ECECEC]',
        skeleton: 'bg-[#383838]',
        danger: 'text-red-400 hover:bg-red-500/10',
      }
    : {
        canvas: 'bg-[#FAF9F5]',
        card: 'bg-[#FFFFFF]',
        border: 'border-[#E5E4DE]',
        divide: 'divide-[#E5E4DE]',
        text: 'text-[#1F1E1D]',
        textSecondary: 'text-[#6B6860]',
        textMuted: 'text-[#9C978D]',
        hover: 'hover:bg-[#F3F2EC]',
        iconBg: 'bg-[#F3F2EC]',
        iconText: 'text-[#6B6860]',
        dot: 'bg-[#1F1E1D]',
        primaryBtn: 'bg-[#1F1E1D] text-white hover:bg-black',
        segBg: 'bg-[#F3F2EC] border-[#E5E4DE]',
        segActive: 'bg-[#FFFFFF] text-[#1F1E1D] shadow-sm',
        segIdle: 'text-[#6B6860] hover:text-[#1F1E1D]',
        skeleton: 'bg-[#EDECE6]',
        danger: 'text-red-600 hover:bg-red-50',
      };

  const isInitialLoading = !loaded && notifications.length === 0;
  const hasAny = notifications.length > 0;

  return (
    <div className={`min-h-full w-full ${c.canvas} ${c.text}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 sm:pt-10 pb-24">
        {/* Back link */}
        <Link
          href={`/portal/dashboard/${orgId}`}
          className={`inline-flex items-center gap-1.5 -ml-2 px-2 h-9 rounded-lg text-[13px] font-medium transition-colors ${c.textSecondary} ${c.hover}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>

        {/* Header */}
        <div className="mt-3 sm:mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1
              className={`text-[28px] sm:text-[34px] font-light leading-tight ${c.text}`}
              style={{ letterSpacing: '-0.03em', fontFamily: 'var(--font-outfit), ui-sans-serif, system-ui, sans-serif' }}
            >
              Notifications
            </h1>
            <p className={`mt-1 text-[13px] sm:text-sm ${c.textSecondary}`}>
              {isInitialLoading
                ? 'Loading your notifications'
                : unreadCount > 0
                  ? `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`
                  : hasAny
                    ? 'No unread notifications'
                    : 'Nothing new right now'}
            </p>
          </div>

          {hasAny && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${c.primaryBtn}`}
              >
                <Check className="w-4 h-4" />
                Mark all as read
              </button>
              {confirmClear ? (
                <div className={`inline-flex items-center h-10 rounded-lg border ${c.border} ${c.card} overflow-hidden`}>
                  <button
                    onClick={handleClearAll}
                    className={`h-full px-3 text-[13px] font-medium transition-colors ${c.danger}`}
                  >
                    Confirm clear
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    aria-label="Cancel clear"
                    className={`h-full w-10 flex items-center justify-center border-l ${c.border} ${c.textMuted} ${c.hover}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleClearAll}
                  className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border text-[13px] font-medium transition-colors ${c.border} ${c.card} ${c.textSecondary} ${c.hover}`}
                >
                  <Trash2 className="w-4 h-4" />
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Segmented filter */}
        {hasAny && (
          <div className={`mt-6 inline-flex p-1 rounded-lg border ${c.segBg}`} role="tablist">
            {(['all', 'unread'] as const).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`h-8 px-4 rounded-md text-[13px] font-medium transition-colors ${filter === key ? c.segActive : c.segIdle}`}
              >
                {key === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="mt-6">
          {isInitialLoading ? (
            /* Skeleton */
            <div className={`rounded-xl border ${c.border} ${c.card} divide-y ${c.divide} overflow-hidden`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3 px-4 sm:px-5 py-4 animate-pulse">
                  <div className={`w-9 h-9 rounded-lg shrink-0 ${c.skeleton}`} />
                  <div className="flex-1 min-w-0 space-y-2 pt-0.5">
                    <div className={`h-3.5 rounded ${c.skeleton}`} style={{ width: `${55 - i * 5}%` }} />
                    <div className={`h-3 rounded ${c.skeleton}`} style={{ width: `${85 - i * 4}%` }} />
                    <div className={`h-2.5 w-16 rounded ${c.skeleton}`} />
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            /* Empty state */
            <div className={`rounded-xl border ${c.border} ${c.card} px-6 py-16 sm:py-20 flex flex-col items-center text-center`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.iconBg}`}>
                {filter === 'unread' && hasAny ? (
                  <Check className={`w-5 h-5 ${c.iconText}`} />
                ) : (
                  <BellOff className={`w-5 h-5 ${c.iconText}`} />
                )}
              </div>
              <p className={`mt-4 text-[15px] font-semibold ${c.text}`}>You&apos;re all caught up</p>
              <p className={`mt-1 text-[13px] max-w-xs ${c.textSecondary}`}>
                {filter === 'unread' && hasAny
                  ? 'You have read every notification. Switch to All to see your history.'
                  : 'New assignments, messages, and updates will appear here as they happen.'}
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              {groups.map((group) => (
                <section key={group.key}>
                  <h2 className={`mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${c.textMuted}`}>
                    {GROUP_LABELS[group.key]}
                  </h2>
                  <ul className={`rounded-xl border ${c.border} ${c.card} divide-y ${c.divide} overflow-hidden`}>
                    {group.items.map((n) => {
                      const Icon = getIconComponent(n);
                      const isUnread = !n.read;
                      return (
                        <li key={n.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpen(n)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOpen(n);
                              }
                            }}
                            className={`group relative flex items-start gap-3 pl-4 pr-2 sm:pl-5 sm:pr-3 py-3.5 min-h-[64px] cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-400/50 ${c.hover}`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.iconBg}`}>
                              <Icon className={`w-4 h-4 ${c.iconText}`} />
                            </div>

                            <div className="flex-1 min-w-0 pt-px">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className={`text-[14px] leading-snug truncate ${isUnread ? `font-semibold ${c.text}` : `font-medium ${c.text}`}`}>
                                  {n.title}
                                </p>
                                {isUnread && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} aria-label="Unread" />}
                              </div>
                              {n.desc && (
                                <p className={`mt-0.5 text-[13px] leading-relaxed line-clamp-2 break-words ${c.textSecondary}`}>
                                  {n.desc}
                                </p>
                              )}
                              <p className={`mt-1 text-[12px] ${c.textMuted}`}>
                                {formatRelative(n.time, now)}
                                {n.actorName && <span> &middot; {n.actorName}</span>}
                              </p>
                            </div>

                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(n);
                              }}
                              aria-label="Delete notification"
                              title="Delete notification"
                              className={`w-10 h-10 shrink-0 -my-1 flex items-center justify-center rounded-lg transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 ${c.textMuted} ${isDarkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
