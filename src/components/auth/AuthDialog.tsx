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
import { initiateEmailSignIn, initiateEmailSignUp, initiatePasswordReset } from '@/firebase/non-blocking-login';
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

const allowedDomains = ['@advancepathways.org', '@nxtchapter.org', '@soltheory.com'];

const createAccountSchema = z.object({
  email: z.string().email({ message: "Invalid email address." })
    .refine(email => allowedDomains.some(domain => email.toLowerCase().endsWith(domain)), {
        message: "Please use a valid organization email."
    }),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required.'),
});

export function AuthDialog() {
  const { isAuthDialogOpen, closeAuthDialog, openProfileSetupDialog, redirectPath, setRedirectPath, defaultToRegister, setDefaultToRegister } = useAuthStore();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // State to control the active tab
  const [activeTab, setActiveTab] = React.useState(defaultToRegister ? 'create' : 'login');

  // Effect to sync active tab with the global store's preference
  React.useEffect(() => {
    if (isAuthDialogOpen) {
      setActiveTab(defaultToRegister ? 'create' : 'login');
    }
  }, [defaultToRegister, isAuthDialogOpen]);


  const createAccountForm = useForm<z.infer<typeof createAccountSchema>>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { email: '', password: '' },
  });

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
        // When email exists, switch to the login tab and pre-fill the email
        const email = createAccountForm.getValues('email');
        loginForm.setValue('email', email);
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
        // Even on error, we show a generic message to prevent email enumeration.
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
        setRedirectPath(null); // Reset path
    } else {
        toast({ title: 'Logged in successfully!' });
    }
  };

  const onCreateSuccess = () => {
      closeAuthDialog();
      // On creation, we first open profile setup. The redirect will be handled there.
      openProfileSetupDialog();
  };

  const handleCreateAccount = (values: z.infer<typeof createAccountSchema>) => {
    initiateEmailSignUp(auth, values.email, values.password)
        .then(onCreateSuccess)
        .catch(handleAuthError);
  };

  const handleLogin = (values: z.infer<typeof loginSchema>) => {
    initiateEmailSignIn(auth, values.email, values.password)
      .then(onLoginSuccess)
      .catch(handleAuthError);
  };
  
  const onDialogOpenChange = (open: boolean) => {
    if (!open) {
      createAccountForm.reset();
      loginForm.reset();
      closeAuthDialog();
      setDefaultToRegister(false); // Reset default tab
    }
  }

  return (
    <Dialog open={isAuthDialogOpen} onOpenChange={onDialogOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger 
              value="login"
              className="text-lg bg-white text-black data-[state=active]:bg-black data-[state=active]:text-white"
            >
              Log In
            </TabsTrigger>
            <TabsTrigger 
              value="create"
              className="text-lg bg-white text-black data-[state=active]:bg-black data-[state=active]:text-white"
            >
              Create Account
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <DialogHeader>
              <DialogTitle>Log In</DialogTitle>
              <DialogDescription>
                Access your account to continue your journey.
              </DialogDescription>
            </DialogHeader>
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 py-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end -mt-2">
                  <Button variant="link" type="button" onClick={handlePasswordReset} className="p-0 h-auto text-sm font-normal">
                    Forgot Password?
                  </Button>
                </div>
                <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                  {loginForm.formState.isSubmitting ? 'Logging in...' : 'Log In'}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="create">
            <DialogHeader>
              <DialogTitle>Create Account</DialogTitle>
              <DialogDescription>
                To access surveys, you must register with a valid organization email address. Please use your company email to create an account.
              </DialogDescription>
            </DialogHeader>
            <Form {...createAccountForm}>
              <form onSubmit={createAccountForm.handleSubmit(handleCreateAccount)} className="space-y-4 py-4">
                <FormField
                  control={createAccountForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@your-organization.org" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createAccountForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createAccountForm.formState.isSubmitting}>
                  {createAccountForm.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
