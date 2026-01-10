import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import Image from 'next/image';

const iconUrl = "https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=c0e9a9fd-eadf-4e3b-9e0f-a16d867d554e";

export const metadata: Metadata = {
  title: 'SOL Theory Reimagined',
  description: 'Unlock Your Potential. Redefine Your Reality.',
  icons: {
    icon: iconUrl,
    shortcut: iconUrl,
    apple: iconUrl,
  },
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
            <Image
                src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/About%20SOL%20Theory%20Page%20(1).png?alt=media&token=fd7b3e2d-309d-4462-a736-7e51e80456d0"
                alt="Galaxy background"
                fill
                className="object-cover"
            />
            <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="relative z-10">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
