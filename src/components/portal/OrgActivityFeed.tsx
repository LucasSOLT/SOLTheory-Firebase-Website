'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { FileText, LogIn, LogOut, Bot, Ticket, ClipboardList, Users, Clock, MessageSquare, Settings, Upload, Trash2, Edit, Plus, ExternalLink } from 'lucide-react';
import type { ActivityType } from '@/lib/activity-logger';
import { useTranslation } from '@/lib/i18n';
import { useDarkMode } from '@/lib/useDarkMode';
import { useRouter, usePathname } from 'next/navigation';

interface ActivityItem {
  id: string;
  type: ActivityType;
  userName: string;
  description: string;
  category: string;
  timestamp: { seconds: number; nanoseconds: number } | null;
}

const ICON_MAP: Partial<Record<ActivityType, React.ReactNode>> = {
  login: <LogIn className="w-4 h-4 text-slate-400" />,
  logout: <LogOut className="w-4 h-4 text-slate-400" />,
  grant_agent_created: <Bot className="w-4 h-4 text-slate-400" />,
  grant_agent_deleted: <Bot className="w-4 h-4 text-slate-400" />,
  grant_agent_started: <Bot className="w-4 h-4 text-slate-400" />,
  grant_agent_stopped: <Bot className="w-4 h-4 text-slate-400" />,
  support_ticket_created: <Ticket className="w-4 h-4 text-slate-400" />,
  support_ticket_replied: <MessageSquare className="w-4 h-4 text-slate-400" />,
  action_board_created: <ClipboardList className="w-4 h-4 text-slate-400" />,
  action_board_updated: <Edit className="w-4 h-4 text-slate-400" />,
  action_board_deleted: <Trash2 className="w-4 h-4 text-slate-400" />,
  crm_entry_created: <Users className="w-4 h-4 text-slate-400" />,
  crm_entry_updated: <Edit className="w-4 h-4 text-slate-400" />,
  timesheet_entry_created: <Clock className="w-4 h-4 text-slate-400" />,
  timesheet_customer_created: <Users className="w-4 h-4 text-slate-400" />,
  timesheet_service_created: <Settings className="w-4 h-4 text-slate-400" />,
  ai_chat_sent: <MessageSquare className="w-4 h-4 text-slate-400" />,
  settings_changed: <Settings className="w-4 h-4 text-slate-400" />,
  file_uploaded: <Upload className="w-4 h-4 text-slate-400" />,
  file_deleted: <Trash2 className="w-4 h-4 text-slate-400" />,
  item_created: <Plus className="w-4 h-4 text-slate-400" />,
  item_deleted: <Trash2 className="w-4 h-4 text-slate-400" />,
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
  const { t } = useTranslation();
  const firestore = useFirestore();
  const { user } = useUser();
  const isDarkMode = useDarkMode();
  const router = useRouter();
  const pathname = usePathname();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<'all' | ActivityType>('all');
  const [loading, setLoading] = useState(true);

  const isNxtChapter = pathname.includes('/nxtchapter');
  const dashboardHome = isNxtChapter ? '/portal/dashboard/nxtchapter' : '/portal/dashboard/soltheory';

  const orgDomain = user?.email?.split('@')[1] || '';

  useEffect(() => {
    if (!firestore || !orgDomain) return;
    let fallbackUnsub: (() => void) | null = null;

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
      console.warn('[Activity Feed] Index query failed, using fallback:', err.message);
      // Fallback: no where clause, filter client-side
      const fallbackQ = query(colRef, orderBy('timestamp', 'desc'), limit(200));
      fallbackUnsub = onSnapshot(fallbackQ, (snap) => {
        const filtered: ActivityItem[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.orgDomain === orgDomain) {
            filtered.push({ id: d.id, ...data } as ActivityItem);
          }
        });
        setActivities(filtered.slice(0, 50));
        setLoading(false);
      }, () => setLoading(false));
    });

    return () => {
      unsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [firestore, orgDomain]);

  const filtered = filter === 'all'
    ? activities
    : activities.filter((a) => a.type === filter);

  return (
    <div className="h-full flex flex-col p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 shrink-0">
        <div>
          <h3 className={`text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
            {t.activity}
          </h3>
          <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {t.last24Hours}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className={`text-xs font-semibold bg-transparent border-none outline-none cursor-pointer transition-colors appearance-none pr-1 ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
          >
            <option value="all">{t.all}</option>
            <option value="login">{t.logins}</option>
            <option value="grant_agent_created">{t.grantAgents}</option>
            <option value="support_ticket_created">{t.tickets}</option>
            <option value="action_board_created">{t.tasks}</option>
            <option value="crm_entry_created">{t.crm}</option>
            <option value="timesheet_entry_created">{t.timesheets}</option>
            <option value="ai_chat_sent">{t.aiChat}</option>
          </select>
          <button
            onClick={() => router.push(`${dashboardHome}/timesheets`)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-350 hover:text-white' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900'
            }`}
            title="Timesheets"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => router.push(`${dashboardHome}/activity-log`)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-350 hover:text-white' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900'
            }`}
            title="Activity Log"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className={`h-px mb-2 shrink-0 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`} />

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isDarkMode ? 'border-slate-600 border-t-indigo-400' : 'border-slate-200 border-t-indigo-500'}`} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FileText className={`w-8 h-8 mb-2 ${isDarkMode ? 'text-slate-600' : 'text-slate-200'}`} />
            <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.noActivityYet}</p>
            <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>{t.eventsWillAppear}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 px-2 py-2.5 rounded-lg transition-colors group ${isDarkMode ? 'hover:bg-slate-800/70' : 'hover:bg-[#faf6ed]/70'}`}
              >
                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700' : 'bg-slate-100 group-hover:bg-slate-200/70'}`}>
                  {ICON_MAP[item.type] || <FileText className="w-4 h-4 text-slate-400" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium leading-snug truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.userName}</span>{' '}
                    {item.description.replace(item.userName, '').trim() || item.type.replace(/_/g, ' ')}
                  </p>
                  <p className={`text-[10px] font-medium mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {item.category}
                  </p>
                </div>

                {/* Time */}
                <span className={`text-[11px] font-medium shrink-0 mt-1 tabular-nums ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
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
