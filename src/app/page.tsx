'use client';

import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Header } from '@/components/sections/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriptionSection } from '@/components/sections/subscription';
import { Footer } from '@/components/sections/footer';
import Link from 'next/link';
import { ArrowDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlobHero } from '@/components/ui/blob-hero';
import { motion } from 'framer-motion';

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

        {/* SECTION 1.5: Products & Services */}
        <section className="relative py-28 md:py-40 w-full bg-[#08080a] z-15 overflow-hidden">
          {/* Subtle ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-fuchsia-600/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16 md:mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-[0.2em] mb-5">
                What We Build
              </div>
              <h2 className="font-nunito text-4xl md:text-6xl font-bold text-white tracking-tight mb-4">Products &amp; Services</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">Enterprise-grade AI tooling, delivered at a fraction of enterprise cost.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">

              {/* Card 1: AI Email Agents */}
              <div className="group relative flex flex-col bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden hover:border-blue-500/40 hover:bg-white/[0.06] transition-all duration-500 hover:-translate-y-1">
                <div className="relative h-52 overflow-hidden">
                  <Image src="/product_email_agents.png" alt="AI Email Agents" fill className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-transparent" />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="font-nunito text-xl font-bold text-white mb-1">AI Email Agents</h3>
                  <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-3">(Inbound &amp; Outbound)</p>
                  <p className="text-slate-400 text-sm leading-relaxed flex-grow">
                    Stop writing emails. Our executive agent &quot;Morpheus&quot; drafts professional, human-sounding correspondence on your behalf. Manage your entire inbox through conversation: reply, organize, delete, and send outreach without ever touching your keyboard. Includes a pre-built dashboard, full analytics, and access to the SOL Theory network.
                  </p>
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-bold text-white">$50</span>
                      <span className="text-slate-500 text-sm">lifetime</span>
                      <span className="text-slate-600 text-sm mx-1">or</span>
                      <span className="text-lg font-semibold text-white">$3</span>
                      <span className="text-slate-500 text-sm">/month</span>
                    </div>
                    <Link href="/portal/login" className="block w-full text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
                      Get Started
                    </Link>
                  </div>
                </div>
              </div>

              {/* Card 2: Google Workspace Automation */}
              <div className="group relative flex flex-col bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden hover:border-indigo-500/40 hover:bg-white/[0.06] transition-all duration-500 hover:-translate-y-1">
                <div className="relative h-52 overflow-hidden">
                  <Image src="/product_google_suite.png" alt="Google Workspace Automation" fill className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-transparent" />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="font-nunito text-xl font-bold text-white mb-1">Google Workspace Automation</h3>
                  <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-3">Full Suite Integration</p>
                  <p className="text-slate-400 text-sm leading-relaxed flex-grow">
                    Connect your entire Google ecosystem to our AI. Create and manage Calendar events, draft and respond to Gmail, generate Docs and Sheets, build Slides presentations, organize Drive files, and more. Your agent operates across every Google product so you can focus on the decisions that actually matter.
                  </p>
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-bold text-white">$200</span>
                      <span className="text-slate-500 text-sm">lifetime</span>
                      <span className="text-slate-600 text-sm mx-1">or</span>
                      <span className="text-lg font-semibold text-white">$9</span>
                      <span className="text-slate-500 text-sm">/month</span>
                    </div>
                    <Link href="/portal/login" className="block w-full text-center py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
                      Get Started
                    </Link>
                  </div>
                </div>
              </div>

              {/* Card 3: Custom Dashboard */}
              <div className="group relative flex flex-col bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden hover:border-fuchsia-500/40 hover:bg-white/[0.06] transition-all duration-500 hover:-translate-y-1">
                <div className="relative h-52 overflow-hidden">
                  <Image src="/product_custom_dashboard.png" alt="Personalized Dashboard" fill className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-transparent" />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="font-nunito text-xl font-bold text-white mb-1">Personalized Dashboard</h3>
                  <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-widest mb-3">Re-imagined</p>
                  <p className="text-slate-400 text-sm leading-relaxed flex-grow">
                    We architect fully custom dashboards engineered to the exact specifications of your operation. AI model costs stay accessible and are bundled into your service price. We have yet to encounter a challenge our team cannot solve through determination and ingenuity. The sky is genuinely the limit.
                  </p>
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <p className="text-slate-500 text-xs uppercase tracking-widest mb-3">Pricing varies by scope</p>
                    <a href="mailto:teams@soltheory.com?subject=Free%20Consultation%20Request&body=Hello%20SOL%20Theory%20team%2C%0A%0AI%27m%20interested%20in%20learning%20more%20about%20a%20custom%20dashboard%20solution.%0A%0AThank%20you!" className="block w-full text-center py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold transition-colors">
                      Contact for a <em>free</em> consultation
                    </a>
                  </div>
                </div>
              </div>

              {/* Card 4: Partnership & Community */}
              <div className="group relative flex flex-col bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden hover:border-amber-500/40 hover:bg-white/[0.06] transition-all duration-500 hover:-translate-y-1">
                <div className="relative h-52 overflow-hidden">
                  <Image src="/product_partnership.png" alt="Partnership & Community" fill className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-transparent" />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="font-nunito text-xl font-bold text-white mb-1">Partner with SOL Theory</h3>
                  <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">Community &amp; Collaboration</p>
                  <p className="text-slate-400 text-sm leading-relaxed flex-grow">
                    Join our growing self-development community or explore strategic partnership opportunities. Whether you are looking to host your own products and services on our platform, establish mutually beneficial business collaborations, or simply connect with driven individuals pushing the boundaries of personal growth, we welcome the conversation.
                  </p>
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <a href="mailto:teams@soltheory.com?subject=Partnership%20Inquiry&body=Hello%20SOL%20Theory%20team%2C%0A%0AI%27m%20interested%20in%20exploring%20partnership%20or%20community%20opportunities.%0A%0AThank%20you!" className="block w-full text-center py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors">
                      Start a Conversation
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* SECTION 2: SOL Theory The Etsy of Self Improvement */}
        <section className="relative py-32 md:py-48 w-full flex flex-col items-center justify-center bg-[#0A0A0B] z-20 shadow-2xl">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-4xl mx-auto space-y-6">
              <h2 className="font-nunito text-5xl md:text-7xl font-bold text-white tracking-tight drop-shadow-xl">The Etsy of Self Improvement</h2>
              <div className="h-1 bg-gradient-to-r from-fuchsia-600 via-indigo-500 to-transparent mx-auto rounded-full w-24 mb-6" />
              
              <p className="text-slate-300 text-xl md:text-2xl leading-relaxed font-light">
                SOL Theory is a curated community of creators and an ecosystem of apps where members can discover and share their products, services, and knowledge.
              </p>
              <p className="text-slate-400 text-lg leading-relaxed max-w-3xl mx-auto border-t border-white/10 pt-6 mt-6">
                We provide a platform for A-Hope, B-Tools, C-Practice. Every product must be able to demonstrate and have a <span className="text-fuchsia-400 font-bold px-1 bg-fuchsia-500/10 rounded-md py-0.5 border border-fuchsia-500/20">SPF (Simple, Practical and Fun)</span> rating for its products and life.
              </p>
            </div>
          </div>
        </section>
        
        {/* SECTION 3: Featured Projects */}
        <section id="projects" className="relative py-32 md:py-40 w-full flex flex-col items-center justify-center bg-[#0d0d10] z-30 shadow-2xl">
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
                      <Card className="bg-white/5 border border-white/10 overflow-hidden h-full flex flex-col transition-all duration-700 group-hover:border-fuchsia-500/50 group-hover:bg-white/10 group-hover:-translate-y-2 group-hover:shadow-[0_0_50px_-10px_rgba(192,38,211,0.3)] relative rounded-3xl">
                        
                        {projectImage && (
                          <div className={cn("relative h-full w-full opacity-80 group-hover:opacity-100 transition-all duration-700 z-10 overflow-hidden flex-grow")}>
                            <Image
                              src={projectImage.imageUrl}
                              alt={projectImage.description || project.title}
                              fill
                              className="group-hover:scale-105 transition-transform duration-1000 object-cover"
                              data-ai-hint={projectImage.imageHint}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d10] via-[#0d0d10]/20 to-transparent" />
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
        <section id="qualifies" className="relative py-32 md:py-48 w-full flex flex-col items-center justify-center bg-[#0A0A0B] z-40 shadow-2xl overflow-hidden">
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
                    <div key={item.title} className="p-5 md:p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
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

                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 relative z-10 h-[calc(100%-4rem)] flex flex-col justify-between hover:border-fuchsia-500/30 transition-all">
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
        <section className="relative w-full flex flex-col justify-between bg-[#0A0A0B] z-50">
          <div className="flex-grow flex items-center justify-center border-t border-white/5 bg-[#0a0a0b]">
            <SubscriptionSection />
          </div>
          <div className="relative z-60 border-t border-white/10 bg-black/90 pt-8">
            <Footer />
          </div>
        </section>

      </main>
    </div>
  );
}
