import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import Image from 'next/image';
import { FirebaseClientProvider } from '@/firebase';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { ProfileSetupDialog } from '@/components/auth/ProfileSetupDialog';
import { Playfair_Display, PT_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';

const iconUrl = "https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440";

export const metadata: Metadata = {
  title: 'SOL Theory',
  description: 'Unlock Your Potential. Redefine Your Reality.',
  icons: {
    icon: {
      url: iconUrl,
      type: 'image/png',
    },
    shortcut: {
      url: iconUrl,
      type: 'image/png',
    },
    apple: {
      url: iconUrl,
      type: 'image/png',
      sizes: '180x180',
    },
  },
};

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
});

const ptSans = PT_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-pt-sans',
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", playfair.variable, ptSans.variable)}>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <AuthDialog />
          <ProfileSetupDialog />
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
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
