import { SubscriptionForm } from '@/components/subscription-form';

export function SubscriptionSection() {
  return (
    <section id="subscribe" className="py-20 md:py-32 bg-secondary/20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-headline text-4xl md:text-5xl text-foreground">Want In?</h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Join the inner circle. Be the first to know about new releases, exclusive content, and upcoming events.
        </p>
        <div className="mt-8 max-w-md mx-auto">
          <SubscriptionForm />
        </div>
      </div>
    </section>
  );
}
