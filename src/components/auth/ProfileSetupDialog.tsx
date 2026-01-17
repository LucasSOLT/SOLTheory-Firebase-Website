'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import type { WithId } from '@/firebase/firestore/use-collection';
import React from 'react';
import { Label } from '../ui/label';
import { useRouter } from 'next/navigation';

const profileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters.'),
  bio: z.string().max(160, 'Bio must be 160 characters or less.').optional(),
  profilePictureUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
});

interface InterestTag {
    name: string;
}

export function ProfileSetupDialog() {
  const { isProfileSetupDialogOpen, closeProfileSetupDialog, redirectPath, setRedirectPath } = useAuthStore();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const interestTagsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'interest_tags');
  }, [firestore]);
  const { data: interestTags } = useCollection<InterestTag>(interestTagsQuery);
  const [selectedTags, setSelectedTags] = React.useState<Set<string>>(new Set());

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: '',
      bio: '',
      profilePictureUrl: '',
    },
  });
  
  const { setValue } = form;

  React.useEffect(() => {
    if (user) {
        // Here you would fetch existing user profile data from Firestore
        // and populate the form. For now, we pre-fill from auth.
        setValue('username', user.displayName || '');
        setValue('profilePictureUrl', user.photoURL || '');
    }
  }, [user, setValue, isProfileSetupDialogOpen]);


  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'You must be logged in.' });
      return;
    }

    const userRef = doc(firestore, 'users', user.uid);
    const profileData = {
      id: user.uid,
      email: user.email,
      username: values.username,
      bio: values.bio,
      profilePictureUrl: values.profilePictureUrl,
      interestTagIds: Array.from(selectedTags),
    };

    setDocumentNonBlocking(userRef, profileData, { merge: true });
    
    toast({ title: 'Profile Updated!' });
    closeProfileSetupDialog();
    
    if (redirectPath) {
      router.push(redirectPath);
      setRedirectPath(null);
    }
  };

  const onDialogOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setSelectedTags(new Set());
      closeProfileSetupDialog();
    }
  }

  return (
    <Dialog open={isProfileSetupDialogOpen} onOpenChange={onDialogOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Setup Your Profile</DialogTitle>
          <DialogDescription>
            Tell us a bit about yourself. This will help others connect with you.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Your username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="profilePictureUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile Picture URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/image.png" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Tell us about yourself" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div>
                <Label>Interests</Label>
                <div className="flex flex-wrap gap-2 pt-2">
                    {interestTags?.map((tag: WithId<InterestTag>) => (
                        <Badge
                            key={tag.id}
                            variant={selectedTags.has(tag.id) ? 'default' : 'secondary'}
                            onClick={() => toggleTag(tag.id)}
                            className="cursor-pointer"
                        >
                            {tag.name}
                        </Badge>
                    ))}
                </div>
             </div>
            <DialogFooter>
              <Button type="submit">Save Profile</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
