import { Logo } from '@/components/logo';
import Link from 'next/link';
import { SolTheoryLogoText } from '../sol-theory-logo-text';

const navLinks = [
  { href: "/", label: "Home" },
  { href: "#qualifies", label: "About" },
  { href: "#subscribe", label: "What's New" },
]

export function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-20 py-4">
      <div className="container mx-auto px-4 flex items-center">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo className="h-10 w-10" />
          <SolTheoryLogoText />
        </Link>
        <nav className="ml-auto mr-8">
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
