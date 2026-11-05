import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

export default function SupporterIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('size-4 shrink-0', className)}
      {...props}
    >
      <path d="M12 5.5l1.35 3.64 3.88.16-3.04 2.41 1.04 3.74L12 13.3l-3.23 2.15 1.04-3.74L6.77 9.3l3.88-.16z" />
      <path d="M5.2 11C3.6 10.6 2.4 9.6 1.5 8.2" />
      <path d="M5.8 14.1c-1.5-.2-2.7-.9-3.5-1.9" />
      <path d="M7.6 17.2c-1.3 0-2.5-.4-3.4-1.1" />
      <path d="M18.8 11c1.6-.4 2.8-1.4 3.7-2.8" />
      <path d="M18.2 14.1c1.5-.2 2.7-.9 3.5-1.9" />
      <path d="M16.4 17.2c1.3 0 2.5-.4 3.4-1.1" />
    </svg>
  );
}
