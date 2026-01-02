import { Header } from '@/components/sections/header';
import { Footer } from '@/components/sections/footer';
import { Combine } from 'lucide-react';

export default function HowWeDoThingsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-32">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Combine className="size-12 text-primary" />
            <h1 className="font-headline text-5xl text-foreground">
              How We Do Things
            </h1>
          </div>
          <div className="prose prose-invert lg:prose-xl text-muted-foreground space-y-6">
            <p>
              Our methodology is rooted in three pillars: Synthesis (blending diverse knowledge), Optimization (applying practical techniques for improvement), and Liberation (freeing the mind from limiting beliefs).
            </p>
            <p>
              <strong>Synthesis:</strong> We draw from a wide range of disciplines, from quantum physics to ancient spiritual traditions, to create a holistic understanding of reality.
            </p>
            <p>
              <strong>Optimization:</strong> We believe in practical application. Our tools and techniques are designed to be integrated into daily life for measurable improvements in well-being and performance.
            </p>
            <p>
              <strong>Liberation:</strong> Ultimately, our goal is to help individuals break free from mental conditioning and societal programming to experience true freedom and self-sovereignty.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
