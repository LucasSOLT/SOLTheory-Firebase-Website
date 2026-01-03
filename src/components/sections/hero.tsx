import { IntergalacticScene } from '@/components/intergalactic-scene';
import { ArrowDown } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <IntergalacticScene />
         <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background"></div>
      </div>
      
      <div className="relative z-10 text-center px-4 animate-fade-in" style={{ animationDelay: '0.5s' }}>
        <h1 className="font-headline text-5xl md:text-7xl lg:text-8xl text-foreground font-bold">
          Unlock Your Potential
        </h1>
        <p className="mt-4 text-lg md:text-xl text-primary max-w-2xl mx-auto">
          Redefine Your Reality
        </p>
        <div className="mt-8 text-sm text-muted-foreground/80 font-code border border-border rounded-full px-4 py-2 max-w-sm mx-auto">
          Use WASD or Arrow Keys to navigate
        </div>
      </div>
      
      <div className="absolute bottom-10 z-10 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-sm text-muted-foreground">Scroll Down</span>
          <ArrowDown className="w-5 h-5 text-muted-foreground" />
      </div>
    </section>
  );
}
