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

const surveySchema = z.object({
  copyPasteTest: z.string().optional(),
  copyPasteOffenders: z.string().optional(),
  treasureHunt: z.string().optional(),
  reminderTreadmill: z.string().optional(),
  signatureChase: z.string().optional(),
  signatureChaseWho: z.string().optional(),
  didntKnowProblem: z.string().optional(),
  grantReporting: z.string().optional(),
  cheatSheet: z.string().optional(),
  paperTrail: z.string().optional(),
  workaround: z.string().optional(),
  magicWand: z.string().optional(),
  missionMultiplier: z.string().optional(),
  missionMultiplierOther: z.string().optional(),
  clientJourney: z.string().optional(),
  finalThoughts: z.string().optional(),
});

type SurveyFormValues = z.infer<typeof surveySchema>;

function HelpingUsHelpYouForm() {
  const { toast } = useToast();

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(surveySchema),
    defaultValues: {},
  });

  function onSubmit(data: SurveyFormValues) {
    console.log('Survey submitted:', data);
    toast({
      title: 'Survey Submitted!',
      description: 'Thank you for your valuable feedback.',
    });
    form.reset();
  }

  return (
    <div className="min-h-screen w-full py-12 px-4">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="font-headline text-4xl text-primary">
            Helping Us Help You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground max-w-none text-lg space-y-4">
            <p>Hi Team,</p>
            <p>
              We know you are here to change lives, not to fight with spreadsheets or stare at loading screens.
            </p>
            <p>
              We are currently designing a new set of digital tools to support the organization. Our goal is 
              simple: We want to build a "Digital Assistant" that handles the boring, repetitive parts 
              of your job so you can spend more time focusing on what truly matters: your clients.
            </p>
            <p>
              To build the right tools, we need to know exactly where the "pain points" are in your day. 
              Please be brutally honest—there are no wrong answers, and "venting" about broken 
              processes is actually incredibly helpful data for us!
            </p>
            <p>Thank you for everything you do.</p>
          </div>
          
          <Separator className="my-8 bg-border/50" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
              
              {/* Part 1 */}
              <div>
                <h2 className="font-headline text-3xl mb-6 text-foreground">Part 1: The "Time Vampires" (Repetitive Tasks)</h2>
                <div className="space-y-8">
                  <FormField
                    control={form.control}
                    name="copyPasteTest"
                    render={({ field }) => (
                      <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
                        <FormLabel className="text-xl text-foreground">1. The "Copy-Paste" Test: Think about the data you enter for a new client. How often do you find yourself typing the same information (Name, DOB, ID #) into two or more different places?</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-2 pt-2"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="Never" /></FormControl>
                              <FormLabel className="font-normal text-lg text-muted-foreground">Never</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="Occasionally" /></FormControl>
                              <FormLabel className="font-normal text-lg text-muted-foreground">Occasionally (2 systems)</FormLabel>
                            </FormItem>
                             <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="Constantly" /></FormControl>
                              <FormLabel className="font-normal text-lg text-muted-foreground">Constantly (3+ systems/forms)</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                      control={form.control}
                      name="copyPasteOffenders"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel className="text-lg text-foreground/80 pl-4">Optional: Which specific forms/systems are the worst offenders?</FormLabel>
                              <FormControl>
                                  <Textarea placeholder="Tell us more..." {...field} className="bg-background/50"/>
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                    control={form.control}
                    name="treasureHunt"
                    render={({ field }) => (
                      <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
                        <FormLabel className="text-xl text-foreground">2. The "Treasure Hunt": When you need to find a specific piece of information (e.g., "Did John attend the class last Tuesday?" or "What is a current contact email?"), how long does it usually take you?</FormLabel>
                        <FormControl>
                           <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2 pt-2">
                             <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Seconds" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Seconds (It’s one click away)</FormLabel></FormItem>
                             <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Minutes" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Minutes (I have to dig through a few folders/tabs)</FormLabel></FormItem>
                             <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Hours" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Hours (I usually have to email someone else to find out)</FormLabel></FormItem>
                           </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reminderTreadmill"
                    render={({ field }) => (
                      <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
                        <FormLabel className="text-xl text-foreground">3. The "Reminder" Treadmill: How much of your week is spent sending/awaiting responses on routine text messages or emails to clients just to remind them of appointments, class times, or document deadlines?</FormLabel>
                        <FormControl>
                           <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2 pt-2">
                             <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="None" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">None</FormLabel></FormItem>
                             <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="1-2 hours" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">1-2 hours</FormLabel></FormItem>
                             <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="3-5 hours" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">3-5 hours</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="5+ hours" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">5+ hours (I feel like a human calendar)</FormLabel></FormItem>
                           </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

             {/* Part 2 */}
              <Separator className="my-8 bg-border/50" />
              <div>
                <h2 className="font-headline text-3xl mb-6 text-foreground">Part 2: The "Bottleneck" Hunt (Workflow Dependencies)</h2>
                <div className="space-y-8">
                  <FormField
                    control={form.control}
                    name="signatureChase"
                    render={({ field }) => (
                      <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
                        <FormLabel className="text-xl text-foreground">4. The "Signature" Chase: How often does a client’s progress stop because you are waiting for a specific approval, signature, or document from someone else (a manager, a partner agency, etc.)?</FormLabel>
                         <FormControl>
                           <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Rarely" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Rarely</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Weekly" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Weekly</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Daily" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Daily</FormLabel></FormItem>
                           </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                      control={form.control}
                      name="signatureChaseWho"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel className="text-lg text-foreground/80 pl-4">Who are you usually waiting on?</FormLabel>
                              <FormControl>
                                  <Input placeholder="e.g., Manager, Partner Agency X" {...field} className="bg-background/50" />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                    control={form.control}
                    name="didntKnowProblem"
                    render={({ field }) => (
                      <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
                        <FormLabel className="text-xl text-foreground">5. The "I Didn't Know" Problem: Have you ever walked into a meeting with a client or donor and felt unprepared because you didn't have the latest notes or history on them?</FormLabel>
                         <FormControl>
                           <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">No, our records are always up to date.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - access" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, sometimes the notes are in a file I couldn't access.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - unrecorded" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, often the information is in someone else’s head or notebook.</FormLabel></FormItem>
                           </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="grantReporting"
                    render={({ field }) => (
                      <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
                        <FormLabel className="text-xl text-foreground">6. Grant Reporting Season: When it's time to report numbers for a grant (e.g., "Number of youths placed in jobs"), does the team panic?</FormLabel>
                         <FormControl>
                           <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">No, we push a button and the numbers appear.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Sort of" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Sort of, we have to double-check the math.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, it’s a fire drill of manually counting things in spreadsheets.</FormLabel></FormItem>
                           </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

             {/* Part 3 */}
             <Separator className="my-8 bg-border/50" />
              <div>
                <h2 className="font-headline text-3xl mb-6 text-foreground">Part 3: The "Shadow Systems" (Hidden Data)</h2>
                <div className="space-y-8">
                  <FormField
                    control={form.control}
                    name="cheatSheet"
                    render={({ field }) => (
                      <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
                        <FormLabel className="text-xl text-foreground">7. The "Cheat Sheet" Confessional: Be honest: Do you keep a personal Excel sheet, a physical notebook, or a Word doc to track your clients because the official software is too slow or confusing?</FormLabel>
                         <FormControl>
                           <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">No, I use the official system for everything.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - personal" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, I have a "backup" system just for me.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - team" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, our whole team uses a shared Google Sheet instead of the official software.</FormLabel></FormItem>
                           </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paperTrail"
                    render={({ field }) => (
                      <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
                        <FormLabel className="text-xl text-foreground">8. The Paper Trail: Are there any forms (Intake, Consent, Job Verification) that you still have to print out, have signed with a pen, and then scan back into the computer?</FormLabel>
                         <FormControl>
                           <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">No, everything is digital (DocuSign, etc.).</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - few" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, a few forms.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes - many" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Yes, almost everything is paper first.</FormLabel></FormItem>
                           </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                      control={form.control}
                      name="workaround"
                      render={({ field }) => (
                          <FormItem className="p-4 rounded-lg bg-background/50">
                              <FormLabel className="text-xl text-foreground">9. The "Workaround": Is there a specific task where you have to "trick" the current computer system to get it to do what you want? (e.g., putting notes in the "Address" field because there's no "Notes" field?)</FormLabel>
                              <FormControl>
                                  <Textarea placeholder="Please describe..." {...field} className="bg-background/80 mt-2"/>
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                </div>
              </div>
              
              {/* Part 4 */}
              <Separator className="my-8 bg-border/50" />
              <div>
                <h2 className="font-headline text-3xl mb-6 text-foreground">Part 4: The "Magic Wand" (The Wishlist)</h2>
                <div className="space-y-8">
                  <FormField
                      control={form.control}
                      name="magicWand"
                      render={({ field }) => (
                          <FormItem className="p-4 rounded-lg bg-background/50">
                              <FormLabel className="text-xl text-foreground">10. The 4:00 PM on Friday Question: If you could snap your fingers and permanently automate ONE task—so you never had to do it again—what would it be?</FormLabel>
                              <FormControl>
                                  <Textarea placeholder="Describe the task..." {...field} className="bg-background/80 mt-2"/>
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                    control={form.control}
                    name="missionMultiplier"
                    render={({ field }) => (
                      <FormItem className="space-y-3 p-4 rounded-lg bg-background/50">
                        <FormLabel className="text-xl text-foreground">11. The Mission Multiplier: If you got back 5 hours a week because you didn't have to do paperwork, how would you spend that time?</FormLabel>
                         <FormControl>
                           <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-2 pt-2">
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="More 1-on-1 time" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">More 1-on-1 time with clients.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Finding opportunities" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Finding more job opportunities for clients.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Preventing burnout" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Taking a breath/Preventing burnout.</FormLabel></FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Other" /></FormControl><FormLabel className="font-normal text-lg text-muted-foreground">Other:</FormLabel></FormItem>
                           </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                      control={form.control}
                      name="missionMultiplierOther"
                      render={({ field }) => (
                          <FormItem>
                              <FormControl>
                                  <Input placeholder="If other, please specify" {...field} className="bg-background/50" />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="clientJourney"
                      render={({ field }) => (
                          <FormItem className="p-4 rounded-lg bg-background/50">
                              <FormLabel className="text-xl text-foreground">12. Regarding client progress: What is the hardest part about tracking a client's journey? (e.g., Session attendance? Milestone completion? Subjective feedback? Eligibility for program stages?)</FormLabel>
                              <FormControl>
                                  <Textarea placeholder="Describe the challenges..." {...field} className="bg-background/80 mt-2"/>
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="finalThoughts"
                      render={({ field }) => (
                          <FormItem className="p-4 rounded-lg bg-background/50">
                              <FormLabel className="text-xl text-foreground">13. Final Thoughts: Is there anything else you want the tech team to know about how you work, or what worries you about a new system?</FormLabel>
                              <FormControl>
                                  <Textarea placeholder="Your feedback is valuable..." {...field} className="bg-background/80 mt-2" />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full h-12 text-lg">Submit Survey</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}


export default function HelpingUsHelpYouSurveyPage() {
  return <HelpingUsHelpYouForm />;
}
