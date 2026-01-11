import Image from 'next/image';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Logo({className, ...props}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props}>
      <Image
        src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440"
        alt="SOL Theory Logo"
        width={100}
        height={100}
        className={cn("h-full w-full brightness-0 invert", className)}
      />
    </div>
  );
}
