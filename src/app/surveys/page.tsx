'use client';

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Lock, Copy, Home, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc, type DocumentReference } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';

export default function SurveysPage() {
  const { toast } = useToast();
  const { openAuthDialog } = useAuthStore();
  const { user } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const helpingUsHelpYouDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'survey_responses', 'helping-us-help-you');
  }, [user, firestore]);
  const { data: helpingUsHelpYouData } = useDoc(helpingUsHelpYouDocRef);

  const masterRequirementsDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'survey_responses', 'master-requirements');
  }, [user, firestore]);
  const { data: masterRequirementsData } = useDoc(masterRequirementsDocRef);
  
  const showResumeHelping = user && helpingUsHelpYouData && Object.keys(helpingUsHelpYouData).length > 1 && !helpingUsHelpYouData.submitted;
  const showResumeMaster = user && masterRequirementsData && Object.keys(masterRequirementsData).length > 1 && !masterRequirementsData.submitted;

  const handleCopyLink = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Copied Link!',
        description: 'The survey link has been copied to your clipboard.',
      });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      toast({
        variant: "destructive",
        title: 'Copy Failed',
        description: 'Could not copy link to clipboard.',
      });
    });
  };

  const handleBeginSurvey = (path: string, surveyDocRef: DocumentReference | null, isSubmitted?: boolean) => {
    if (!user) {
      openAuthDialog(path, true);
      return;
    }

    // If the survey has been submitted and the user wants to "redo" it,
    // clear the previous submission data before navigating.
    if (isSubmitted && surveyDocRef) {
      setDocumentNonBlocking(surveyDocRef, {}, { merge: false });
      toast({
        title: 'Survey Reset',
        description: 'You can now fill out the survey again.',
      });
    }
    
    router.push(path);
  }

  return (
    <div className="min-h-screen w-full py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-start mb-8">
            <Link href="/" passHref>
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </Link>
        </div>
        <div className="text-center mb-12">
          <h1 className="font-headline text-5xl md:text-6xl font-bold text-white">
            NXT Chapter Diagnostics
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            These surveys help us understand your needs and build the best tools
            for your team. Please log in to begin.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Active Survey */}
          <Card className="bg-card/80 border-primary/50 backdrop-blur-sm p-4 text-left transition-all duration-300 hover:border-primary hover:scale-[1.02] flex flex-col col-span-1 md:col-span-1">
            <CardHeader>
              <CardTitle className="font-headline text-2xl text-primary mb-2 font-bold">
                Helping Us Help You
              </CardTitle>
            </CardHeader>
            <CardDescription className="flex-grow text-muted-foreground text-lg">
              A survey for team members to identify daily pain points and
              time-consuming tasks. Your feedback is crucial for automation.
            </CardDescription>
            <CardFooter className="mt-4 flex flex-col gap-4">
              <Button className="w-full" onClick={() => handleBeginSurvey('/surveys/helping-us-help-you', helpingUsHelpYouDocRef, helpingUsHelpYouData?.submitted)}>
                {isClient && helpingUsHelpYouData?.submitted
                  ? 'Redo survey?'
                  : isClient && showResumeHelping
                  ? 'Resume Survey'
                  : 'Begin Survey'}
                {isClient && (
                  helpingUsHelpYouData?.submitted ? (
                    <RefreshCw className="ml-2 h-4 w-4" />
                  ) : (
                    <ArrowRight className="ml-2" />
                  )
                )}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleCopyLink('/surveys/helping-us-help-you')}>
                  <Copy />
                  <span>Copy Link</span>
              </Button>
            </CardFooter>
          </Card>

          {/* Reserved Surveys */}
          <Card className="bg-card/60 border-border/30 backdrop-blur-sm p-4 text-left flex flex-col col-span-1 md:col-span-2">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-headline text-2xl text-foreground/80 mb-2 font-bold">
                            Master Requirements
                        </CardTitle>
                        <CardDescription className="text-muted-foreground/80 text-lg">
                            A comprehensive specification survey to define the architecture and logic of the new system.
                        </CardDescription>
                    </div>
                    <Badge variant="secondary">Reserved</Badge>
                </div>
            </CardHeader>
            <CardFooter className="mt-auto pt-4 flex flex-col gap-4">
                 <div className="flex items-center text-sm text-muted-foreground/60 w-full">
                    <Lock className="mr-2 h-4 w-4" />
                    <span>Reserved for Upper Management or a SME</span>
                </div>
                 <Button className="w-full" onClick={() => handleBeginSurvey('/surveys/master-requirements', masterRequirementsDocRef, masterRequirementsData?.submitted)}>
                    {isClient && masterRequirementsData?.submitted
                      ? 'Redo survey?'
                      : isClient && showResumeMaster
                      ? 'Resume Survey'
                      : 'Begin Survey'}
                    {isClient && (
                      masterRequirementsData?.submitted ? (
                        <RefreshCw className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowRight className="ml-2" />
                      )
                    )}
                </Button>
                 <Button variant="outline" className="w-full" onClick={() => handleCopyLink('/surveys/master-requirements')}>
                    <Copy />
                    <span>Copy Link</span>
                </Button>
            </CardFooter>
          </Card>
          
           <Card className="bg-card/60 border-border/30 backdrop-blur-sm p-4 text-left flex flex-col col-span-1 md:col-span-3">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-headline text-2xl text-foreground/80 mb-2 font-bold">
                            Technical Requirements
                        </CardTitle>
                        <CardDescription className="text-muted-foreground/80 text-lg">
                           A survey for the technical team to outline infrastructure, security, and integration points.
                        </CardDescription>
                    </div>
                    <Badge variant="secondary">Reserved</Badge>
                </div>
            </CardHeader>
            <CardFooter className="mt-auto pt-4 flex flex-col gap-4">
                 <div className="flex items-center text-sm text-muted-foreground/60 w-full">
                    <Lock className="mr-2 h-4 w-4" />
                     <span>Reserved for Upper Management or a SME</span>
                </div>
                <Button variant="outline" className="w-full" onClick={() => handleCopyLink('/surveys/technical-requirements')}>
                    <Copy />
                    <span>Copy Link</span>
                </Button>
            </CardFooter>
          </Card>

        </div>
      </div>
    </div>
  );
}
