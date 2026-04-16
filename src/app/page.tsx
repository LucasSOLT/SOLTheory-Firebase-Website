'use client';

import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Header } from '@/components/sections/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriptionSection } from '@/components/sections/subscription';
import { Footer } from '@/components/sections/footer';
import Link from 'next/link';
import { ArrowDown, Sparkles, Mail, Layers, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlobHero } from '@/components/ui/blob-hero';
import { motion } from 'framer-motion';
import { StarBackground } from '@/components/ui/star-background';
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
  }
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-x-hidden">
      <div className="absolute top-0 w-full z-50 fixed">
        <Header />
      </div>

      <main className="flex-grow z-10 w-full relative">
        
        {/* SECTION 1: Dynamic Abstract 3D Hero */}
        <section className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden z-10">
          <BlobHero />
          <div className="relative z-10 container mx-auto px-4 pointer-events-none mt-20">
            <div className="flex flex-col items-center justify-center text-center gap-6">
              
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-sm font-semibold tracking-widest backdrop-blur-md">
                <Sparkles className="w-4 h-4" /> THE APP ECOSYSTEM
              </div>

              <h1 className="font-nunito text-6xl md:text-[8rem] font-semibold tracking-tight text-white drop-shadow-2xl leading-none">
                SOL Theory
              </h1>

              <p className="mt-4 text-2xl md:text-5xl font-light text-slate-300 drop-shadow-lg max-w-4xl">
                The Evolution of <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">Self Improvement</span>
              </p>
            </div>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-auto cursor-pointer flex flex-col items-center gap-3 text-fuchsia-500 hover:text-fuchsia-400 transition-colors" onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}>
            <span className="font-headline tracking-[0.3em] text-[10px] md:text-sm font-bold uppercase">Scroll to Descend</span>
            <ArrowDown className="w-5 h-5 animate-bounce" />
          </div>
        </section>

        {/* Star Background Wrapper */}
        <div className="relative w-full overflow-hidden">
          <StarBackground />
          <div className="relative z-10 w-full flex flex-col items-center bg-transparent">

            {/* SECTION 1.5: Template Products */}
            <section className="relative py-32 md:py-40 w-full flex flex-col items-center justify-center bg-transparent z-20 border-t border-white/5">
              <div className="container mx-auto px-4">
                <div className="text-center max-w-4xl mx-auto space-y-6 mb-16">
                  <h2 className="font-nunito text-5xl md:text-6xl font-bold text-white tracking-tight drop-shadow-xl">Agentic Affordable Agentic Solutions, Built to Scale</h2>
                  <div className="h-1 bg-gradient-to-r from-fuchsia-600 via-indigo-500 to-transparent mx-auto rounded-full w-24 mb-6" />
                  <p className="text-slate-300 text-xl font-light">
                    Discover our curated selection of premium products and services designed for your evolution.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto w-full">
                  {[
                    {
                      id: 1,
                      title: "Agentic Email Assistant",
                      price: "$5.99 a month",
                      description: "Access our inbound and outbound email agents that automatically respond to emails, draft professional responses, and create campaign emails. Our AI operates exclusively within the Google product ecosystem.",
                      Icon: Mail
                    },
                    {
                      id: 2,
                      title: "Google Suite Assistant",
                      price: "$12.99 a month",
                      description: "Access our entire suite of Google AI agents, including our Calendar Agent, Email Agent, and Phone Agent. Essentially capable of accessing any Google Suite tools to completely automate your workflow.",
                      Icon: Layers
                    },
                    {
                      id: 3,
                      title: "Dashboard Access",
                      price: "$22.99 a month",
                      description: "Unlock predictive analytics, get full access to the entire Google Suite agent, prioritized support, and our communications network. This tier includes essentially all the offerings we have.",
                      Icon: LayoutDashboard
                    },
                    {
                      id: 4,
                      title: "Customized Solutions",
                      price: "Subject to Scale",
                      description: "A stylized dashboard heavily tailored to your specific organization's needs. The price varies entirely depending on the scale and requires a consultation with our development team.",
                      Icon: Settings
                    }
                  ].map((item) => (
                    <div key={item.id} className="group relative">
                      <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-500/20 to-indigo-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <Card className="relative bg-black/40 backdrop-blur-sm border border-white/10 overflow-hidden h-full flex flex-col transition-all duration-500 group-hover:border-fuchsia-500/50 group-hover:bg-white/5 group-hover:-translate-y-2 rounded-3xl z-10 min-h-[420px] shadow-lg">
                        <div className="h-40 w-full bg-gradient-to-br from-black/60 to-black/30 flex items-center justify-center border-b border-white/5 relative overflow-hidden">
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-fuchsia-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                          <item.Icon className="w-12 h-12 text-white/50 group-hover:text-fuchsia-400 group-hover:scale-110 transition-all duration-500 relative z-10" />
                        </div>
                        <CardHeader className="pt-6 relative z-20 flex-grow">
                          <div className="w-12 h-1 bg-gradient-to-r from-fuchsia-500 to-indigo-500 rounded-full mb-4" />
                          <div className="flex flex-col gap-1 mb-2">
                            <CardTitle className="font-headline text-2xl font-bold text-white group-hover:text-fuchsia-300 transition-colors duration-500">
                              {item.title}
                            </CardTitle>
                            <span className="text-fuchsia-400 font-semibold tracking-wide text-sm bg-fuchsia-500/10 w-fit px-3 py-1 rounded-full border border-fuchsia-500/20">{item.price}</span>
                          </div>
                          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                            {item.description}
                          </p>
                        </CardHeader>
                        <div className="p-6 pt-0 mt-auto">
                          <a href="mailto:team@soltheory.com" className="block w-full text-center py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 hover:text-fuchsia-400 transition-all duration-300 mt-4 backdrop-blur-sm cursor-pointer z-30">
                            Contact Team
                          </a>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* SECTION 2: SOL Theory The Etsy of Self Improvement */}
            <section className="relative py-24 md:py-32 w-full flex flex-col items-center justify-center bg-transparent z-20 overflow-hidden">
              {/* Subtle Animated Backgrounds */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.1, 0.15, 0.1] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-[30%] -left-[10%] w-[700px] h-[700px] bg-gradient-to-tr from-fuchsia-500/20 to-indigo-500/20 rounded-full blur-[120px]"
                />
                <motion.div 
                  animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0], opacity: [0.1, 0.2, 0.1] }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute -bottom-[30%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-bl from-cyan-500/20 to-purple-500/20 rounded-full blur-[120px]"
                />
              </div>

              <div className="container mx-auto px-4 relative z-10">
                <div className="text-center max-w-4xl mx-auto space-y-6">
                  <h2 className="font-headline text-5xl md:text-6xl font-bold text-white tracking-tight drop-shadow-xl">The Etsy of Self Improvement</h2>
                  <div className="h-1 bg-gradient-to-r from-fuchsia-600 via-indigo-500 to-transparent mx-auto rounded-full w-24 mb-6" />
                  
                  <p className="text-slate-200 text-xl md:text-2xl leading-relaxed font-medium">
                    SOL Theory is a curated community of creators and an ecosystem of apps where members can discover and share their products, services, and knowledge.
                  </p>
                  <p className="text-slate-300 text-lg leading-relaxed max-w-3xl mx-auto border-t border-white/10 pt-6 mt-6 font-light">
                    We provide a platform for A-Hope, B-Tools, C-Practice. Every product must be able to demonstrate and have a <span className="text-fuchsia-300 font-semibold px-2 bg-fuchsia-500/10 rounded-md py-0.5 border border-fuchsia-500/20 shadow-sm shadow-fuchsia-500/10">SPF (Simple, Practical and Fun)</span> rating for its products and life.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 2.5: Animated Video Placeholder Container */}
            <section className="relative pb-32 md:pb-40 pt-10 w-full flex flex-col items-center justify-center bg-transparent z-20">
              <div className="container mx-auto px-4 max-w-5xl">
                <motion.div 
                  initial={{ opacity: 0, y: 80, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="w-full aspect-video rounded-3xl border border-white/10 bg-black/60 shadow-[0_0_60px_-15px_rgba(192,38,211,0.15)] overflow-hidden relative flex items-center justify-center group cursor-pointer backdrop-blur-md"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-500/10 via-transparent to-transparent opacity-60"></div>
                  
                  <div className="flex flex-col items-center text-slate-500 group-hover:text-fuchsia-400 transition-colors duration-500 z-10 group-hover:scale-105 transform">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-6 backdrop-blur-md bg-white/5 shadow-lg group-hover:bg-fuchsia-500/10 transition-colors duration-500">
                      <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-current border-b-[12px] border-b-transparent ml-2" />
                    </div>
                    <p className="font-headline tracking-[0.2em] text-sm md:text-base font-semibold uppercase group-hover:text-fuchsia-300">Video Presentation Container</p>
                  </div>
                </motion.div>
              </div>
            </section>
            
            {/* SECTION 3: Featured Projects */}
            <section id="projects" className="relative py-32 md:py-40 w-full flex flex-col items-center justify-center bg-transparent z-30 shadow-2xl">
              <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                  <h2 className="font-nunito text-5xl md:text-6xl font-bold text-white mb-4">Featured Projects</h2>
                  <p className="text-slate-400 max-w-2xl mx-auto text-lg">Explore high-fidelity applications designed directly within the SOL Theory network.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto mt-4 px-4 w-full h-[60vh] max-h-[500px]">
                  {featuredProjects.map((project, idx) => {
                    const projectImage = PlaceHolderImages.find(img => img.id === project.id);
                    return (
                      <div key={project.id} className="h-full w-full">
                        <Link href={project.url} target="_blank" rel="noopener noreferrer" className="block group h-full w-full">
                          <Card className="bg-black/40 backdrop-blur-sm border border-white/10 overflow-hidden h-full flex flex-col transition-all duration-700 group-hover:border-fuchsia-500/50 group-hover:bg-white/10 group-hover:-translate-y-2 group-hover:shadow-[0_0_50px_-10px_rgba(192,38,211,0.3)] relative rounded-3xl">
                            
                            {projectImage && (
                              <div className={cn("relative h-full w-full opacity-80 group-hover:opacity-100 transition-all duration-700 z-10 overflow-hidden flex-grow")}>
                                <Image
                                  src={projectImage.imageUrl}
                                  alt={projectImage.description || project.title}
                                  fill
                                  className="group-hover:scale-105 transition-transform duration-1000 object-cover"
                                  data-ai-hint={projectImage.imageHint}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d10] via-black/40 to-transparent" />
                              </div>
                            )}
                            <CardHeader className="absolute bottom-0 left-0 right-0 z-20 pb-8 text-center pt-24 bg-gradient-to-t from-[#0d0d10] to-transparent">
                              <CardTitle className="font-headline text-3xl md:text-4xl font-bold text-white group-hover:text-fuchsia-300 transition-colors duration-500 drop-shadow-2xl">
                                {project.title}
                              </CardTitle>
                            </CardHeader>
                          </Card>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* SECTION 4 & 5 Combined: Dense Protocol Overview */}
            <section id="qualifies" className="relative py-32 md:py-48 w-full flex flex-col items-center justify-center bg-transparent z-40 shadow-2xl overflow-hidden">
              <div className="container mx-auto px-4 w-full flex flex-col justify-center">
                <div className="text-center mb-10 md:mb-16 mt-6 md:mt-10">
                  <h2 className="font-nunito text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-xl">The SOL Protocol</h2>
                  <p className="text-slate-400 max-w-2xl mx-auto text-lg pt-2 md:pt-0">Network qualifications and absolute directives for our premium ecosystem.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 max-w-7xl mx-auto w-full">
                  
                  {/* Left Column: Qualifications */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                      </div>
                      <h3 className="text-2xl font-headline font-bold text-white">Qualifications</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {whatQualifies.map((item, idx) => (
                        <div key={item.title} className="p-5 md:p-6 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-white/10 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
                          <div className="relative z-10 flex gap-4 md:gap-6">
                            <span className="text-indigo-400 font-black text-3xl md:text-4xl opacity-50 shrink-0">0{idx + 1}</span>
                            <div>
                              <h4 className="font-headline text-lg md:text-xl font-bold text-white mb-2">{item.title}</h4>
                              <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Mission Matrix */}
                  <div className="relative">
                      <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="p-2 bg-fuchsia-500/20 rounded-lg border border-fuchsia-500/30">
                          <Sparkles className="w-5 h-5 text-fuchsia-400" />
                        </div>
                        <h3 className="text-2xl font-headline font-bold text-white">Mission Directives</h3>
                      </div>

                      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-3xl p-6 md:p-8 relative z-10 h-[calc(100%-4rem)] flex flex-col justify-between hover:border-fuchsia-500/30 transition-all">
                          <div className="space-y-6 md:space-y-8">
                            <div>
                              <h4 className="text-fuchsia-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.8)]" /> Why
                              </h4>
                              <p className="text-slate-300 text-base md:text-lg">To empower everyone to look for what is absolutely possible.</p>
                            </div>
                            <div>
                              <h4 className="text-indigo-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]" /> Mission
                              </h4>
                              <p className="text-slate-300 text-base md:text-lg">To create a platform, ecosystem and community to systematically improve structural life.</p>
                            </div>
                            <div>
                              <h4 className="text-emerald-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" /> Vision
                              </h4>
                              <p className="text-slate-300 text-base md:text-lg">The world's apex layer for self improvement and cognitive elevation.</p>
                            </div>
                            <div>
                              <h4 className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" /> Architectural Goals
                              </h4>
                              <ul className="text-slate-300 text-sm md:text-base space-y-2">
                                <li className="flex gap-2"><span className="text-amber-400">-</span> Build an impact-driven community.</li>
                                <li className="flex gap-2"><span className="text-amber-400">-</span> Innovate creative frontiers.</li>
                                <li className="flex gap-2"><span className="text-amber-400">-</span> Measure strictly by data and scientific method.</li>
                              </ul>
                            </div>
                          </div>
                      </div>
                  </div>

                </div>
              </div>
            </section>

            {/* SECTION 6: Subscription & Footer Context */}
            <section className="relative w-full flex flex-col justify-between bg-transparent z-50">
              <div className="flex-grow flex items-center justify-center border-t border-white/5 bg-transparent pt-10 pb-10">
                <SubscriptionSection />
              </div>
              <div className="relative z-60 border-t border-white/10 bg-black/90 pt-8 backdrop-blur-md">
                <Footer />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
