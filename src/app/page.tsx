
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Header } from '@/components/sections/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriptionSection } from '@/components/sections/subscription';
import { Footer } from '@/components/sections/footer';
import { Logo } from '@/components/logo';

import { CheckCircle2, Users, BrainCircuit, Lightbulb, Rocket, ShieldCheck } from 'lucide-react';


const whatQualifies = [
  {
    title: "Scientific step-by-step method",
    description: "Our methods are rooted in research and designed for tangible progress. We break down complex concepts into actionable steps.",
  },
  {
    title: "Nobody plays alone",
    description: "Community is at our core. Connect with like-minded individuals, share your journey, and grow together in a supportive environment.",
  },
  {
    title: "Simple, Practical and Fun (SPF)",
    description: "We believe growth should be engaging, not a chore. Our tools are designed to be intuitive, easy to integrate into your life, and enjoyable to use.",
  }
];



export default function Home() {
  const etsyImage = PlaceHolderImages.find(img => img.id === 'etsy-laptop');
  const brainImage = PlaceHolderImages.find(img => img.id === 'brain-diagram');

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative flex items-center justify-center h-screen bg-black">
             <div className="absolute inset-0 z-0">
                <Image 
                    src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/About%20SOL%20Theory%20Page.png?alt=media&token=31024488-c529-4f7a-9fd7-46d888ac0f81"
                    alt="Hero Background"
                    fill
                    className="object-cover object-left opacity-100"
                />
                 <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
            </div>
            <div className="relative z-10 container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                    <div className="flex-shrink-0">
                        <Logo className="w-40 h-40 md:w-52 md:h-52" />
                    </div>
                    <div className="text-center md:text-left ml-24">
                        <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tight">
                            SOL Theory
                        </h1>
                        <p className="mt-2 text-2xl md:text-3xl text-primary">The Evolution of Self Improvement</p>
                    </div>
                </div>
            </div>
        </section>

        {/* SOL Theory The Etsy of Self Improvement */}
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="font-headline text-5xl md:text-6xl font-bold">SOL Theory</h2>
              <h3 className="text-primary text-2xl md:text-3xl mt-2 mb-6">The Etsy of Self Improvement</h3>
              <p className="text-muted-foreground mb-4 text-lg">
                SOL Theory is a curated community of creators and an ecosystem of apps where members can discover and share their products, services, and knowledge.
              </p>
              <p className="text-muted-foreground text-lg">
                We provide a platform for A-Hope, B-Tools, C-Practice. Every product must be able to demonstrate and have a SPF (Simple, Practical and Fun) rating for its products and life.
              </p>
            </div>
          </div>
        </section>
        
        


        {/* What Qualifies */}
        <section id="qualifies" className="py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-headline text-4xl md:text-5xl font-bold mb-12">What Qualifies to be on SOL Theory</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {whatQualifies.map((item) => (
                <Card key={item.title} className="bg-card/80 border-border/50 backdrop-blur-sm p-6 text-left">
                  <CardHeader>
                    <CardTitle className="font-headline text-2xl text-primary mb-4">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        

        {/* Vision & Goals */}
        <section className="py-20 md:py-32 bg-secondary/10">
            <div className="container mx-auto px-4">
                 <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="font-headline text-4xl md:text-5xl font-bold">Why, Mission, Vision & Goals</h2>
                    </div>
                    <div className="bg-card/80 border-border/50 backdrop-blur-sm p-8 rounded-lg">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-primary font-bold text-xl mb-2">Why</h3>
                                <p className="text-muted-foreground">To empower everyone to look for what is possible.</p>
                            </div>
                             <div>
                                <h3 className="text-primary font-bold text-xl mb-2">Mission</h3>
                                <p className="text-muted-foreground">To create a platform, ecosystem and community for people to improve their lives, and share knowledge.</p>
                            </div>
                             <div>
                                <h3 className="text-primary font-bold text-xl mb-2">Vision</h3>
                                <p className="text-muted-foreground">To be the #1 place for self improvement.</p>
                            </div>
                             <div>
                                <h3 className="text-primary font-bold text-xl mb-2">Goals</h3>
                                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                                    <li>Build a community of creators that can make an impact for humankind.</li>
                                    <li>Be a creative and innovative place for creators.</li>
                                    <li>Measure everything based on data and science.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>


        <SubscriptionSection />

      </main>
      <Footer />
    </div>
  );
}
