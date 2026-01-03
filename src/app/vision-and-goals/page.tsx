import { Header } from '@/components/sections/header';
import { Footer } from '@/components/sections/footer';
import { Target } from 'lucide-react';

export default function VisionAndGoalsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-32">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Target className="size-12 text-primary" />
            <h1 className="font-headline text-5xl text-foreground font-bold">
              Vision & Goals
            </h1>
          </div>
          <div className="prose prose-invert lg:prose-xl text-muted-foreground space-y-6">
            <p>
              To empower a million individuals to live more conscious, fulfilling, and purpose-driven lives. We envision a world where self-awareness is the foundation of a new kind of progress.
            </p>
            <p>
              Our goal is not just to create a successful company, but to spark a global movement. A movement of individuals committed to their own evolution and to the creation of a more enlightened world. We believe that by changing ourselves, we can change the world.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
