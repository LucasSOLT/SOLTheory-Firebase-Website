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
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
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

const allowedDomains = ['@advancepathways.org', '@nxtchapter.org', '@soltheory.org'];

const createAccountSchema = z.object({
  email: z.string().email({ message: "Invalid email address." })
    .refine(email => allowedDomains.some(domain => email.toLowerCase().endsWith(domain)), {
        message: "Please use an organization email: @advancepathways.org, @nxtchapter.org, or @soltheory.org."
    }),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required.'),
});

export function AuthDialog() {
  const { isAuthDialogOpen, closeAuthDialog, openProfileSetupDialog } = useAuthStore();
  const auth = useAuth();
  const { toast } = useToast();

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
        message = 'This email address is already in use.';
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

  const handleCreateAccount = (values: z.infer<typeof createAccountSchema>) => {
    initiateEmailSignUp(auth, values.email, values.password)
        .then(() => {
            closeAuthDialog();
            openProfileSetupDialog();
        })
        .catch(handleAuthError);
  };

  const handleLogin = (values: z.infer<typeof loginSchema>) => {
    initiateEmailSignIn(auth, values.email, values.password)
      .then(() => {
        closeAuthDialog();
        toast({ title: 'Logged in successfully!' });
      })
      .catch(handleAuthError);
  };
  
  const onDialogOpenChange = (open: boolean) => {
    if (!open) {
      createAccountForm.reset();
      loginForm.reset();
      closeAuthDialog();
    }
  }

  return (
    <Dialog open={isAuthDialogOpen} onOpenChange={onDialogOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log In</TabsTrigger>
            <TabsTrigger value="create">Create Account</TabsTrigger>
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
                To access surveys, you must register with an organization email (UPN). Accepted domains are @advancepathways.org, @nxtchapter.org, and @soltheory.org.
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
