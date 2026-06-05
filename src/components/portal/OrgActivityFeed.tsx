'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { FileText, LogIn, Bot, Ticket, ClipboardList, Users } from 'lucide-react';
import type { ActivityType } from '@/lib/activity-logger';

interface ActivityItem {
  id: string;
  type: ActivityType;
  userName: string;
  description: string;
  category: string;
  timestamp: { seconds: number; nanoseconds: number } | null;
}

const ICON_MAP: Record<ActivityType, React.ReactNode> = {
  login: <LogIn className="w-4 h-4 text-slate-400" />,
  grant_agent_created: <Bot className="w-4 h-4 text-slate-400" />,
  grant_agent_deleted: <Bot className="w-4 h-4 text-slate-400" />,
  support_ticket_created: <Ticket className="w-4 h-4 text-slate-400" />,
  action_board_created: <ClipboardList className="w-4 h-4 text-slate-400" />,
  crm_entry_created: <Users className="w-4 h-4 text-slate-400" />,
};

function timeAgo(seconds: number): string {
  const now = Date.now() / 1000;
  const diff = now - seconds;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

export function OrgActivityFeed() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<'all' | ActivityType>('all');
  const [loading, setLoading] = useState(true);

  const orgDomain = user?.email?.split('@')[1] || '';

  useEffect(() => {
    if (!firestore || !orgDomain) return;

    const colRef = collection(firestore, 'activity_log');
    const q = query(
      colRef,
      where('orgDomain', '==', orgDomain),
      orderBy('timestamp', 'desc'),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: ActivityItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ActivityItem[];
      setActivities(items);
      setLoading(false);
    }, (err) => {
      console.warn('[Activity Feed] Listener error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [firestore, orgDomain]);

  const filtered = filter === 'all'
    ? activities
    : activities.filter((a) => a.type === filter);

  return (
    <div className="h-full flex flex-col p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
            Activity
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">
            Last 24 hours across your team.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="text-xs font-semibold text-indigo-600 bg-transparent border-none outline-none cursor-pointer hover:text-indigo-800 transition-colors appearance-none pr-1"
        >
          <option value="all">All</option>
          <option value="login">Logins</option>
          <option value="grant_agent_created">Grant Agents</option>
          <option value="support_ticket_created">Tickets</option>
          <option value="action_board_created">Tasks</option>
          <option value="crm_entry_created">CRM</option>
        </select>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 mb-2 shrink-0" />

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FileText className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-xs text-slate-400 font-medium">No activity yet</p>
            <p className="text-[10px] text-slate-300 mt-0.5">Events will appear here as your team works.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50/70 transition-colors group"
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-slate-200/70 transition-colors">
                  {ICON_MAP[item.type] || <FileText className="w-4 h-4 text-slate-400" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-slate-700 font-medium leading-snug truncate" style={{ fontFamily: "'Inter', sans-serif" }}>
                    <span className="font-semibold text-slate-900">{item.userName}</span>{' '}
                    {item.description.replace(item.userName, '').trim() || item.type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {item.category}
                  </p>
                </div>

                {/* Time */}
                <span className="text-[11px] text-slate-400 font-medium shrink-0 mt-1 tabular-nums">
                  {item.timestamp ? timeAgo(item.timestamp.seconds) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
