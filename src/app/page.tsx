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

const whatWereUpTo = [
    {
        icon: <Image src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/persona.png?alt=media&token=c1303117-6262-4b53-a1f7-0c74b8c73d93" alt="Persona Icon" width={48} height={48} className="w-12 h-12" />,
        title: "Persona"
    },
    {
        icon: <Image src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/elements.png?alt=media&token=c9b3c3e2-8097-402a-993d-4c3db341a027" alt="Elements Icon" width={48} height={48} className="w-12 h-12" />,
        title: "Elements"
    },
    {
        icon: <Image src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/all-things.png?alt=media&token=0a321d5a-5264-42b3-96e0-24957e841f92" alt="All Things Icon" width={48} height={48} className="w-12 h-12" />,
        title: "All Things"
    },
    {
        icon: <Image src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/sync.png?alt=media&token=8011c7d2-74f8-4b72-a05e-f00609384724" alt="Sync Icon" width={48} height={48} className="w-12 h-12" />,
        title: "Sync"
    }
]

const whoWeAreItems = [
  {
    icon: <Image src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/we-are-who-1.png?alt=media&token=38971f45-748a-40a2-94b7-5a1e80937a0c" alt="Icon 1" width={64} height={64} />,
    text: "We are a human-centered community of creators, artists and modern philosophers."
  },
  {
    icon: <Image src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/we-are-who-2.png?alt=media&token=a3e2e848-3c35-4424-b159-f9f252db5606" alt="Icon 2" width={64} height={64} />,
    text: "We are a team of scientists, engineers, and designers."
  },
  {
    icon: <Image src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/we-are-who-3.png?alt=media&token=36f2541a-8c92-48a1-949f-16982eb9a3e2" alt="Icon 3" width={64} height={64} />,
    text: "We are a platform to share, connect, and grow with a community."
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
                    src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/hero-bg.png?alt=media&token=487d7d2c-1541-4193-9515-3733b8a10738"
                    alt="Hero Background"
                    fill
                    className="object-cover opacity-30"
                />
                 <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent"></div>
            </div>
            <div className="relative z-10 container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                    <div className="flex-shrink-0">
                        <Logo className="w-48 h-48 md:w-64 md:h-64" />
                    </div>
                    <div className="text-center md:text-left">
                        <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight">
                            The Evolution of <br /> Self Improvement
                        </h1>
                    </div>
                </div>
            </div>
        </section>

        {/* SOL Theory The Etsy of Self Improvement */}
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="max-w-md">
                <h2 className="font-headline text-4xl md:text-5xl font-bold">SOL Theory</h2>
                <h3 className="text-primary text-2xl md:text-3xl mt-2 mb-6">The Etsy of Self Improvement</h3>
                <p className="text-muted-foreground mb-4">
                  SOL Theory is a curated community of creators and an ecosystem of apps where members can discover and share their products, services, and knowledge.
                </p>
                <p className="text-muted-foreground">
                  We provide a platform for A-Hope, B-Tools, C-Practice. Every product must be able to demonstrate and have a SPF (Simple, Practical and Fun) rating for its products and life.
                </p>
              </div>
              <div>
                {etsyImage && (
                    <Image 
                        src={etsyImage.imageUrl} 
                        alt={etsyImage.description} 
                        width={600} 
                        height={400} 
                        data-ai-hint={etsyImage.imageHint}
                        className="rounded-lg shadow-2xl shadow-primary/10"
                    />
                )}
              </div>
            </div>
          </div>
        </section>
        
        {/* We Are Who */}
        <section className="py-20 md:py-32 bg-secondary/10">
            <div className="container mx-auto px-4 text-center">
                <h2 className="font-headline text-4xl md:text-5xl font-bold mb-12">WE ARE WHO</h2>
                <div className="flex flex-col md:flex-row items-center justify-center gap-12">
                   <div className="space-y-8 text-left max-w-lg">
                        {whoWeAreItems.map((item, index) => (
                             <p key={index} className="text-lg text-muted-foreground">{item.text}</p>
                        ))}
                    </div>
                    <div className="flex items-center justify-center gap-4">
                         {whoWeAreItems.map((item, index) => (
                            <div key={index} className="bg-card p-4 rounded-full shadow-lg">
                                {item.icon}
                            </div>
                        ))}
                    </div>
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

        {/* What We're Up To */}
        <section id="what-we-do" className="py-20 md:py-32 bg-secondary/10">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-headline text-4xl md:text-5xl font-bold">What We&apos;re Up To</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
              We're a team of developers & builders, we create things to empower our users.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {whatWereUpTo.map((item) => (
                <div key={item.title} className="flex flex-col items-center gap-4">
                  <div className="p-5 rounded-full bg-card shadow-lg border border-border/50">
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How Do We Do Things */}
        <section className="py-20 md:py-32">
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        {brainImage && (
                             <Image 
                                src={brainImage.imageUrl} 
                                alt={brainImage.description} 
                                width={500} 
                                height={500} 
                                data-ai-hint={brainImage.imageHint}
                                className="brightness-0 invert opacity-50"
                            />
                        )}
                    </div>
                    <div className="max-w-lg">
                        <h2 className="font-headline text-4xl md:text-5xl font-bold mb-6">How Do We Do Things</h2>
                        <div className="space-y-4 text-muted-foreground text-lg">
                           <p>We connect the real connection. Social media makes us connected but we lost that human touch completely. From our research, when you are at your best then it will be from one of our partner that contribute.</p>
                           <p>As for SOL we have a framework for creators, business, and platform management tools for the whole ecosystem to connect and operate.</p>
                        </div>
                    </div>
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
