import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NXT Chapter Dashboard',
  icons: {
    icon: {
      url: '/nxt_logo.png',
      type: 'image/png',
    },
    shortcut: {
      url: '/nxt_logo.png',
      type: 'image/png',
    },
    apple: {
      url: '/nxt_logo.png',
      type: 'image/png',
    },
  },
};

export default function NxtChapterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
