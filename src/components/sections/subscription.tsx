import { SubscriptionForm } from '@/components/subscription-form';

export function SubscriptionSection() {
  return (
    <section id="subscribe" className="py-24 md:py-40 bg-[#0A0A0B] w-full">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-nunito text-5xl md:text-7xl text-white font-bold tracking-tight drop-shadow-xl">Want In?</h2>
        <p className="mt-6 text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto font-light leading-relaxed">
          Join the inner circle. Be the first to know about new releases, exclusive content, and upcoming architectural events.
        </p>
        <div className="mt-12 max-w-2xl mx-auto p-4 md:p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-2xl shadow-2xl">
          <SubscriptionForm />
        </div>
      </div>
    </section>
  );
}