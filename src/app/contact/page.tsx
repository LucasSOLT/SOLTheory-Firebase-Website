'use client';

import { useState } from 'react';
import { Header } from '@/components/sections/header';
import { Footer } from '@/components/sections/footer';
import { StarBackground } from '@/components/ui/star-background';
import { Mail, Phone, Wrench, ArrowLeft, ExternalLink, Sparkles, Send, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';

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
  const { t, lang } = useTranslation();

  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit form');
      }
      setSubmitted(true);
    } catch (err: any) {
      console.error('Contact form submission error:', err);
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
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
                {lang === 'es' ? 'Volver al Inicio' : 'Back to Home'}
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
                {lang === 'es' ? 'Contáctanos' : 'Contact Us'}
              </h1>
              <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
                {lang === 'es' ? '¿Tienes una pregunta, idea o necesitas ayuda técnica? Nos encantaría saber de ti — elige el canal correcto a continuación.' : "Have a question, idea, or need technical help? We'd love to hear from you — pick the right channel below."}
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

            {/* Interactive Contact Form */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="w-full max-w-3xl mt-16 bg-black/50 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-fuchsia-400" />
                {lang === 'es' ? 'Envíanos un Mensaje Directo' : 'Send Us a Direct Message'}
              </h2>
              <p className="text-slate-400 text-sm mb-8">
                {lang === 'es' ? 'Llena el formulario a continuación y nos pondremos en contacto contigo lo antes posible.' : 'Fill out the form below and our team will get right back to you.'}
              </p>

              {submitted ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                  <h3 className="text-xl font-bold text-white">
                    {lang === 'es' ? '¡Mensaje Enviado con Éxito!' : 'Message Sent Successfully!'}
                  </h3>
                  <p className="text-emerald-200 text-sm">
                    {lang === 'es' ? 'Gracias por contactarnos. Responderemos a tu correo electrónico pronto.' : 'Thank you for reaching out. We have received your submission and will reply via email.'}
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                    className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    {lang === 'es' ? 'Enviar Otro Mensaje' : 'Send Another Message'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {errorMessage && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl p-4">
                      {errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        {lang === 'es' ? 'Nombre Completo' : 'Full Name'} *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        {lang === 'es' ? 'Correo Electrónico' : 'Email Address'} *
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="john@example.com"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      {lang === 'es' ? 'Asunto' : 'Subject'}
                    </label>
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      placeholder={lang === 'es' ? '¿En qué te podemos ayudar?' : 'How can we help?'}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      {lang === 'es' ? 'Mensaje' : 'Message'} *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder={lang === 'es' ? 'Escribe tu mensaje aquí...' : 'Write your message here...'}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-8 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {lang === 'es' ? 'Enviando...' : 'Sending Message...'}
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {lang === 'es' ? 'Enviar Mensaje' : 'Send Message'}
                      </>
                    )}
                  </button>
                </form>
              )}
            </motion.div>

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
