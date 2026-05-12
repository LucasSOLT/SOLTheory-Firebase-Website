'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, CreditCard, Play, Shield, Lock, Check } from 'lucide-react';
import { StarBackground } from '@/components/ui/star-background';

const PRODUCTS: Record<string, {
  title: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  image: string;
}> = {
  '1': {
    title: 'Agentic Email Assistant',
    price: 5.99,
    period: '/month',
    description: 'AI-powered inbound and outbound email automation within the Google product ecosystem.',
    features: [
      'Automatic email responses',
      'Professional draft generation',
      'Campaign email creation',
      'Google Workspace integration',
    ],
    image: '/images/email_agent_card.png',
  },
  '2': {
    title: 'Google Suite Assistant',
    price: 12.99,
    period: '/month',
    description: 'Full access to our entire suite of Google AI agents for complete workflow automation.',
    features: [
      'Calendar Agent',
      'Email Agent',
      'Phone Agent',
      'Full Google Suite access',
      'Complete workflow automation',
    ],
    image: '/images/google_suite_card.png',
  },
  '3': {
    title: 'Dashboard Access',
    price: 22.99,
    period: '/month',
    description: 'The complete SOL Theory platform — predictive analytics, all agents, priority support, and our communications network.',
    features: [
      'Predictive analytics dashboard',
      'All Google Suite agents',
      'Priority support',
      'Communications network access',
      'Everything SOL Theory offers',
    ],
    image: '/images/dashboard_access_card.jpg',
  },
};

export default function CheckoutPage() {
  const params = useParams();
  const productId = params.productId as string;
  const product = PRODUCTS[productId];

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
    zip: '',
  });

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Product not found</h1>
          <Link href="/" className="text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const tax = +(product.price * 0.08).toFixed(2);
  const total = +(product.price + tax).toFixed(2);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <StarBackground />
      </div>

      {/* Navigation */}
      <nav className="relative z-20 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>Secure Checkout</span>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-20">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-jakarta text-3xl md:text-4xl font-bold text-white tracking-tight">
            Complete Your Order
          </h1>
          <p className="text-slate-400 mt-2 text-sm">You&apos;re subscribing to <span className="text-fuchsia-400 font-medium">{product.title}</span></p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Left Column — Video + Form (3/5 width) */}
          <div className="lg:col-span-3 space-y-8">

            {/* Video Section */}
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
              <div className="aspect-video w-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-black group cursor-pointer">
                <img
                  src={product.image}
                  alt={product.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                <div className="relative z-10 flex flex-col items-center gap-4 group-hover:scale-105 transition-transform duration-500">
                  <div className="w-20 h-20 rounded-full border-2 border-white/30 flex items-center justify-center backdrop-blur-md bg-white/5 group-hover:bg-fuchsia-500/20 group-hover:border-fuchsia-400/50 transition-all duration-500">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                  <span className="text-sm text-slate-400 tracking-widest uppercase font-medium group-hover:text-fuchsia-300 transition-colors">Watch Product Overview</span>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-8">
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center text-xs font-bold text-fuchsia-400">1</span>
                Customer Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 transition-all text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-8">
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center text-xs font-bold text-fuchsia-400">2</span>
                Payment Method
              </h2>

              {/* Method Toggle */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl border text-sm font-medium transition-all duration-300 cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-fuchsia-500/10 border-fuchsia-500/40 text-fuchsia-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Credit / Debit Card
                </button>
                <button
                  onClick={() => setPaymentMethod('paypal')}
                  className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl border text-sm font-medium transition-all duration-300 cursor-pointer ${
                    paymentMethod === 'paypal'
                      ? 'bg-fuchsia-500/10 border-fuchsia-500/40 text-fuchsia-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.603c-.564 0-1.04.408-1.13.964L7.076 21.337zm7.702-15.12H8.743L7.337 15.77h2.287c4.443 0 7.044-1.986 7.738-5.57.41-2.117-.09-3.983-2.584-3.983z"/></svg>
                  PayPal
                </button>
              </div>

              {paymentMethod === 'card' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Card Number</label>
                    <input
                      type="text"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={handleChange}
                      placeholder="4242 4242 4242 4242"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 transition-all text-sm tracking-wider"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Expiry</label>
                      <input
                        type="text"
                        name="expiry"
                        value={formData.expiry}
                        onChange={handleChange}
                        placeholder="MM / YY"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">CVC</label>
                      <input
                        type="text"
                        name="cvc"
                        value={formData.cvc}
                        onChange={handleChange}
                        placeholder="123"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Zip Code</label>
                      <input
                        type="text"
                        name="zip"
                        value={formData.zip}
                        onChange={handleChange}
                        placeholder="10001"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0070ba]/10 border border-[#0070ba]/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#0070ba]" viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.603c-.564 0-1.04.408-1.13.964L7.076 21.337zm7.702-15.12H8.743L7.337 15.77h2.287c4.443 0 7.044-1.986 7.738-5.57.41-2.117-.09-3.983-2.584-3.983z"/></svg>
                  </div>
                  <p className="text-slate-400 text-sm">You will be redirected to PayPal to complete your purchase.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column — Order Summary (2/5 width) */}
          <div className="lg:col-span-2">
            <div className="sticky top-8 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
              {/* Product Image Header */}
              <div className="h-40 relative overflow-hidden">
                <img src={product.image} alt={product.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <h3 className="text-white font-bold text-lg">{product.title}</h3>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Description */}
                <p className="text-slate-400 text-sm leading-relaxed">{product.description}</p>

                {/* Features */}
                <div className="space-y-2.5">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">What&apos;s Included</span>
                  {product.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10" />

                {/* Pricing */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="text-white">${product.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Tax (estimated)</span>
                    <span className="text-white">${tax.toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-white font-semibold">Total</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-white">${total.toFixed(2)}</span>
                      <span className="text-slate-500 text-sm ml-1">{product.period}</span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button className="w-full py-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-semibold text-base hover:from-fuchsia-500 hover:to-indigo-500 transition-all duration-300 shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer">
                  {paymentMethod === 'paypal' ? 'Continue to PayPal' : `Subscribe — $${total.toFixed(2)}${product.period}`}
                </button>

                {/* Trust Badges */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Shield className="w-3.5 h-3.5" />
                    <span>SSL Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Secure Payment</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
