import { ringStyle, supporterRingClass } from '@/lib/plans';
import { cn } from '@/lib/utils';
import type { PaidPlan, SupporterRing } from '../../types/billing';

interface SupporterAvatarProps {
  src: string;
  alt: string;
  plan?: PaidPlan | null;
  ring?: SupporterRing;
  colors?: string[];
  className?: string;
}

export default function SupporterAvatar({
  src,
  alt,
  plan,
  ring,
  colors,
  className,
}: SupporterAvatarProps) {
  const ringClass = supporterRingClass(plan, ring);
  const style = plan ? ringStyle(ring, colors) : undefined;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full',
        ringClass && ['supporter-ring', ringClass],
        className
      )}
      style={style}
    >
      <img
        src={src}
        alt={alt}
        className="size-full rounded-full bg-zinc-800 object-cover"
        onError={(e) => {
          e.currentTarget.src = '/assets/app/default/avatar.webp';
        }}
      />
    </span>
  );
}
