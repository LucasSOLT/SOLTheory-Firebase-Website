import { Header } from '@/components/sections/header';
import { Footer } from '@/components/sections/footer';
import { Zap } from 'lucide-react';

export default function WhoWeArePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-32">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Zap className="size-12 text-primary" />
            <h1 className="font-headline text-5xl text-foreground">
              Who We Are
            </h1>
          </div>
          <div className="prose prose-invert lg:prose-xl text-muted-foreground space-y-6">
            <p>
              We are a collective of thinkers, creators, and innovators dedicated to exploring the intersection of ancient wisdom and modern science. Our mission is to provide tools and frameworks for profound personal growth.
            </p>
            <p>
              Our team consists of neuroscientists, philosophers, artists, and engineers, all united by a common passion: to unlock the full potential of the human mind. We believe that by understanding the fundamental principles of consciousness and reality, we can design a better future for ourselves and for humanity.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
