'use client';

import React, { useEffect } from 'react';
import { useUser } from '@/firebase';
import { useAuthStore } from '@/hooks/use-auth-store';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isUserLoading } = useUser();
  const { openAuthDialog } = useAuthStore();

  useEffect(() => {
    if (!isUserLoading && !user) {
      // Open dialog, default to register, and set redirect path
      openAuthDialog(window.location.pathname, true);
    }
  }, [isUserLoading, user, openAuthDialog]);

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-headline text-3xl font-bold text-white">Authentication Required</h2>
          <p className="mt-2 text-muted-foreground">
            Please log in or create an account to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
