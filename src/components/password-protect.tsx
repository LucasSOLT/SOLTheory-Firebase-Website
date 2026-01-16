"use client";

import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const CORRECT_PASSWORD = "Huff8998";

export function PasswordProtect({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const { toast } = useToast();

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      toast({
        variant: "destructive",
        title: "Incorrect Password",
        description: "Please try again.",
      });
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-8 bg-card/80 backdrop-blur-sm rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="font-headline text-3xl font-bold text-white">Password Required</h2>
          <p className="mt-2 text-muted-foreground">This content is protected. Please enter the password to continue.</p>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 text-base"
          />
          <Button type="submit" className="w-full h-12">
            Access Survey
          </Button>
        </form>
      </div>
    </div>
  );
}
