'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useAuth } from '@/firebase';
import { initiateEmailSignIn, initiatePasswordReset } from '@/firebase/non-blocking-login';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AuthError } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import React from 'react';
import { ShieldCheck, Mail, Lock } from 'lucide-react';

const allowedDomains = ['@advancepathways.org', '@nxtchapter.org', '@soltheory.com'];

// Only allowing login, creation is handled via Firebase Console
const allowedDomains = ['@advancepathways.org', '@nxtchapter.org', '@soltheory.com'];

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required.'),
});

export function AuthDialog() {
  const { isAuthDialogOpen, closeAuthDialog, openProfileSetupDialog, redirectPath, setRedirectPath, defaultToRegister, setDefaultToRegister } = useAuthStore();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    if (isAuthDialogOpen) {
      setActiveTab('login');
    }
  }, [isAuthDialogOpen]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleAuthError = (error: AuthError) => {
    let message = 'An unknown error occurred.';
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        message = 'Invalid email or password.';
        break;
      case 'auth/email-already-in-use':
        message = 'An account with this email already exists. Please log in instead.';
        setActiveTab('login');
        break;
      case 'auth/weak-password':
        message = 'The password is too weak.';
        break;
      default:
        message = error.message;
        break;
    }
    toast({
      variant: 'destructive',
      title: 'Authentication Failed',
      description: message,
    });
  };

  const handlePasswordReset = () => {
    const email = loginForm.getValues('email');
    if (!email || !z.string().email().safeParse(email).success) {
      toast({
        variant: 'destructive',
        title: 'Invalid Email',
        description: 'Please enter a valid email address to reset your password.',
      });
      return;
    }

    initiatePasswordReset(auth, email)
      .then(() => {
        toast({
          title: 'Check Your Email',
          description: `If an account exists for ${email}, a password reset link has been sent.`,
        });
      })
      .catch((error: AuthError) => {
        toast({
          title: 'Check Your Email',
          description: `If an account exists for ${email}, a password reset link has been sent.`,
        });
      });
  };

  const onLoginSuccess = () => {
    closeAuthDialog();
    if (redirectPath) {
        router.push(redirectPath);
        setRedirectPath(null);
    } else {
        toast({ title: 'Logged in successfully!' });
    }
  };



  const handleLogin = (values: z.infer<typeof loginSchema>) => {
    initiateEmailSignIn(auth, values.email, values.password)
      .then(onLoginSuccess)
      .catch(handleAuthError);
  };
  
  const onDialogOpenChange = (open: boolean) => {
    if (!open) {
      loginForm.reset();
      closeAuthDialog();
    }
  }

  return (
    <Dialog open={isAuthDialogOpen} onOpenChange={onDialogOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-black dark:bg-white" />
        
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
              <ShieldCheck className="w-6 h-6 text-black dark:text-white" />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

            
            <TabsContent value="login" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
              <DialogHeader className="mb-6 text-center">
                <DialogTitle className="text-2xl font-bold tracking-tight text-black dark:text-white">Welcome Back</DialogTitle>
                <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                  Access your secure workspace.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 dark:text-zinc-300 font-medium">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input 
                              placeholder="name@example.com" 
                              className="pl-9 h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus-visible:ring-black dark:focus-visible:ring-white rounded-lg text-black dark:text-white"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 dark:text-zinc-300 font-medium">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input 
                              type="password" 
                              placeholder="••••••••"
                              className="pl-9 h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus-visible:ring-black dark:focus-visible:ring-white rounded-lg text-black dark:text-white"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 text-xs" />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-1">
                    <Button variant="link" type="button" onClick={handlePasswordReset} className="p-0 h-auto text-xs font-semibold text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                      Forgot password?
                    </Button>
                  </div>
                  <Button type="submit" className="w-full h-11 mt-2 bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 rounded-lg font-semibold transition-colors" disabled={loginForm.formState.isSubmitting}>
                    {loginForm.formState.isSubmitting ? 'Authenticating...' : 'Sign In'}
                  </Button>
                </form>
              </Form>
            </TabsContent>


          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
