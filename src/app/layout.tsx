import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import InteractiveSpaceship from '@/components/interactive-spaceship';

export const metadata: Metadata = {
  title: 'SOL Theory Reimagined',
  description: 'Unlock Your Potential. Redefine Your Reality.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&family=Questrial&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <div className="fixed inset-0 z-[-1]">
          <InteractiveSpaceship />
        </div>
        <div className="relative z-10">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
