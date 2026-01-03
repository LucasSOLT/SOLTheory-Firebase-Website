import { Logo } from '@/components/logo';
import Link from 'next/link';

const navLinks = [
  { href: "/", label: "Home" },
  { href: "#qualifies", label: "About" },
  { href: "#subscribe", label: "What's New" },
]

export function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-20 py-4">
      <div className="container mx-auto px-4 flex items-center justify-start gap-16">
        <Link href="/" className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <span className="font-headline text-2xl tracking-wider text-foreground font-bold">
            SOL Theory
          </span>
        </Link>
        <nav>
          <ul className="flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-lg text-muted-foreground hover:text-primary transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
