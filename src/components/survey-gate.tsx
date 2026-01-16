
"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const surveys = [
  { id: 1, title: '#1 Master requirements survey', url: '/surveys/master-requirements' },
  { id: 2, title: '#2 Helping us help you', url: '/surveys/helping-us-help-you' },
  { id: 3, title: '#3 Technical requirements survey', url: '/surveys/technical-requirements' },
];

export function SurveyGate() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let keySequence = '';
    let sequenceTimer: ReturnType<typeof setTimeout>;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey) {
        clearTimeout(sequenceTimer);

        const key = event.key.toLowerCase();
        
        if (key === 'm') {
          keySequence = 'm';
        } else if (keySequence === 'm' && key === 'k') {
          setIsOpen(true);
          keySequence = ''; // Reset sequence
        } else {
          keySequence = ''; // Reset on wrong key
        }

        sequenceTimer = setTimeout(() => {
          keySequence = '';
        }, 1500); // 1.5-second window to complete the sequence
      } else {
        // Reset if modifier keys are not held down
        if (keySequence !== '') {
            keySequence = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(sequenceTimer);
    };
  }, []); // The empty dependency array ensures this effect runs only once.

  const copyToClipboard = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast({
        title: "URL Copied!",
        description: "The survey link has been copied to your clipboard.",
      });
    }).catch(err => {
        console.error("Failed to copy URL: ", err);
        toast({
            variant: "destructive",
            title: "Copy Failed",
            description: "Could not copy the URL.",
          });
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] bg-card/90 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Survey Access</DialogTitle>
          <DialogDescription>
            Select a survey to access it directly or copy its shareable link.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {surveys.map((survey) => (
            <div key={survey.id} className="flex flex-col gap-2">
                <Link href={survey.url} passHref>
                    <Button variant="outline" className="w-full justify-start">{survey.title}</Button>
                </Link>
                <div className='flex items-center gap-2'>
                    <input type="text" readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}${survey.url}`} className="w-full text-sm p-2 rounded-md bg-background/50 border border-border"/>
                    <Button size="sm" onClick={() => copyToClipboard(survey.url)}>Copy</Button>
                </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
    