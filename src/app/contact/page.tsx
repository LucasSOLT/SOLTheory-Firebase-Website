'use client';

import { Header } from '@/components/sections/header';
import { Footer } from '@/components/sections/footer';
import { StarBackground } from '@/components/ui/star-background';
import { Mail, Phone, Wrench, ArrowLeft, ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const contactItems = [
  {
    icon: Mail,
    label: 'General Inquiries',
    value: 'team@soltheory.com',
    href: 'mailto:team@soltheory.com',
    description: 'For partnerships, business inquiries, and general questions.',
    gradient: 'from-fuchsia-500/20 to-indigo-500/20',
    iconBg: 'bg-fuchsia-500/20 border-fuchsia-500/30',
    iconColor: 'text-fuchsia-400',
  },
  {
    icon: Phone,
    label: 'Phone',
    value: '(720) 588-2002',
    href: 'tel:+17205882002',
    description: 'Available Monday – Friday, 9 AM – 6 PM MST.',
    gradient: 'from-emerald-500/20 to-cyan-500/20',
    iconBg: 'bg-emerald-500/20 border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Wrench,
    label: 'Technical Issues',
    value: 'lucas@soltheory.com',
    href: 'mailto:lucas@soltheory.com',
    description: 'For bugs, platform issues, or technical support — reach the CTO directly.',
    gradient: 'from-amber-500/20 to-orange-500/20',
    iconBg: 'bg-amber-500/20 border-amber-500/30',
    iconColor: 'text-amber-400',
    badge: 'CTO',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.12, duration: 0.6, ease: 'easeOut' as const },
  }),
};

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-x-hidden">
      <div className="absolute top-0 w-full z-50 fixed">
        <Header />
      </div>

      <main className="flex-grow z-10 w-full relative">
        <div className="relative w-full min-h-screen overflow-hidden">
          <StarBackground />

          {/* Ambient glow effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.15, 0.08] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-gradient-to-tr from-fuchsia-600/30 to-indigo-500/20 rounded-full blur-[140px]"
            />
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.06, 0.12, 0.06] }}
              transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              className="absolute bottom-[5%] right-[10%] w-[600px] h-[600px] bg-gradient-to-bl from-cyan-500/20 to-purple-500/20 rounded-full blur-[140px]"
            />
          </div>

          <div className="relative z-10 container mx-auto px-4 pt-36 pb-24 flex flex-col items-center">
            {/* Back link */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="self-start mb-10"
            >
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-fuchsia-400 transition-colors font-medium group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Home
              </Link>
            </motion.div>

            {/* Page Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center mb-16 space-y-5"
            >
              <h1 className="font-nunito text-5xl md:text-7xl font-bold text-white tracking-tight drop-shadow-2xl">
                Contact Us
              </h1>
              <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
                Have a question, idea, or need technical help? We'd love to hear from you — pick the right channel below.
              </p>
            </motion.div>

            {/* Contact Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
              {contactItems.map((item, idx) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  custom={idx}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  className="group relative block"
                >
                  {/* Hover glow */}
                  <div className={`absolute inset-0 bg-gradient-to-b ${item.gradient} rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

                  <div className="relative bg-black/40 backdrop-blur-sm border border-white/10 rounded-3xl p-8 h-full flex flex-col items-center text-center transition-all duration-500 group-hover:border-fuchsia-500/40 group-hover:bg-white/5 group-hover:-translate-y-2 shadow-lg">
                    {/* Badge */}
                    {item.badge && (
                      <span className="absolute top-4 right-4 px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest rounded-full">
                        {item.badge}
                      </span>
                    )}

                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-2xl ${item.iconBg} border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                      <item.icon className={`w-7 h-7 ${item.iconColor}`} />
                    </div>

                    {/* Label */}
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                      {item.label}
                    </span>

                    {/* Value */}
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-fuchsia-300 transition-colors duration-500 flex items-center gap-2">
                      {item.value}
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>

                    {/* Description */}
                    <p className="text-slate-400 text-sm leading-relaxed flex-grow">
                      {item.description}
                    </p>

                    {/* Bottom accent line */}
                    <div className="w-12 h-1 bg-gradient-to-r from-fuchsia-500 to-indigo-500 rounded-full mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>
                </motion.a>
              ))}
            </div>

            {/* Bottom tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-slate-600 text-sm font-medium mt-16 text-center"
            >
              Response time is typically within 24 hours.
            </motion.p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-50 border-t border-white/10 bg-black/90 pt-8 backdrop-blur-md">
          <Footer />
        </div>
      </main>
    </div>
  );
}
