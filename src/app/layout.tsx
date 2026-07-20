import type { Metadata, Viewport } from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ThemeProvider } from '@/components/ThemeProvider';
import RouteProgressBar from '@/components/RouteProgressBar';

import { Playfair_Display, PT_Sans, Nunito, Sora, Cormorant_Garamond } from 'next/font/google';
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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

const nunito = Nunito({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nunito',
});

const jakarta = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});

// Inline script to prevent flash-of-unstyled-content (FOUC) on page load.
// Runs before React hydrates so the correct theme class is on <html> immediately.
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('insight_theme');
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch(e){}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(playfair.variable, ptSans.variable, nunito.variable, jakarta.variable, cormorant.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <ThemeProvider>
            <RouteProgressBar />
            {children}
            <Toaster />
          </ThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}

