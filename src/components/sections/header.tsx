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
import { useUser } from '@/firebase';
import { useAuthStore } from '@/hooks/use-auth-store';
import { UserNav } from '@/components/auth/UserNav';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '#qualifies', label: 'About' },
  { href: '#subscribe', label: "What's New" },
];

const dropdownMenuItems = [
    { href: '/portal/login', label: 'Client Portal' },
    { type: 'separator' as const },
    { href: 'https://www.lifenavigation.ai', label: 'LifeNavigationU', target: '_blank' },
    { href: 'https://www.thrivecoaching.ai', label: 'Thrive Coaching', target: '_blank' },
    { type: 'separator' as const },
    { href: '#', label: 'Help' },
    { href: '#', label: 'Contact' },
];


import { usePathname } from 'next/navigation';

export function Header() {
  const { user, isUserLoading } = useUser();
  const { openAuthDialog } = useAuthStore();
  const pathname = usePathname();
  const isNxtChapter = pathname?.startsWith('/portal/dashboard/nxtchapter');

  return (
    <header className="fixed top-0 left-0 right-0 z-50 py-3 bg-black/50 backdrop-blur-xl border-b border-white/5">
      <div className="container mx-auto px-4 flex items-center justify-between relative">
        <Link href="/" className="flex items-center gap-2 group">
          {!isNxtChapter && <Logo className="h-6 w-6" />}
          {isNxtChapter ? (
            <span className="font-bold text-lg text-white">NXT Chapter</span>
          ) : (
            <SolTheoryLogoText />
          )}
        </Link>
        
        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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

        <div className="flex items-center gap-2">
            {!isUserLoading && !user && (
              <Button onClick={() => openAuthDialog()}>Login</Button>
            )}
            
            {user && <UserNav />}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-8 w-8 text-white" />
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

            <Button asChild variant="default" className="ml-2">
                <Link href="/portal/login">
                    Client Portal
                </Link>
            </Button>
        </div>
      </div>
    </header>
  );
}
