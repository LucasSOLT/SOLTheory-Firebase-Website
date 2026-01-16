'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';

const surveySchema = z.object({
  // Section 1
  databaseOrigin: z.string().optional(),
  databaseOriginOther: z.string().optional(),
  primaryEntities: z.string().optional(),
  userRoles: z.string().optional(),
  technicalAptitude: z.string().optional(),
  technicalAptitudeOther: z.string().optional(),
  dataInputMethod: z.string().optional(),
  // Section 2
  revenueBarrier: z.string().optional(),
  revenueBarrierOther: z.string().optional(),
  missedOpportunities: z.string().optional(),
  missedOpportunitiesOther: z.string().optional(),
  cashflowVisibility: z.string().optional(),
  cashflowVisibilityOther: z.string().optional(),
  staffRetention: z.string().optional(),
  staffRetentionOther: z.string().optional(),
  uselessTools: z.string().optional(),
  uselessToolsOther: z.string().optional(),
  // Section 3
  sourceOfChaos: z.string().optional(),
  sourceOfChaosOther: z.string().optional(),
  approvalBottlenecks: z.string().optional(),
  shadowSystems: z.string().optional(),
  grantReportingEffort: z.string().optional(),
  onboardingEfficiency: z.string().optional(),
  paperProcesses: z.string().optional(),
  busFactor: z.string().optional(),
  taskToAutomate: z.string().optional(),
  meetingPreparedness: z.string().optional(),
  repetitiveDataEntry: z.string().optional(),
  clientIntakeExperience: z.string().optional(),
  clientIntakeExperienceOther: z.string().optional(),
  timeOnReminders: z.string().optional(),
  manualWorkarounds: z.string().optional(),
  manualWorkaroundsOther: z.string().optional(),
  // Section 4
  auditConfidence: z.string().optional(),
  dataTrust: z.string().optional(),
  desiredMetrics: z.string().optional(),
  reportingSpeed: z.string().optional(),
  legalDocTracking: z.string().optional(),
  mandatoryReporting: z.string().optional(),
  dataPrivacy: z.string().optional(),
  securityIncident: z.string().optional(),
  clientFeedbackLoop: z.string().optional(),
  // Section 5
  inventoryManagement: z.string().optional(),
  serviceEligibility: z.string().optional(),
  clientAgingOut: z.string().optional(),
  caseManagerAssignment: z.string().optional(),
  employerDatabase: z.string().optional(),
  postPlacementTracking: z.string().optional(),
  telehealthUsability: z.string().optional(),
  externalAccess: z.string().optional(),
  // Section 6
  magicButtonMetric: z.string().optional(),
  launchSuccess: z.string().optional(),
  launchSuccessOther: z.string().optional(),
  projectFear: z.string().optional(),
  automationAnxiety: z.string().optional(),
  automationAnxietyOther: z.string().optional(),
  legacyGoal: z.string().optional(),
  dreamFeature: z.string().optional(),
  departmentCommunication: z.string().optional(),
  volunteerDataPolicy: z.string().optional(),
  immediatePriorities: z.string().optional(),
  finalThoughts: z.string().optional(),
});

type SurveyFormValues = z.infer<typeof surveySchema>;

function MasterRequirementsForm() {
  const { toast } = useToast();

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(surveySchema),
    defaultValues: {},
  });

  function onSubmit(data: SurveyFormValues) {
    console.log('Survey submitted:', data);
    toast({
      title: 'Survey Submitted!',
      description: 'Thank you for your detailed feedback. We will be in touch.',
    });
    // In a real scenario, you'd probably redirect or show a thank you message
    // form.reset();
  }

  const renderQuestion = (
    name: keyof SurveyFormValues,
    label: string,
    options: string[],
    description?: string,
    otherName?: keyof SurveyFormValues,
    otherPlaceholder?: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
          <FormLabel className="text-xl text-foreground">{label}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              defaultValue={field.value}
              className="flex flex-col space-y-2 pt-2"
            >
              {options.map((option) => (
                <FormItem key={option} className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <RadioGroupItem value={option} />
                  </FormControl>
                  <FormLabel className="font-normal text-lg text-muted-foreground">{option}</FormLabel>
                </FormItem>
              ))}
            </RadioGroup>
          </FormControl>
          {otherName && (
             <FormField
                control={form.control}
                name={otherName}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Textarea placeholder={otherPlaceholder || "Please specify..."} {...field} className="bg-background/80 mt-2"/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
  
  const renderTextarea = (
    name: keyof SurveyFormValues,
    label: string,
    placeholder: string,
    description?: string
  ) => (
     <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
            <FormItem className="p-4 rounded-lg bg-background/50">
                <FormLabel className="text-xl text-foreground">{label}</FormLabel>
                 {description && <FormDescription className="text-base">{description}</FormDescription>}
                <FormControl>
                    <Textarea placeholder={placeholder} {...field} className="bg-background/80 mt-2"/>
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
  )


  return (
    <div className="min-h-screen w-full py-12 px-4">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="font-headline text-4xl text-primary">
            Master Specification Survey
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground max-w-none text-lg space-y-4">
             <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Please Note</AlertTitle>
              <AlertDescription>
                This is a detailed survey. User accounts and the ability to save your progress are coming soon. For now, please be prepared to complete this in one session.
              </AlertDescription>
            </Alert>
            <p>
              This survey is the blueprint for your new digital assistant. Your detailed answers will directly shape the tools we build to automate repetitive tasks, eliminate bottlenecks, and provide strategic insights. Please be as specific as possible.
            </p>
          </div>
          
          <Separator className="my-8 bg-border/50" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
              
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

             {/* Section 2 */}
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

              {/* Section 3 */}
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
              
              {/* Section 4 */}
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

               {/* Section 5 */}
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
              
              {/* Section 6 */}
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

              <Button type="submit" size="lg" className="w-full h-12 text-lg mt-12">Submit Survey</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MasterRequirementsSurveyPage() {
    return <AuthGuard><MasterRequirementsForm /></AuthGuard>;
}
