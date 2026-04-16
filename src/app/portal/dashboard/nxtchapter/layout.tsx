import type { Metadata } from 'next';

export const metadata: Metadata = {
  icons: {
    icon: '/nxt_logo.png',
  },
};

export default function NxtChapterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
