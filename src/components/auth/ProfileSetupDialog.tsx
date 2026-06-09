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
import { useFirestore, useUser, useStorage } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { logActivity } from '@/lib/activity-logger';
import { doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import React, { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { Label } from '../ui/label';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, Loader2, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const profileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters.'),
  bio: z.string().max(160, 'Bio must be 160 characters or less.').optional(),
  profilePictureUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
});

const SOL_THEORY_INTERESTS = [
  { id: 'positive-psychology', name: 'Positive Psychology' },
  { id: 'habit-engineering', name: 'Habit Engineering' },
  { id: 'flow-states', name: 'Flow States' },
  { id: 'cognitive-defusion', name: 'Cognitive Defusion' },
  { id: 'neuroplasticity', name: 'Neuroplasticity' },
  { id: 'biohacking', name: 'Biohacking' },
  { id: 'stoicism', name: 'Stoicism' },
  { id: 'content-creation', name: 'Content Creation' },
  { id: 'relationship-ai', name: 'Relationship AI' },
  { id: 'deep-work', name: 'Deep Work' },
  { id: 'mindfulness', name: 'Mindfulness & Meditation' },
  { id: 'somatic-healing', name: 'Somatic Healing' },
  { id: 'time-management', name: 'Time Management' },
  { id: 'creative-writing', name: 'Creative Writing' },
  { id: 'goal-setting', name: 'Goal Architecture' },
  { id: 'social-dynamics', name: 'Social Dynamics' },
  { id: 'fitness-nutrition', name: 'Fitness & Nutrition' },
  { id: 'financial-literacy', name: 'Financial Literacy' },
  { id: 'leadership', name: 'Leadership & Influence' },
  { id: 'digital-minimalism', name: 'Digital Minimalism' },
];

export function ProfileSetupDialog() {
  const { isProfileSetupDialogOpen, closeProfileSetupDialog, redirectPath, setRedirectPath } = useAuthStore();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const editorRef = useRef<any>(null);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: '',
      bio: '',
      profilePictureUrl: '',
    },
  });
  
  const { setValue, watch } = form;
  const currentAvatarUrl = watch('profilePictureUrl');

  React.useEffect(() => {
    if (user) {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate size (e.g. max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum avatar size is 5MB.' });
      return;
    }

    setUploadedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadCropped = () => {
    if (!editorRef.current || !user || !uploadedFile) return;
    try {
      setIsUploading(true);
      const canvas = editorRef.current.getImageScaledToCanvas();
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
           setIsUploading(false);
           return;
        }
        const fileExtension = uploadedFile.name.split('.').pop();
        const storageRef = ref(storage, `profile_pictures/${user.uid}/avatar.${fileExtension}`);
        
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        
        setValue('profilePictureUrl', downloadURL);
        setUploadedFile(null);
        setZoom(1);
        toast({ title: 'Avatar Uploaded Successfully!' });
        setIsUploading(false);
      }, 'image/jpeg');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload your profile picture.' });
      setIsUploading(false);
    }
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
    
    toast({ title: 'Profile Configured Successfully!' });
    logActivity(firestore, 'profile_updated', { email: user?.email || '', displayName: user?.displayName }, 'Completed profile setup');
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
      <DialogContent className="max-w-6xl w-[90vw] h-[85vh] p-0 overflow-hidden bg-[#0A0A0B] border-white/10 shadow-2xl">
        
        {/* Massive Ambient Background Glows */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-fuchsia-600/20 blur-[120px] rounded-full mix-blend-screen opacity-50" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[60%] bg-indigo-600/20 blur-[120px] rounded-full mix-blend-screen opacity-50" />
        </div>

        <div className="flex flex-col h-full relative z-10 p-6 md:p-10 pb-0">
          <DialogHeader className="mb-8">
            <DialogTitle className="font-headline text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Configure Your Node
            </DialogTitle>
            <DialogDescription className="text-lg text-slate-400 mt-2">
              Establish your identity within the SOL Theory ecosystem. Complete your profile to unlock network synergy.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-grow overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 flex-grow overflow-y-auto pr-4 custom-scrollbar">
                
                {/* LEFT COLUMN: Identity & Avatar */}
                <div className="space-y-8">
                  <div className="flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl relative group">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    
                    <div className="relative">
                      {uploadedFile ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="overflow-hidden rounded-full border-4 border-indigo-500/50 shadow-2xl w-40 h-40 relative">
                             <AvatarEditor
                               ref={editorRef}
                               image={uploadedFile}
                               width={160}
                               height={160}
                               border={0}
                               borderRadius={80}
                               color={[0, 0, 0, 0.6]}
                               scale={zoom}
                               rotate={0}
                               style={{ position: 'absolute', top: 0, left: 0 }}
                             />
                          </div>
                          <div className="w-full flex items-center gap-3">
                             <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Zoom</span>
                             <Slider 
                               value={[zoom]} 
                               min={1} 
                               max={3} 
                               step={0.1} 
                               onValueChange={(vals) => setZoom(vals[0])} 
                               className="flex-1"
                             />
                          </div>
                          <div className="flex gap-2 w-full mt-2">
                             <Button type="button" variant="ghost" onClick={() => { setUploadedFile(null); setZoom(1); }} className="flex-1 h-9 rounded-full text-slate-400 hover:text-white border border-white/10 shadow-inner hover:bg-white/5">Cancel</Button>
                             <Button type="button" onClick={handleUploadCropped} disabled={isUploading} className="flex-1 h-9 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-[0_0_15px_rgba(99,102,241,0.3)]">Save Crop</Button>
                          </div>
                        </div>
                      ) : (
                        <Avatar className="w-40 h-40 border-4 border-indigo-500/30 shadow-2xl">
                          <AvatarImage src={currentAvatarUrl} alt="Avatar" className="object-cover" />
                          <AvatarFallback className="bg-slate-900 text-6xl text-slate-700">
                            <UserIcon className="w-20 h-20" />
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <AnimatePresence>
                        {isUploading && (
                          <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 z-20 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm"
                          >
                            <Loader2 className="w-10 h-10 animate-spin text-fuchsia-400" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {!uploadedFile && (
                      <Button 
                        type="button" 
                        variant="secondary" 
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-6 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/50 rounded-full px-6 transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                      >
                        <UploadCloud className="w-4 h-4 mr-2" />
                        Upload Avatar
                      </Button>
                    )}
                  </div>

                  <div className="space-y-6 bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Network Handle (Username)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g. @sol_traveler" 
                              className="bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-fuchsia-500/50 rounded-xl"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Biography / Mission</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="What drives you? What are you building?" 
                              className="bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-fuchsia-500/50 h-32 resize-none rounded-xl"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN: Interests Matrix */}
                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl flex flex-col h-full">
                  <div className="mb-6">
                    <Label className="text-2xl font-headline text-white drop-shadow-md">Core Directives</Label>
                    <p className="text-slate-400 text-sm mt-1">Select the disciplines you are actively mastering in the SOL Theory network.</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 overflow-y-auto pb-4 pr-2 custom-scrollbar">
                      {SOL_THEORY_INTERESTS.map((tag) => {
                          const isSelected = selectedTags.has(tag.id);
                          return (
                            <motion.button
                              type="button"
                              key={tag.id}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleTag(tag.id)}
                              className={cn(
                                "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border flex items-center gap-2 relative overflow-hidden",
                                isSelected 
                                  ? "bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-100 shadow-[0_0_20px_rgba(217,70,239,0.3)]"
                                  : "bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/30"
                              )}
                            >
                                {isSelected && (
                                  <motion.div 
                                    initial={{ scale: 0 }} animate={{ scale: 1 }} 
                                    className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/20 to-indigo-500/20"
                                  />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-fuchsia-400" />}
                                  {tag.name}
                                </span>
                            </motion.button>
                          );
                      })}
                  </div>
                </div>

              </div>

              {/* FOOTER ACTION */}
              <div className="py-6 mt-6 border-t border-white/10 flex justify-end shrink-0">
                <Button 
                  type="submit" 
                  disabled={isUploading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-lg px-10 py-6 rounded-full shadow-[0_0_30px_rgba(79,70,229,0.4)] hover:shadow-[0_0_40px_rgba(79,70,229,0.6)] font-bold transition-all duration-300 hover:-translate-y-1"
                >
                  Confirm Registration
                </Button>
              </div>
            </form>
          </Form>

        </div>
      </DialogContent>
    </Dialog>
  );
}
