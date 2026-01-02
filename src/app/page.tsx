import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Header } from '@/components/sections/header';
import { Hero } from '@/components/sections/hero';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriptionSection } from '@/components/sections/subscription';
import { Footer } from '@/components/sections/footer';
import { Zap, Target, Lightbulb, Combine } from 'lucide-react';
import Link from 'next/link';

const sections = [
  {
    icon: <Zap className="size-8 text-primary" />,
    title: "Who We Are",
    content: "We are a collective of thinkers, creators, and innovators dedicated to exploring the intersection of ancient wisdom and modern science. Our mission is to provide tools and frameworks for profound personal growth.",
    href: "/who-we-are"
  },
  {
    icon: <Lightbulb className="size-8 text-primary" />,
    title: "What We're Up To",
    content: "Developing immersive experiences, curating cutting-edge research, and building a community for self-optimizers. We create digital tools, workshops, and content to guide you on your journey.",
    href: "/what-we-are-up-to"
  },
  {
    icon: <Combine className="size-8 text-primary" />,
    title: "How We Do Things",
    content: "Our methodology is rooted in three pillars: Synthesis (blending diverse knowledge), Optimization (applying practical techniques for improvement), and Liberation (freeing the mind from limiting beliefs).",
    href: "/how-we-do-things"
  },
  {
    icon: <Target className="size-8 text-primary" />,
    title: "Vision & Goals",
    content: "To empower a million individuals to live more conscious, fulfilling, and purpose-driven lives. We envision a world where self-awareness is the foundation of a new kind of progress.",
    href: "/vision-and-goals"
  }
]

export default function Home() {
  const carouselImages = PlaceHolderImages.filter(img => img.id.startsWith('carousel'));

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <Hero images={carouselImages} />
        
        <section id="about" className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {sections.map((section) => (
                <Link href={section.href} key={section.title} className="block">
                  <Card className="h-full bg-card/50 border-border/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        {section.icon}
                        <CardTitle className="font-headline text-2xl text-foreground">
                          {section.title}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{section.content}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <SubscriptionSection />

      </main>
      <Footer />
    </div>
  );
}
