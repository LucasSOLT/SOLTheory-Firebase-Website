import { Logo } from "@/components/logo";
import { Twitter, Instagram, Linkedin } from "lucide-react";
import Link from 'next/link';

const socialLinks = [
    { icon: <Twitter className="size-4" />, href: "#", label: "Twitter" },
    { icon: <Instagram className="size-4" />, href: "#", label: "Instagram" },
    { icon: <Linkedin className="size-4" />, href: "#", label: "LinkedIn" },
];

export function Footer() {
    return (
        <footer className="relative border-t border-white/5 py-5 bg-black/20 backdrop-blur-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Logo className="h-5 w-5 opacity-70" />
                    <span className="text-sm text-slate-500 font-medium">&copy; {new Date().getFullYear()} MyTaj LLC d/b/a SOLTheory. All Rights Reserved.</span>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/privacy" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</Link>
                    <span className="text-slate-700">·</span>
                    <Link href="/terms" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</Link>
                </div>
                <div className="flex items-center gap-1">
                    {socialLinks.map(link => (
                        <Link
                            key={link.label}
                            href={link.href}
                            aria-label={link.label}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                        >
                            {link.icon}
                        </Link>
                    ))}
                </div>
            </div>
        </footer>
    )
}
