import { Header } from '@/components/sections/header';
import { Footer } from '@/components/sections/footer';
import { Lightbulb } from 'lucide-react';

export default function WhatWeAreUpToPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-32">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Lightbulb className="size-12 text-primary" />
            <h1 className="font-headline text-5xl text-foreground">
              What We&apos;re Up To
            </h1>
          </div>
          <div className="prose prose-invert lg:prose-xl text-muted-foreground space-y-6">
            <p>
              We are developing immersive experiences, curating cutting-edge research, and building a community for self-optimizers. We create digital tools, workshops, and content to guide you on your journey.
            </p>
            <p>
              From virtual reality meditations that transport you to other dimensions to AI-powered journaling that uncovers deep patterns in your thinking, our projects are designed to be both transformative and accessible. We are constantly experimenting with new technologies and new ideas to push the boundaries of what's possible.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
