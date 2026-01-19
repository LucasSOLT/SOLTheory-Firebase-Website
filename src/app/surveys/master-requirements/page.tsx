
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Loader2, Trash2, ArrowLeft } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
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
  manager: z.string().optional(),
  selfContext: z.string().optional(),
  willingnessToAI: z.string().optional(),
  technicalKnowledge: z.string().optional(),
  canReachOut: z.string().optional(),
  email: z.string().optional(),

  databaseOrigin: requiredString,
  databaseOriginOther: z.string().optional(),
  primaryEntities: z.string().optional(),
  userRoles: z.string().optional(),
  technicalAptitude: requiredString,
  technicalAptitudeOther: z.string().optional(),
  dataInputMethod: requiredString,
  revenueBarrier: requiredString,
  revenueBarrierOther: z.string().optional(),
  missedOpportunities: requiredString,
  missedOpportunitiesOther: z.string().optional(),
  cashflowVisibility: requiredString,
  cashflowVisibilityOther: z.string().optional(),
  staffRetention: requiredString,
  staffRetentionOther: z.string().optional(),
  uselessTools: requiredString,
  uselessToolsOther: z.string().optional(),
  sourceOfChaos: requiredString,
  sourceOfChaosOther: z.string().optional(),
  approvalBottlenecks: requiredString,
  shadowSystems: requiredString,
  grantReportingEffort: requiredString,
  onboardingEfficiency: requiredString,
  paperProcesses: requiredString,
  busFactor: requiredString,
  taskToAutomate: z.string().optional(),
  meetingPreparedness: requiredString,
  repetitiveDataEntry: requiredString,
  clientIntakeExperience: requiredString,
  clientIntakeExperienceOther: z.string().optional(),
  timeOnReminders: requiredString,
  manualWorkarounds: requiredString,
  manualWorkaroundsOther: z.string().optional(),
  auditConfidence: requiredString,
  dataTrust: requiredString,
  desiredMetrics: z.string().optional(),
  reportingSpeed: requiredString,
  legalDocTracking: requiredString,
  mandatoryReporting: requiredString,
  dataPrivacy: requiredString,
  securityIncident: requiredString,
  clientFeedbackLoop: requiredString,
  inventoryManagement: requiredString,
  serviceEligibility: requiredString,
  clientAgingOut: requiredString,
  caseManagerAssignment: requiredString,
  employerDatabase: requiredString,
  postPlacementTracking: requiredString,
  telehealthUsability: requiredString,
  externalAccess: requiredString,
  magicButtonMetric: z.string().optional(),
  launchSuccess: requiredString,
  launchSuccessOther: z.string().optional(),
  projectFear: z.string().optional(),
  automationAnxiety: requiredString,
  automationAnxietyOther: z.string().optional(),
  legacyGoal: z.string().optional(),
  dreamFeature: z.string().optional(),
  departmentCommunication: requiredString,
  volunteerDataPolicy: requiredString,
  immediatePriorities: z.string().optional(),
  finalThoughts: z.string().optional(),
  submitted: z.boolean().optional(),
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

const SURVEY_ID = 'master-requirements';

const defaultFormValues: SurveyFormValues = {
  name: '',
  position: '',
  manager: '',
  selfContext: '',
  willingnessToAI: '',
  technicalKnowledge: '',
  canReachOut: '',
  email: '',
  databaseOrigin: '',
  databaseOriginOther: '',
  primaryEntities: '',
  userRoles: '',
  technicalAptitude: '',
  technicalAptitudeOther: '',
  dataInputMethod: '',
  revenueBarrier: '',
  revenueBarrierOther: '',
  missedOpportunities: '',
  missedOpportunitiesOther: '',
  cashflowVisibility: '',
  cashflowVisibilityOther: '',
  staffRetention: '',
  staffRetentionOther: '',
  uselessTools: '',
  uselessToolsOther: '',
  sourceOfChaos: '',
  sourceOfChaosOther: '',
  approvalBottlenecks: '',
  shadowSystems: '',
  grantReportingEffort: '',
  onboardingEfficiency: '',
  paperProcesses: '',
  busFactor: '',
  taskToAutomate: '',
  meetingPreparedness: '',
  repetitiveDataEntry: '',
  clientIntakeExperience: '',
  clientIntakeExperienceOther: '',
  timeOnReminders: '',
  manualWorkarounds: '',
  manualWorkaroundsOther: '',
  auditConfidence: '',
  dataTrust: '',
  desiredMetrics: '',
  reportingSpeed: '',
  legalDocTracking: '',
  mandatoryReporting: '',
  dataPrivacy: '',
  securityIncident: '',
  clientFeedbackLoop: '',
  inventoryManagement: '',
  serviceEligibility: '',
  clientAgingOut: '',
  caseManagerAssignment: '',
  employerDatabase: '',
  postPlacementTracking: '',
  telehealthUsability: '',
  externalAccess: '',
  magicButtonMetric: '',
  launchSuccess: '',
  launchSuccessOther: '',
  projectFear: '',
  automationAnxiety: '',
  automationAnxietyOther: '',
  legacyGoal: '',
  dreamFeature: '',
  departmentCommunication: '',
  volunteerDataPolicy: '',
  immediatePriorities: '',
  finalThoughts: '',
  submitted: false,
};

function MasterRequirementsForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

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
      form.reset({ ...defaultFormValues, ...initialData });
       if (initialData.submitted) {
        setIsSubmitted(true);
      } else {
        setIsSubmitted(false);
      }
    } else {
      form.reset(defaultFormValues);
      setIsSubmitted(false);
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
    if (isSubmitted) return;
    const subscription = form.watch((value) => {
      debouncedSave(value as SurveyFormValues);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, debouncedSave, isSubmitted]);

  const onSubmit = (data: SurveyFormValues) => {
    if (surveyDocRef) {
        const dataWithSubmission = { ...data, submitted: true };
        setDocumentNonBlocking(surveyDocRef, dataWithSubmission, { merge: true });
    }
    toast({
      title: 'Survey Submitted!',
      description: 'Thank you for your detailed feedback. Your progress has been saved.',
    });
    setIsSubmitted(true);
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
            const item = el?.closest('.form-item-container');
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
    setIsSubmitted(false);
    toast({
        title: "Survey Reset",
        description: "Your responses have been cleared.",
    });
  }

  const renderQuestion = (name: keyof SurveyFormValues, label: string, options: string[], description?: string, otherName?: keyof SurveyFormValues, otherPlaceholder?: string) => (
    <FormField control={form.control} name={name} render={({ field }) => (
        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50 form-item-container">
          <FormLabel className="text-xl text-foreground">{label}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}
          <FormControl><div className="radio-group-container"><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2 pt-2">
              {options.map((option) => (
                <FormItem key={option} className="flex items-center space-x-3 space-y-0">
                  <FormControl><RadioGroupItem value={option} /></FormControl>
                  <FormLabel className="font-normal text-lg text-muted-foreground">{option}</FormLabel>
                </FormItem>
              ))}
          </RadioGroup></div></FormControl>
          {otherName && (
             <FormField control={form.control} name={otherName} render={({ field }) => (
                <FormItem><FormControl><Textarea placeholder={otherPlaceholder || "Please specify..."} {...field} className="bg-background/80 mt-2"/></FormControl><FormMessage /></FormItem>
            )} />
          )}
          <FormMessage />
        </FormItem>
    )} />
  );
  
  const renderTextarea = (name: keyof SurveyFormValues, label: string, placeholder: string, description?: string) => (
     <FormField control={form.control} name={name} render={({ field }) => (
        <FormItem className="p-4 rounded-lg bg-background/50">
            <FormLabel className="text-xl text-foreground">{label}</FormLabel>
            {description && <FormDescription className="text-base">{description}</FormDescription>}
            <FormControl><Textarea placeholder={placeholder} {...field} className="bg-background/80 mt-2"/></FormControl>
            <FormMessage />
        </FormItem>
    )} />
  );

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
                  Master Specification Survey
                </CardTitle>
                <CardDescription className="text-muted-foreground text-lg pt-2">
                  This is a detailed survey. Your progress is saved automatically.
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
                <fieldset disabled={isSubmitted}>
                {/* User Info Header */}
                  <Card className="bg-background/50 p-6">
                      <CardHeader>
                          <CardTitle>Your Information</CardTitle>
                          <CardDescription>This information helps us categorize feedback.</CardDescription>
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
                           <FormField control={form.control} name="manager" render={({ field }) => (
                              <FormItem><FormLabel className="text-lg">Your manager/supervisor</FormLabel><FormControl><Input placeholder="Manager's Name" {...field} /></FormControl><FormMessage /></FormItem>
                           )} />
                           <FormField control={form.control} name="selfContext" render={({ field }) => (
                              <FormItem><FormLabel className="text-lg">Any context about yourself you think we'd need to know</FormLabel><FormControl><Textarea placeholder="e.g., I'm the head of department, I oversee Y..." {...field} /></FormControl><FormMessage /></FormItem>
                           )} />
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
                                  <FormItem><FormLabel className="text-lg">Email (if you said yes!)</FormLabel><FormControl><Input placeholder="jane.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                          </div>
                      </CardContent>
                  </Card>
                  
                  <div className="space-y-12">
                    {/* Section 1 */}
                    <div>
                      <h2 className="font-headline text-3xl mb-6 text-foreground">Section 1: Database & Architecture</h2>
                      <div className="space-y-8">
                        {renderQuestion('databaseOrigin', '1. Are we building a new database from scratch, or do we need to integrate with an existing one?', ['From Scratch', 'Integrate with Existing', 'Unsure', 'Unsure, but I know someone who might know'], undefined, 'databaseOriginOther', "If integrating, please name the existing system.")}
                        {renderTextarea('primaryEntities', '2. Primary \'Nouns\' (Entities): Please list the core \'nouns\' your organization tracks.', 'e.g., Clients, Donors, Staff, Classes, Parole Officers, Volunteers, Job Placements')}
                        {renderTextarea('userRoles', '3. User Roles & Access: Who will be using this system? List the primary job roles and what they should be able to do.', 'e.g., "Case Managers can see client files but not financial data."')}
                        {renderQuestion('technicalAptitude', '4. What is the general technical comfort level of the staff who will be using this system?', ['Very comfortable, little training needed', 'Average, will need some training', 'Not comfortable, will require significant training'], undefined, 'technicalAptitudeOther')}
                        {renderQuestion('dataInputMethod', '5. How do you envision data getting into the system?', ['Primarily manual entry by staff', 'Primarily through an AI assistant that suggests entries', 'A mix of both'])}
                      </div>
                    </div>

                    <Separator className="my-8 bg-border/50" />
                    <div>
                      <h2 className="font-headline text-3xl mb-6 text-foreground">Section 2: Financial & Operational Stability</h2>
                      <div className="space-y-8">
                        {renderQuestion('revenueBarrier', '6. What is the biggest obstacle to your revenue goals?', ['Not enough leads/donors', 'Not enough time for follow-up', 'Inefficient billing process'], undefined, 'revenueBarrierOther')}
                        {renderQuestion('missedOpportunities', '7. How often do you feel potential revenue (donations, billable hours) is lost because of system inefficiencies?', ['Daily', 'Weekly', 'Monthly', 'Rarely'], undefined, 'missedOpportunitiesOther', "Can you give an example?")}
                        {renderQuestion('cashflowVisibility', '8. How would you describe your real-time visibility into your organization\'s cash flow?', ['We have a real-time dashboard', 'We rely on end-of-month reports', 'It\'s a mystery until the bank statement arrives'], undefined, 'cashflowVisibilityOther')}
                        {renderQuestion('staffRetention', '9. What is the most common reason staff give for leaving?', ['High workload/burnout', 'Frustration with processes/tools', 'Compensation', 'Lack of growth opportunities'], undefined, 'staffRetentionOther')}
                        {renderQuestion('uselessTools', '10. Is there a specific software or service you pay for that you feel provides little value?', ['Yes, and it\'s expensive', 'Yes, but it\'s cheap', 'No, everything we use is valuable'], undefined, 'uselessToolsOther', 'If yes, which tool?')}
                      </div>
                    </div>

                    <Separator className="my-8 bg-border/50" />
                    <div>
                      <h2 className="font-headline text-3xl mb-6 text-foreground">Section 3: Workflow & Efficiency</h2>
                      <div className="space-y-8">
                          {renderQuestion('sourceOfChaos', '11. What causes more daily disruption to your workflow?', ['External factors (client crises, changing regulations)', 'Internal factors (process issues, miscommunication)', 'Both equally'], undefined, 'sourceOfChaosOther', 'Can you provide an example of a recent disruption?')}
                          {renderQuestion('approvalBottlenecks', '12. How often does work stop because someone is waiting for an approval or signature?', ['Multiple times a day', 'Daily', 'Weekly', 'Rarely'])}
                          {renderQuestion('shadowSystems', '13. Do staff rely on personal spreadsheets, notebooks, or other "unofficial" tools to do their jobs?', ['Yes, it\'s essential for them to function', 'Yes, but only for minor things', 'No, everyone uses the official system'])}
                          {renderQuestion('grantReportingEffort', '14. How would you describe the effort required for grant reporting?', ['It\'s a manual fire drill every time', 'It takes several hours of pulling data', 'It\'s mostly automated', 'We don\'t do grant reporting'])}
                          {renderQuestion('onboardingEfficiency', '15. How quickly can a new employee get full access to all the necessary software?', ['Same day', 'Within a few days', 'A week or more'])}
                          {renderQuestion('paperProcesses', '16. Are critical forms still filled out on paper?', ['Yes, many of them', 'Yes, a few of them', 'No, we are fully digital'])}
                          {renderQuestion('busFactor', '17. If a key employee quit tomorrow, how would it impact operations?', ['Critical operations would stop', 'It would be a major headache but we\'d manage', 'We have documented processes and could recover quickly'])}
                          {renderTextarea('taskToAutomate', '18. If you could wave a magic wand and automate ONE task, what would it be?', 'Please be specific about the task.')}
                          {renderQuestion('meetingPreparedness', '19. How often do staff feel unprepared for a client meeting because they lack the latest information?', ['Often', 'Sometimes', 'Rarely', 'Never'])}
                          {renderQuestion('repetitiveDataEntry', '20. How often do staff enter the same client information into multiple systems?', ['Constantly (3+ systems)', 'Occasionally (2 systems)', 'Never'])}
                          {renderQuestion('clientIntakeExperience', '21. From a client\'s perspective, what is the most frustrating part of the intake process?', ['The process is too long', 'Having to repeat information', 'The paperwork is confusing', 'The process is generally smooth'], undefined, 'clientIntakeExperienceOther', 'Please describe any other frustrations.')}
                          {renderQuestion('timeOnReminders', '22. How much of a case manager\'s week is spent just sending reminders to clients?', ['5+ hours (a significant portion)', '2-4 hours', 'Less than 1 hour'])}
                          {renderQuestion('manualWorkarounds', '23. Do staff have to "trick" the current system to get it to do what they need?', ['Yes, all the time', 'Yes, for certain tasks', 'No, the system works as expected'], undefined, 'manualWorkaroundsOther', 'Please describe a workaround.')}
                      </div>
                    </div>
                    
                    <Separator className="my-8 bg-border/50" />
                    <div>
                      <h2 className="font-headline text-3xl mb-6 text-foreground">Section 4: Data, Reporting & Legal</h2>
                      <div className="space-y-8">
                          {renderQuestion('auditConfidence', '24. On a scale of 1-10, how ready are you for a surprise audit of your client files and financial records?', ['1-3 (Not at all ready)', '4-6 (Somewhat ready)', '7-9 (Mostly ready)', '10 (Perfectly ready, bring it on)'])}
                          {renderQuestion('dataTrust', '25. When you look at your current reports, how much do you trust the data?', ['I have to manually double-check everything', 'I trust most of it but verify key numbers', 'I trust it completely'])}
                          {renderTextarea('desiredMetrics', '26. What is one metric or insight you wish you could easily track but currently can\'t?', 'e.g., "Average time from intake to housing placement"')}
                          {renderQuestion('reportingSpeed', '27. If the board requested a key outcome report for a meeting tomorrow, how long would it take to prepare?', ['A full day or more', 'A few hours', 'Less than an hour', 'It\'s a one-click report'])}
                          {renderQuestion('legalDocTracking', '28. Does your system need to track expiration dates for client documents (e.g., IDs, certifications) and send alerts?', ['Yes, this is a critical need', 'This would be a nice-to-have feature', 'No, this is not a priority'])}
                          {renderQuestion('mandatoryReporting', '29. Does the system need to automatically flag situations that may require mandatory reporting to authorities?', ['Yes, this is a legal requirement', 'This would be a helpful safety feature', 'No, this is handled manually'])}
                          {renderQuestion('dataPrivacy', '30. Are there legal or privacy requirements to keep certain client populations\' data (e.g., youth vs. adult) strictly separated?', ['Yes, data segregation is essential', 'I\'m not sure, but it\'s a possibility we should plan for', 'No, all client data can be stored together'])}
                          {renderQuestion('securityIncident', '31. Have you ever had an incident where sensitive client information was accidentally shared incorrectly (e.g., wrong email recipient)?', ['Yes, it has happened', 'Not to my knowledge, but it\'s a major concern', 'No, our current process is secure'])}
                          {renderQuestion('clientFeedbackLoop', '32. What happens to client feedback after it\'s collected?', ['It\'s consistently reviewed and used to improve services', 'It\'s collected but not always reviewed or acted upon', 'We don\'t have a formal client feedback process'])}
                      </div>
                    </div>

                     <Separator className="my-8 bg-border/50" />
                    <div>
                      <h2 className="font-headline text-3xl mb-6 text-foreground">Section 5: Client & Service Management</h2>
                      <div className="space-y-8">
                          {renderQuestion('inventoryManagement', '33. When a physical item (like a hygiene kit) is given to a client, how is inventory tracked?', ['Manually in a spreadsheet or log book', 'It is not formally tracked', 'We need an automated system to track this'])}
                          {renderQuestion('serviceEligibility', '34. Does the system need to enforce limits on services? (e.g., "Max 2 bus passes per month per client")', ['Yes, we have hard rules that need enforcement', 'We prefer to handle this on a case-by-case basis', 'No, we don\'t have limits'])}
                          {renderQuestion('clientAgingOut', '35. If a client\'s eligibility changes due to age (e.g., a youth turns 18), how should the system handle it?', ['Automatically transition them to the relevant adult program', 'Flag the client for a manual review by a case manager', 'Allow them to complete their current program regardless of age'])}
                          {renderQuestion('caseManagerAssignment', '36. How are new clients assigned to case managers?', ['Based on case manager specialty or client need', 'Based on current workload/capacity to ensure even distribution', 'Randomly or manually by an administrator'])}
                          {renderQuestion('employerDatabase', '37. Do you need a database of "friendly" employers to match clients with jobs?', ['Yes, and we want automatic matching based on client skills', 'Yes, just a simple database to store employer information', 'No, this is not a feature we need'])}
                          {renderQuestion('postPlacementTracking', '38. How important is it to automatically track a client\'s job retention at 30, 60, and 90 days?', ['Critical for our reporting and outcomes', 'Nice to have for long-term tracking', 'Not a current priority'])}
                          {renderQuestion('telehealthUsability', '39. How often do clients struggle with the technology for telehealth sessions?', ['Frequently, it\'s a common barrier', 'Sometimes, but they usually figure it out', 'Rarely, our clients are comfortable with the technology'])}
                          {renderQuestion('externalAccess', '40. Do external parties (like guardians or parole officers) need a login portal to view client progress?', ['Yes, a secure portal is necessary', 'No, sending email/PDF reports is sufficient'])}
                      </div>
                    </div>
                    
                    <Separator className="my-8 bg-border/50" />
                    <div>
                      <h2 className="font-headline text-3xl mb-6 text-foreground">Section 6: Vision & Culture</h2>
                      <div className="space-y-8">
                          {renderTextarea('magicButtonMetric', '41. The "Magic Button": If you could press one button and get one real-time number about your organization, what would it be?', 'e.g., "Real-time client satisfaction score," "Current total donations this month"')}
                          {renderQuestion('launchSuccess', '42. For this project, what does a successful launch look like in the first 30 days?', ['Staff have adopted it smoothly and are happy', 'We have already saved a significant amount of time', 'A key metric (e.g., client intake time) has improved', 'It works reliably without major bugs'], undefined, 'launchSuccessOther')}
                          {renderTextarea('projectFear', '43. What is your biggest concern or "nightmare scenario" for this project?', 'e.g., "Staff refuse to use it," "We spend the money and it doesn\'t solve the core problem"')}
                          {renderQuestion('automationAnxiety', '44. What is the level of anxiety among staff about AI/automation replacing parts of their jobs?', ['High anxiety - there is a lot of fear', 'Some concern - people are curious but worried', 'Low/no concern - staff are excited about the help'], undefined, 'automationAnxietyOther')}
                          {renderTextarea('legacyGoal', '45. What is the most important operational process you want to be perfectly automated when you eventually move on from your role?', 'e.g., "A self-sustaining donor engine," "A fully automated billing department"')}
                          {renderTextarea('dreamFeature', '46. What one "dream feature" in a new system would make your staff cheer out loud?', 'e.g., "Automatically transcribing and summarizing case notes from a recording"')}
                          {renderQuestion('departmentCommunication', '47. How would you rate communication and data sharing between key departments (e.g., clinical and fundraising)?', ['Excellent, they are always in sync', 'Okay, but information gets lost sometimes', 'Poor, they operate in separate silos'])}
                          {renderQuestion('volunteerDataPolicy', '48. Are there clear, enforced rules about what data volunteers can and cannot see?', ['Yes, we have a strict, written policy that is enforced', 'It\'s generally understood but not formally documented', 'No, this is a gray area that needs to be defined'])}
                          {renderTextarea('immediatePriorities', '49. What are your top 1-2 priorities for automation in the next 3 months?', 'This helps us prioritize "quick wins."')}
                          {renderTextarea('finalThoughts', '50. Final Thoughts: Is there anything else, big or small, you want the development team to know?', 'Your feedback is incredibly valuable.')}
                      </div>
                    </div>
                  </div>
                </fieldset>
                <Button type="submit" size="lg" className="w-full h-12 text-lg mt-12" disabled={isSubmitted || form.formState.isSubmitting}>
                  {isSubmitted ? "Submitted" : form.formState.isSubmitting ? "Submitting..." : "Submit Survey"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function MasterRequirementsSurveyPage() {
    return <AuthGuard><MasterRequirementsForm /></AuthGuard>;
}
