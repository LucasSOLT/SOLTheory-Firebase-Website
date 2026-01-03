import { Logo } from '@/components/logo';

export function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-20 py-4">
      <div className="container mx-auto px-4 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <span className="font-headline text-2xl tracking-wider text-foreground font-bold">
            SOL Theory
          </span>
        </div>
      </div>
    </header>
  );
}
