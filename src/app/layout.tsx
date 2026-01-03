import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';

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
        <div 
          className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/About%20SOL%20Theory%20Page%20(1).png?alt=media&token=fd7b3e2d-309d-4462-a736-7e51e80456d0')",
          }}
        />
        <div className="relative z-10">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}