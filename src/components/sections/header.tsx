"use client";

import { Logo } from '@/components/logo';
import Link from 'next/link';
import { SolTheoryLogoText } from '../sol-theory-logo-text';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '#qualifies', label: 'About' },
  { href: '#subscribe', label: "What's New" },
];

const dropdownMenuItems = [
    { href: '/', label: 'Home' },
    { href: '#qualifies', label: 'About' },
    { href: '#subscribe', label: "What's New" },
    { type: 'separator' as const },
    { href: '#', label: 'NXT Chapter' },
    { href: 'https://www.lifenavigation.ai', label: 'LifeNavigationU', target: '_blank' },
    { href: 'https://www.thrivecoaching.ai', label: 'Thrive Coaching', target: '_blank' },
    { href: 'https://www.21games.ai', label: 'Twenty-One Games', target: '_blank' },
    { type: 'separator' as const },
    { href: '#', label: 'Help' },
    { href: '#', label: 'Contact' },
];


export function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-20 py-4">
      <div className="container mx-auto px-4 flex items-center">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo className="h-10 w-10" />
          <SolTheoryLogoText />
        </Link>
        <div className="ml-auto flex items-center gap-2">
            <nav className="hidden md:flex">
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
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {dropdownMenuItems.map((item, index) => {
                        if (item.type === 'separator') {
                            return <DropdownMenuSeparator key={`sep-${index}`} />;
                        }
                        return (
                            <DropdownMenuItem key={item.label} asChild>
                                <Link href={item.href!} target={item.target} rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}>
                                    {item.label}
                                </Link>
                            </DropdownMenuItem>
                        )
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
