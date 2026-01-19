
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldErrors } from 'react-hook-form';
import * as z from 'zod';
import React, { useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';
import { debounce } from 'lodash';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Loader2, Trash2, ArrowLeft } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';

const requiredString = z.string().min(1, 'Please select an option.');

const surveySchema = z.object({
  name: z.string().optional(),
  position: z.string().optional(),
  willingnessToAI: z.string().optional(),
  technicalKnowledge: z.string().optional(),
  canReachOut: z.string().optional(),
  email: z.string().optional(),
  
  copyPasteTest: requiredString,
  copyPasteOffenders: z.string().optional(),
  treasureHunt: requiredString,
  reminderTreadmill: requiredString,
  signatureChase: requiredString,
  signatureChaseWho: z.string().optional(),
  didntKnowProblem: requiredString,
  grantReporting: requiredString,
  cheatSheet: requiredString,
  paperTrail: requiredString,
  workaround: z.string().optional(),
  magicWand: z.string().optional(),
  missionMultiplier: requiredString,
  missionMultiplierOther: z.string().optional(),
  clientJourney: z.string().optional(),
  finalThoughts: z.string().optional(),
}).refine(data => {
    if (data.canReachOut === 'Yes' && !z.string().email().safeParse(data.email).success) {
      return false;
    }
    return true;
}, {
    message: 'A valid email is required if we can reach out.',
    path: ['email'],
});

type SurveyFormValues = z.infer<typeof surveySchema>;

const SURVEY_ID = 'helping-us-help-you';

const defaultFormValues: SurveyFormValues = {
  name: '',
  position: '',
  willingnessToAI: '',
  technicalKnowledge: '',
  canReachOut: '',
  email: '',
  copyPasteTest: '',
  copyPasteOffenders: '',
  treasureHunt: '',
  reminderTreadmill: '',
  signatureChase: '',
  signatureChaseWho: '',
  didntKnowProblem: '',
  grantReporting: '',
  cheatSheet: '',
  paperTrail: '',
  workaround: '',
  magicWand: '',
  missionMultiplier: '',
  missionMultiplierOther: '',
  clientJourney: '',
  finalThoughts: '',
};

function HelpingUsHelpYouForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const formRef = useRef<HTMLFormElement>(null);

  const surveyDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'survey_responses', SURVEY_ID);
  }, [user, firestore]);

  const { data: initialData, isLoading: isDataLoading } = useDoc<SurveyFormValues>(surveyDocRef);

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(surveySchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  const debouncedSave = useCallback(
    debounce((data: SurveyFormValues) => {
      if (surveyDocRef) {
        setDocumentNonBlocking(surveyDocRef, data, { merge: true });
      }
    }, 1500),
    [surveyDocRef]
  );

  useEffect(() => {
    const subscription = form.watch((value) => {
      // The `isDirty` flag inside the watcher can be unreliable.
      // We rely on the `debounce` to prevent excessive writes.
      // The `useDoc` listener will reset the form with new data, which
      // will correctly set `isDirty` to false. Any subsequent user input
      // will make it dirty and trigger this watcher.
      debouncedSave(value as SurveyFormValues);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, debouncedSave]);

  const onSubmit = (data: SurveyFormValues) => {
    if (surveyDocRef) {
        setDocumentNonBlocking(surveyDocRef, data, { merge: true });
    }
    toast({
      title: 'Survey Submitted!',
      description: 'Thank you for your valuable feedback. Your progress has been saved.',
    });
  }

  const onError = (errors: FieldErrors<SurveyFormValues>) => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
        const firstErrorKey = errorKeys[0];
        const errorElement = document.getElementsByName(firstErrorKey)[0];
        if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        errorKeys.forEach(key => {
            const el = document.getElementsByName(key)[0];
            const item = el?.closest('.form-item-container'); // Custom class needed
            if(item) {
                item.classList.add('flash-error');
                setTimeout(() => item.classList.remove('flash-error'), 3000);
            }
        });
    }
    toast({
        variant: "destructive",
        title: "Incomplete Survey",
        description: "Please fill out all required multiple choice questions.",
    });
  }

  const handleReset = () => {
    form.reset(defaultFormValues);
    if(surveyDocRef) {
        setDocumentNonBlocking(surveyDocRef, {}, { merge: false });
    }
    toast({
        title: "Survey Reset",
        description: "Your responses have been cleared.",
    });
  }
  
  if (isDataLoading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
      )
  }

  return (
    <>
      <style jsx global>{`
        .form-item-container.flash-error .radio-group-container {
            border-radius: 0.5rem;
            border: 2px solid red;
            animation: flash-border 3s ease-out;
        }
        @keyframes flash-border {
            0%, 100% { border-color: red; }
            50% { border-color: transparent; }
        }
      `}</style>
      <div className="min-h-screen w-full py-12 px-4">
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 max-w-4xl mx-auto">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="flex items-start gap-4">
              <Link href="/surveys" passHref>
                <Button variant="ghost" size="icon" className="mt-1">
                  <ArrowLeft className="h-6 w-6" />
                  <span className="sr-only">Back to Surveys</span>
                </Button>
              </Link>
              <div>
                <CardTitle className="font-headline text-4xl text-primary">
                  Helping Us Help You
                </CardTitle>
                <CardDescription className="text-muted-foreground text-lg pt-2 space-y-2">
                  <p>NXT Chapter is embarking on a new adventure: a project to automate administrative tasks, making your job easier and more effective.</p>
                  <p>We are using AI in a responsible, equitable, and safe way, guided by our ARISE Framework. This journey starts with information gathering, and that’s where we need your help.</p>
                  <p>Your honest feedback is critical to the project's success.</p>
                </CardDescription>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your current survey responses. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>Yes, Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form ref={formRef} onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-12">
                
                {/* User Info Header */}
                <Card className="bg-background/50 p-6">
                    <CardHeader>
                        <CardTitle>Your Information</CardTitle>
                        <CardDescription>This information helps us categorize feedback. All submissions are 100% anonymous.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                         <div className="grid md:grid-cols-2 gap-8">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel className="text-lg">Name</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="position" render={({ field }) => (
                                <FormItem><FormLabel className="text-lg">Position/Role</FormLabel><FormControl><Input placeholder="Case Manager" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                         </div>
                         <FormField control={form.control} name="willingnessToAI" render={({ field }) => (
                            <FormItem><FormLabel className="text-lg">Willingness to integrate AI into your workflow?</FormLabel>
                                <FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-2 pt-2">
                                    {Array.from({length: 10}, (_, i) => i + 1).map(n => <FormItem key={n} className="flex items-center space-x-1 space-y-0">
                                        <FormControl><RadioGroupItem value={String(n)} id={`willingness-${n}`} /></FormControl>
                                        <FormLabel htmlFor={`willingness-${n}`} className="font-normal">{n}</FormLabel>
                                    </FormItem>)}
                                </RadioGroup></FormControl><FormMessage />
                            </FormItem>
                         )} />
                         <FormField control={form.control} name="technicalKnowledge" render={({ field }) => (
                            <FormItem><FormLabel className="text-lg">Rate your technical knowledge (hardware, software, concepts)</FormLabel>
                                <FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-2 pt-2">
                                    {Array.from({length: 10}, (_, i) => i + 1).map(n => <FormItem key={n} className="flex items-center space-x-1 space-y-0">
                                        <FormControl><RadioGroupItem value={String(n)} id={`tech-${n}`} /></FormControl>
                                        <FormLabel htmlFor={`tech-${n}`} className="font-normal">{n}</FormLabel>
                                    </FormItem>)}
                                </RadioGroup></FormControl><FormMessage />
                            </FormItem>
                         )} />
                        <div className="grid md:grid-cols-2 gap-8 items-start">
                            <FormField control={form.control} name="canReachOut" render={({ field }) => (
                                <FormItem><FormLabel className="text-lg">Can we reach out with more questions? (We love data!)</FormLabel>
                                    <FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4 pt-2">
                                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                    </RadioGroup></FormControl><FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel className="text-lg">Email (Optional, unless you said yes!)</FormLabel><FormControl><Input placeholder="jane.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    </CardContent>
                </Card>
                
                {/* Part 1 */}
                <div>
                  <h2 className="font-headline text-3xl mb-6 text-foreground">Part 1: The "Time Vampires" (Repetitive Tasks)</h2>
                  <div className="space-y-8">
                    <FormField control={form.control} name="copyPasteTest" render={({ field }) => (
                        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
                          <FormLabel className="text-xl text-foreground">1. The "Copy-Paste" Test: Think about the data you enter for a new client. How often do you find yourself typing the same information (Name, DOB, ID #) into two or more different places?</FormLabel>
                          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Never" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Never</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Occasionally" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Occasionally (2 systems)</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Constantly" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Constantly (3+ systems/forms)</FormLabel></FormItem>
                          </RadioGroup></div></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="copyPasteOffenders" render={({ field }) => (
                        <FormItem><FormLabel className="text-lg text-foreground/80 pl-4">Optional: Which specific forms/systems are the worst offenders?</FormLabel><FormControl><Textarea placeholder="Tell us more..." {...field} className="bg-background/50"/></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="treasureHunt" render={({ field }) => (
                        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
                          <FormLabel className="text-xl text-foreground">2. The "Treasure Hunt": When you need to find a specific piece of information (e.g., "Did a client attend a class last Tuesday?"), how long does it usually take you?</FormLabel>
                          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Seconds" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Seconds (It’s one click away)</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Minutes" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Minutes (I have to dig through a few folders/tabs)</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Hours" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Hours (I usually have to email someone else to find out)</FormLabel></FormItem>
                          </RadioGroup></div></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="reminderTreadmill" render={({ field }) => (
                        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
                          <FormLabel className="text-xl text-foreground">3. The "Reminder" Treadmill: How much of your week is spent sending/awaiting responses on routine text messages or emails to clients just to remind them of appointments, class times, or document deadlines?</FormLabel>
                          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="None" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">None</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="1-2 hours" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">1-2 hours</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="3-5 hours" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">3-5 hours</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="5+ hours" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">5+ hours (I feel like a human calendar)</FormLabel></FormItem>
                          </RadioGroup></div></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                  </div>
                </div>

                <Separator className="my-8 bg-border/50" />
                <div>
                  <h2 className="font-headline text-3xl mb-6 text-foreground">Part 2: The "Bottleneck" Hunt (Workflow Dependencies)</h2>
                  <div className="space-y-8">
                    <FormField control={form.control} name="signatureChase" render={({ field }) => (
                        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
                          <FormLabel className="text-xl text-foreground">4. The "Signature" Chase: How often does a client’s progress stop because you are waiting for a specific approval, signature, or document from someone else (a manager, a partner agency, etc.)?</FormLabel>
                          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Rarely" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Rarely</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Weekly" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Weekly</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Daily" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Daily</FormLabel></FormItem>
                          </RadioGroup></div></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="signatureChaseWho" render={({ field }) => (
                        <FormItem><FormLabel className="text-lg text-foreground/80 pl-4">Who are you usually waiting on?</FormLabel><FormControl><Input placeholder="e.g., Manager, Partner Agency X" {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="didntKnowProblem" render={({ field }) => (
                        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
                          <FormLabel className="text-xl text-foreground">5. The "I Didn't Know" Problem: Have you ever walked into a meeting with a client or donor and felt unprepared because you didn't have the latest notes or history on them?</FormLabel>
                          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">No, our records are always up to date.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - access" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, sometimes the notes are in a file I couldn't access.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - unrecorded" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, often the information is in someone else’s head or notebook.</FormLabel></FormItem>
                          </RadioGroup></div></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="grantReporting" render={({ field }) => (
                        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
                          <FormLabel className="text-xl text-foreground">6. Grant Reporting Season: When it's time to report numbers for a grant (e.g., "Number of youths placed in jobs"), does the team panic?</FormLabel>
                          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">No, we push a button and the numbers appear.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Sort of" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Sort of, we have to double-check the math.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, it’s a fire drill of manually counting things in spreadsheets.</FormLabel></FormItem>
                          </RadioGroup></div></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                  </div>
                </div>

                <Separator className="my-8 bg-border/50" />
                <div>
                  <h2 className="font-headline text-3xl mb-6 text-foreground">Part 3: The "Shadow Systems" (Hidden Data)</h2>
                  <div className="space-y-8">
                    <FormField control={form.control} name="cheatSheet" render={({ field }) => (
                        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
                          <FormLabel className="text-xl text-foreground">7. The "Cheat Sheet" Confessional: Be honest: Do you keep a personal Excel sheet, a physical notebook, or a Word doc to track your clients because the official software is too slow or confusing?</FormLabel>
                          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">No, I use the official system for everything.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - personal" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, I have a "backup" system just for me.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - team" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, our whole team uses a shared Google Sheet instead of the official software.</FormLabel></FormItem>
                          </RadioGroup></div></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="paperTrail" render={({ field }) => (
                        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
                          <FormLabel className="text-xl text-foreground">8. The Paper Trail: Are there any forms (Intake, Consent, Job Verification) that you still have to print out, have signed with a pen, and then scan back into the computer?</FormLabel>
                          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">No, everything is digital (DocuSign, etc.).</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - few" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, a few forms.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - many" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, almost everything is paper first.</FormLabel></FormItem>
                          </RadioGroup></div></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="workaround" render={({ field }) => (
                        <FormItem className="p-4 rounded-lg bg-background/50"><FormLabel className="text-xl text-foreground">9. The "Workaround": Is there a specific task where you have to "trick" the current computer system to get it to do what you want? (e.g., putting notes in the "Address" field because there's no "Notes" field?)</FormLabel><FormControl><Textarea placeholder="Please describe..." {...field} className="bg-background/80 mt-2"/></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>
                
                <Separator className="my-8 bg-border/50" />
                <div>
                  <h2 className="font-headline text-3xl mb-6 text-foreground">Part 4: The "Magic Wand" (The Wishlist)</h2>
                  <div className="space-y-8">
                    <FormField control={form.control} name="magicWand" render={({ field }) => (
                        <FormItem className="p-4 rounded-lg bg-background/50"><FormLabel className="text-xl text-foreground">10. The 4:00 PM on Friday Question: If you could snap your fingers and permanently automate ONE task—so you never had to do it again—what would it be?</FormLabel><FormControl><Textarea placeholder="Describe the task..." {...field} className="bg-background/80 mt-2"/></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="missionMultiplier" render={({ field }) => (
                        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
                          <FormLabel className="text-xl text-foreground">11. The Mission Multiplier: If you got back 5 hours a week because you didn't have to do paperwork, how would you spend that time?</FormLabel>
                          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="More 1-on-1 time" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">More 1-on-1 time with clients.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Finding opportunities" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Finding more job opportunities for clients.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Preventing burnout" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Taking a breath/Preventing burnout.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Other" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Other:</FormLabel></FormItem>
                          </RadioGroup></div></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="missionMultiplierOther" render={({ field }) => (
                        <FormItem><FormControl><Input placeholder="If other, please specify" {...field} className="bg-background/50" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="clientJourney" render={({ field }) => (
                        <FormItem className="p-4 rounded-lg bg-background/50"><FormLabel className="text-xl text-foreground">12. Regarding client progress: What is the hardest part about tracking a client's journey? (e.g., Session attendance? Milestone completion? Subjective feedback? Eligibility for program stages?)</FormLabel><FormControl><Textarea placeholder="Describe the challenges..." {...field} className="bg-background/80 mt-2"/></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="finalThoughts" render={({ field }) => (
                        <FormItem className="p-4 rounded-lg bg-background/50"><FormLabel className="text-xl text-foreground">13. Final Thoughts: Is there anything else you want the tech team to know about how you work, or what worries you about a new system?</FormLabel><FormControl><Textarea placeholder="Your feedback is valuable..." {...field} className="bg-background/80 mt-2" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full h-12 text-lg" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Submitting..." : "Submit Survey"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}


export default function HelpingUsHelpYouSurveyPage() {
  return <AuthGuard><HelpingUsHelpYouForm /></AuthGuard>;
}
