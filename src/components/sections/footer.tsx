import { Logo } from "@/components/logo";
import { Twitter, Instagram, Linkedin } from "lucide-react";
import Link from 'next/link';

const socialLinks = [
    { icon: <Twitter className="size-5" />, href: "#", label: "Twitter" },
    { icon: <Instagram className="size-5" />, href: "#", label: "Instagram" },
    { icon: <Linkedin className="size-5" />, href: "#", label: "LinkedIn" },
];

export function Footer() {
    return (
        <footer className="bg-card/50 border-t border-border/50 py-8">
            <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                    <Logo className="h-8 w-8" />
                    <span className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} SOL Theory. All Rights Reserved.</span>
                </div>
                <div className="flex items-center gap-4">
                    {socialLinks.map(link => (
                        <Link key={link.label} href={link.href} aria-label={link.label} className="text-muted-foreground hover:text-primary transition-colors">
                            {link.icon}
                        </Link>
                    ))}
                </div>
            </div>
        </footer>
    )
}
