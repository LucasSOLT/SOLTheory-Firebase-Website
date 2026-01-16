
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Header } from '@/components/sections/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriptionSection } from '@/components/sections/subscription';
import { Footer } from '@/components/sections/footer';
import { Logo } from '@/components/logo';
import Link from 'next/link';

import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';


const whatQualifies = [
  {
    title: "Scientific step-by-step method",
    description: "Our methods are rooted in research and designed for tangible progress. We break down complex concepts into actionable steps.",
  },
  {
    title: "Nobody plays alone here",
    description: "Community is at our core. Connect with like-minded individuals, share your journey, and grow together in a supportive environment.",
  },
  {
    title: "Simple, Practical and Fun (SPF)",
    description: "We believe growth should be engaging, not a chore. Our tools are designed to be intuitive, easy to integrate into your life, and enjoyable to use.",
  }
];

const featuredProjects = [
  {
    id: "thrive-coaching",
    title: "THRiVE Coaching",
    url: "https://www.thrivecoaching.ai",
  },
  {
    id: "life-navigation",
    title: "Life Navigation University",
    url: "https://www.lifenavigation.ai",
  },
  {
    id: "21-games",
    title: "21 Games",
    url: "https://www.21games.ai",
  },
];


export default function Home() {
  const etsyImage = PlaceHolderImages.find(img => img.id === 'etsy-laptop');
  const brainImage = PlaceHolderImages.find(img => img.id === 'brain-diagram');

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative flex items-center justify-center h-screen overflow-hidden">
            <div className="relative z-10 container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                    <div className="flex-shrink-0">
                        <Logo className="w-40 h-40 md:w-52 md:h-52" />
                    </div>
                    <div className="text-center md:text-left">
                        <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tight text-white">
                            SOL Theory
                        </h1>
                        <p className="mt-2 text-2xl md:text-3xl text-primary">The Evolution of Self Improvement</p>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
                <Link href="#projects" className="flex flex-col items-center gap-2 text-primary hover:text-white transition-colors animate-fade-in [animation-delay:1s] animation-fill-mode-backwards">
                    <span className="font-headline tracking-widest">EXPLORE MORE</span>
                    <ArrowDown className="w-6 h-6 animate-bounce" />
                </Link>
            </div>
        </section>

        {/* SOL Theory The Etsy of Self Improvement */}
        <section className="py-20">
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
        
        {/* Featured Projects Section */}
        <section id="projects" className="py-20 bg-card/20 backdrop-blur-sm">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-headline text-4xl md:text-5xl font-bold mb-12">Featured Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {featuredProjects.map((project) => {
                const projectImage = PlaceHolderImages.find(img => img.id === project.id);
                return (
                  <Link href={project.url} key={project.id} target="_blank" rel="noopener noreferrer" className="block group">
                    <Card className="bg-card/80 border-border/50 backdrop-blur-sm overflow-hidden h-full flex flex-col transition-all duration-300 group-hover:border-primary group-hover:scale-105">
                      {projectImage && (
                        <div className={cn("relative h-48 w-full", project.id === '21-games' && 'bg-white')}>
                          <Image
                            src={projectImage.imageUrl}
                            alt={projectImage.description}
                            fill
                            className={project.id === '21-games' ? 'object-contain' : 'object-cover'}
                            data-ai-hint={projectImage.imageHint}
                          />
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle className="font-headline text-2xl text-primary">{project.title}</CardTitle>
                      </CardHeader>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>


        {/* What Qualifies */}
        <section id="qualifies" className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-headline text-4xl md:text-5xl font-bold mb-12">What Qualifies to be on SOL Theory</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {whatQualifies.map((item) => (
                <Card key={item.title} className="bg-card/80 border-border/50 backdrop-blur-sm p-4 text-left transition-all duration-300 hover:border-primary hover:scale-105 flex flex-col">
                  <CardHeader>
                    <CardTitle className="font-headline text-2xl text-foreground mb-2 font-bold">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-muted-foreground text-lg">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        

        {/* Vision & Goals */}
        <section className="py-20 md:py-32 bg-card/20 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <h2 className="font-headline text-4xl md:text-5xl font-bold mb-12 text-center">Why, Mission, Vision & Goals</h2>
            <div className="max-w-2xl mx-auto bg-card/80 border-border/50 backdrop-blur-sm p-8 rounded-lg text-left transition-all duration-300 hover:border-primary hover:scale-105">
                <div className="space-y-6">
                    <div>
                        <h3 className="text-foreground font-bold text-xl mb-2">Why</h3>
                        <p className="text-muted-foreground">To empower everyone to look for what is possible.</p>
                    </div>
                      <div>
                        <h3 className="text-foreground font-bold text-xl mb-2">Mission</h3>
                        <p className="text-muted-foreground">To create a platform, ecosystem and community for people to improve their lives, and share knowledge.</p>
                    </div>
                      <div>
                        <h3 className="text-foreground font-bold text-xl mb-2">Vision</h3>
                        <p className="text-muted-foreground">To be the #1 place for self improvement.</p>
                    </div>
                      <div>
                        <h3 className="text-foreground font-bold text-xl mb-2">Goals</h3>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2">
                            <li>Build a community of creators that can make an impact for humankind.</li>
                            <li>Be a creative and innovative place for creators.</li>
                            <li>Measure everything based on data and science.</li>
                        </ul>
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
