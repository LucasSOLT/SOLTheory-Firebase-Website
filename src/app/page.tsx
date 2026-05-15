'use client';


import { Header } from '@/components/sections/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriptionSection } from '@/components/sections/subscription';
import { Footer } from '@/components/sections/footer';
import Link from 'next/link';
import { ArrowDown, Sparkles, ShoppingCart } from 'lucide-react';

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



export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-x-hidden">
      <div className="absolute top-0 w-full z-50 fixed">
        <Header />
      </div>

      <main className="flex-grow z-10 w-full relative">
        
        {/* SECTION 1: Dynamic Abstract 3D Hero */}
        <section className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden z-10">
          <StarBackground />
          <BlobHero />
          <div className="relative z-10 container mx-auto px-4 pointer-events-none mt-4 md:mt-10">
            <div className="flex flex-col items-center justify-center text-center gap-6">

              <h1 className="font-jakarta text-6xl md:text-[8rem] font-bold tracking-tight text-white drop-shadow-2xl leading-none">
                SOL Theory
              </h1>

              <p className="mt-2 text-2xl md:text-5xl font-light text-slate-300 drop-shadow-lg max-w-4xl">
                The Evolution of <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">Improvement</span>
              </p>

              <div className="w-16 h-px bg-gradient-to-r from-transparent via-slate-500 to-transparent mt-4" />

              <div className="mt-2 flex flex-col items-center gap-1.5 font-light leading-relaxed text-center">
                <span className="text-base md:text-lg text-slate-300">A social innovation firm building AI-powered tools for growth.</span>
                <span className="text-sm md:text-base text-slate-400">Agentic automation, analytics dashboards, and community resources.</span>
                <span className="text-xs md:text-sm text-slate-400/80">Rooted in science. Driven by data. Designed to be fun.</span>
              </div>
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
            <section className="relative py-16 md:py-20 w-full flex flex-col items-center justify-center bg-transparent z-20">
              <div className="w-full px-6 md:px-12 lg:px-24">
                <div className="text-center max-w-4xl mx-auto space-y-6 mb-16">
                  <h2 className="font-nunito text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-xl">Affordable Agentic Solutions</h2>
                  <div className="h-1 bg-gradient-to-r from-fuchsia-600 via-indigo-500 to-transparent mx-auto rounded-full w-16 mb-4" />
                  <p className="text-slate-300 text-lg font-light">
                    Premium products and services designed for your evolution.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                  {[
                    {
                      id: 1,
                      title: "Agentic Email Assistant",
                      price: "$5.99 a month",
                      description: (
                        <>Access our inbound and outbound email agents that automatically respond to emails, draft professional responses, and create campaign emails. Our AI operates exclusively <b>within the Google product ecosystem</b>.</>
                      ),
                      image: "/images/email_agent_card.png"
                    },
                    {
                      id: 2,
                      title: "Google Suite Assistant",
                      price: "$12.99 a month",
                      description: (
                        <>Access our entire suite of Google AI agents, including our <b>Calendar Agent, Email Agent, and Phone Agent</b>. Essentially capable of accessing any Google Suite tools to <i>completely automate your workflow</i>.</>
                      ),
                      image: "/images/google_suite_card.png"
                    },
                    {
                      id: 3,
                      title: "Dashboard Access",
                      price: "$22.99 a month",
                      description: (
                        <>Unlock predictive analytics, get full access to the entire Google Suite agent, priority support, and our communications network. This tier includes <b>everything our platform has to offer</b>.</>
                      ),
                      image: "/images/dashboard_access_card.jpg"
                    },
                    {
                      id: 4,
                      title: "Customized Solutions",
                      price: "Subject to Scale",
                      description: (
                        <>A stylized dashboard heavily tailored to your specific organization's needs. The price varies entirely depending on the scale and <Link href="/consultation" className="hover:text-white transition-colors cursor-pointer"><b><u>requires a consultation</u></b></Link> with <i>our development team</i>.</>
                      ),
                      image: "/images/custom_solutions_card.jpg"
                    }
                  ].map((item) => (
                    <div key={item.id} className="group relative">
                      <Card className="relative bg-black/40 backdrop-blur-sm border border-white/10 overflow-hidden flex flex-col transition-all duration-500 group-hover:border-fuchsia-500/50 group-hover:bg-white/5 group-hover:-translate-y-2 rounded-3xl z-10 shadow-lg">
                        <div className="w-full relative overflow-hidden aspect-[3/2]">
                          <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        </div>
                        <CardHeader className="pt-4 px-5 md:px-6 relative z-20 flex-grow">
                          <CardTitle className="font-headline text-lg md:text-xl font-bold text-white group-hover:text-fuchsia-300 transition-colors duration-500 leading-tight">
                            {item.title}
                          </CardTitle>
                          <span className="text-white/70 text-xs md:text-sm font-medium mt-1 block">{item.price}</span>
                          <div className="w-8 h-px bg-white/20 mt-2 mb-2" />
                          <div className="text-slate-400 text-xs md:text-sm leading-relaxed line-clamp-4">
                            {item.description}
                          </div>
                        </CardHeader>
                        <div className="px-5 md:px-6 pb-4 pt-0 mt-auto">
                          {item.id === 4 ? (
                            <Link href="/contact" className="block w-full text-center py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm md:text-base hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 hover:text-fuchsia-400 transition-all duration-300 backdrop-blur-sm cursor-pointer z-30">
                              Contact Team
                            </Link>
                          ) : (
                            <Link href={`/checkout/${item.id}`} className="group/btn relative block w-full text-center py-3 px-4 rounded-xl bg-black/80 border border-white/10 text-white font-semibold text-sm md:text-base hover:bg-purple-900 hover:border-purple-500/50 transition-all duration-300 cursor-pointer z-30 overflow-hidden">
                              <span className="flex items-center justify-center gap-2 transition-all duration-300 opacity-100 translate-y-0 group-hover/btn:opacity-0 group-hover/btn:-translate-y-3">See More</span>
                              <span className="absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300 opacity-0 translate-y-3 group-hover/btn:opacity-100 group-hover/btn:translate-y-0"><ShoppingCart className="w-4 h-4" /> Checkout</span>
                            </Link>
                          )}
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
                    We provide a platform for A-Hope, B-Tools, C-Practice. Every product must demonstrate a <span className="text-fuchsia-300 font-semibold px-2 bg-fuchsia-500/10 rounded-md py-0.5 border border-fuchsia-500/20 shadow-sm shadow-fuchsia-500/10">SPF (Simple, Practical and Fun)</span> rating across its products and community.
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
            


            {/* SECTION 4 & 5 Combined: Dense Protocol Overview */}
            <section id="qualifies" className="relative py-32 md:py-48 w-full flex flex-col items-center justify-center bg-transparent z-40 shadow-2xl overflow-hidden">
              <motion.div
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="container mx-auto px-4 w-full flex flex-col justify-center"
              >
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
              </motion.div>
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
