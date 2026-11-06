import { cn } from '@/lib/utils';

export default function SupporterLogo({ className }: { className?: string }) {
  return (
    <img
      src="/assets/images/supporter-tower.webp"
      alt=""
      aria-hidden
      className={cn('size-4 shrink-0 object-contain', className)}
    />
  );
}
