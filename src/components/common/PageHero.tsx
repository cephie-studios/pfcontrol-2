import type { ReactNode } from 'react';
import { useBackgroundImage } from '../../hooks/settings/useBackgroundImage';
import { cn } from '@/lib/utils';

export default function PageHero({
  title,
  className,
  overlayClassName,
  children,
}: {
  title: string;
  className?: string;
  overlayClassName?: string;
  children?: ReactNode;
}) {
  const backgroundUrl = useBackgroundImage();

  return (
    <div
      className={cn('relative h-80 w-full overflow-hidden md:h-96', className)}
    >
      <div className="absolute inset-0">
        <img
          src="/assets/images/hero.webp"
          alt=""
          className="h-full w-full scale-110 object-cover"
        />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500"
          style={{
            backgroundImage: backgroundUrl
              ? `url(${backgroundUrl})`
              : undefined,
            opacity: backgroundUrl ? 1 : 0,
          }}
        />
        <div
          className={cn(
            'absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background',
            overlayClassName
          )}
        />
      </div>
      <div className="relative flex h-full flex-col items-center justify-center gap-6 px-4 sm:px-6 md:px-10">
        <h1 className="text-center text-3xl font-black tracking-tight sm:text-5xl md:text-6xl">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}
