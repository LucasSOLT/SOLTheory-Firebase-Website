import Image from 'next/image';
import type { HTMLAttributes } from 'react';

export function Logo(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props}>
      <Image
        src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=c0e9a9fd-eadf-4e3b-9e0f-a16d867d554e"
        alt="SOL Theory Logo"
        width={100}
        height={100}
        className="h-full w-full"
      />
    </div>
  );
}
