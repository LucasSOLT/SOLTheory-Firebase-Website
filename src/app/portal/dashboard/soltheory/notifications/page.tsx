'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useUser } from '@/firebase';
import {
  ArrowLeft,
  Bell,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  desc: string;
  time: number;
  type: string;
  link?: string;
}

function getIcon(type: string) {
  switch (type) {
    case 'heartbeat':
      return (
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 shrink-0">
          <RefreshCw className="w-4 h-4 text-blue-600" />
        </div>
      );
    case 'task':
      return (
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
      );
    case 'dm':
      return (
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-100 shrink-0">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 shrink-0">
          <Bell className="w-4 h-4 text-slate-600" />
        </div>
      );
  }
}

export default function NotificationsPage() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const uid = user?.uid;

  const loadData = useCallback(() => {
    try {
      const raw = localStorage.getItem('st_all_notifications');
      const parsed: Notification[] = raw ? JSON.parse(raw) : [];
      setNotifications(parsed);
    } catch {
      setNotifications([]);
    }

    if (uid) {
      try {
        const rawRead = localStorage.getItem(`read_notifications_${uid}`);
        const parsedRead: string[] = rawRead ? JSON.parse(rawRead) : [];
        setReadIds(new Set(parsedRead));
      } catch {
        setReadIds(new Set());
      }
    }

    setLoaded(true);
  }, [uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markAsRead = (id: string) => {
    if (!uid) return;
    const updated = new Set(readIds);
    updated.add(id);
    setReadIds(updated);
    localStorage.setItem(
      `read_notifications_${uid}`,
      JSON.stringify(Array.from(updated))
    );
  };

  const clearAll = () => {
    localStorage.removeItem('st_all_notifications');
    if (uid) {
      localStorage.removeItem(`read_notifications_${uid}`);
    }
    setNotifications([]);
    setReadIds(new Set());
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/portal/dashboard/soltheory"
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Notifications
            </h1>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {notifications.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mb-4">
              <Bell className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              No notifications yet
            </p>
            <p className="text-xs text-slate-400">
              When something happens, you&apos;ll see it here.
            </p>
          </div>
        ) : (
          /* Notification List */
          <div className="flex flex-col gap-2">
            {notifications.map((n) => {
              const isUnread = !readIds.has(n.id);

              const card = (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className="flex items-start gap-3 p-3.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {getIcon(n.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {n.title}
                      </p>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {n.desc}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(n.time).toLocaleString()}</p>
                  </div>
                </div>
              );

              if (n.link) {
                return (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => markAsRead(n.id)}
                    className="block"
                  >
                    {card}
                  </Link>
                );
              }

              return card;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
