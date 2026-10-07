import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Loader2, Users, Plus, ShieldCheck, ClipboardCheck, Bell, Sparkles } from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';

export type OnboardingTab = 'roadmaps' | 'blueprints' | 'vault' | 'reviews';

interface OnboardingHeaderProps {
  orgId: string;
  isDarkMode: boolean;
  isAdmin: boolean;
  activeTab: OnboardingTab;
  onTabChange?: (tab: OnboardingTab) => void;
  onOnboardNewHire?: () => void;
  pendingReviewCount?: number;
  actions?: React.ReactNode;
}

export default function OnboardingHeader({
  orgId,
  isDarkMode,
  isAdmin,
  activeTab,
  onTabChange,
  onOnboardNewHire,
  pendingReviewCount = 0,
  actions,
}: OnboardingHeaderProps) {
  const router = useRouter();
  const [isGlobalNudging, setIsGlobalNudging] = useState(false);
  const [globalNudgeMessage, setGlobalNudgeMessage] = useState<string | null>(null);

  const handleRunGlobalNudges = async () => {
    setIsGlobalNudging(true);
    setGlobalNudgeMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/cron/nudges', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json();
      if (res.ok) {
        setGlobalNudgeMessage(`Bobby dispatched ${data.sentCount || 0} reminder email(s)!`);
      } else {
        setGlobalNudgeMessage(data.error || 'Failed to dispatch nudges');
      }
    } catch (err: any) {
      setGlobalNudgeMessage(err.message || 'Error triggering nudges');
    } finally {
      setIsGlobalNudging(false);
      setTimeout(() => setGlobalNudgeMessage(null), 5000);
    }
  };

  const handleTabClick = (tab: OnboardingTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      if (tab === 'blueprints') {
        router.push(`/portal/dashboard/${orgId}/onboarding/blueprints`);
      } else if (tab === 'vault') {
        router.push(`/portal/dashboard/${orgId}/onboarding/vault`);
      } else if (tab === 'roadmaps') {
        router.push(`/portal/dashboard/${orgId}/onboarding`);
      } else if (tab === 'reviews') {
        router.push(`/portal/dashboard/${orgId}/onboarding?tab=reviews`);
      }
    }
  };

  const getHeaderContent = () => {
    if (!isAdmin) {
      return {
        title: 'Onboarding',
        description: 'Complete your onboarding steps and get up to speed with your new role.'
      };
    }
    
    switch (activeTab) {
      case 'blueprints':
        return {
          title: 'Role Blueprints',
          description: 'Design and customize onboarding templates for your organization.'
        };
      case 'vault':
        return {
          title: 'Compliance Vault',
          description: 'Securely view and manage verified employee documents.'
        };
      case 'reviews':
        return {
          title: 'Review Queue',
          description: 'Review and verify document submissions from new hires.'
        };
      case 'roadmaps':
      default:
        return {
          title: 'Active Roadmaps',
          description: 'Track and manage new hire onboarding progress across your organization.'
        };
    }
  };

  const headerContent = getHeaderContent();

  return (
    <div className={`shrink-0 px-4 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200/80 bg-[#f5f1e8]'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2.5 tracking-tight">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
              <GraduationCap className="w-4 h-4" />
            </div>
            {headerContent.title}
          </h1>
          <p className={`mt-1 text-xs ml-[42px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {headerContent.description}
          </p>
        </div>

        {/* Admin buttons */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunGlobalNudges}
              disabled={isGlobalNudging}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all shadow-sm active:scale-[0.98] cursor-pointer border ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                  : 'bg-white hover:bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title="Bobby scans for approaching and overdue tasks to send friendly Gmail reminders"
            >
              {isGlobalNudging ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bell className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span className="hidden sm:inline">Run Bobby Nudges</span>
            </button>

            {onOnboardNewHire && (
              <button
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all shadow-sm active:scale-[0.98] cursor-pointer ${
                  isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
                onClick={onOnboardNewHire}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Onboard New Hire</span>
                <span className="sm:hidden">New</span>
              </button>
            )}
            
            {actions}
          </div>
        )}
      </div>

      {/* Bobby Nudges Feedback Pill */}
      {globalNudgeMessage && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{globalNudgeMessage}</span>
        </div>
      )}

      {/* Tab Bar (Admin Only) */}
      {isAdmin && (
        <div className="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
          <div className={`flex items-center gap-1 px-1 py-1 rounded-xl w-max ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-100/80'}`}>
            {([
              { key: 'roadmaps' as const, label: 'Active Roadmaps', icon: <Users className="w-3.5 h-3.5" /> },
              { key: 'blueprints' as const, label: 'Role Blueprints', icon: <GraduationCap className="w-3.5 h-3.5" /> },
              { key: 'vault' as const, label: 'Compliance Vault', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
              { key: 'reviews' as const, label: 'Review Queue', icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? (isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm')
                    : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.key === 'reviews' && pendingReviewCount > 0 && (
                  <span className={`ml-1 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-black rounded-full px-1 ${
                    activeTab === 'reviews'
                      ? 'bg-amber-500 text-white'
                      : (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
                  }`}>
                    {pendingReviewCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
