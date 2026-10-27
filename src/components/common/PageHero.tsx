import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSettings } from '../../hooks/settings/useSettings';
import { fetchBackgrounds } from '../../utils/fetch/data';
import { cn } from '@/lib/utils';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;
const DEFAULT_BACKGROUND = 'url("/assets/images/hero.webp")';

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

function getImageUrl(filename: string | null): string | null {
  if (!filename || filename === 'random' || filename === 'favorites') {
    return null;
  }
  if (filename.startsWith('https://api.cephie.app/')) {
    return filename;
  }
  return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
}

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
  const { settings } = useSettings();
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);

  useEffect(() => {
    fetchBackgrounds()
      .then(setAvailableImages)
      .catch((error) =>
        console.error('Error loading available images:', error)
      );
  }, []);

  const backgroundImage = useMemo(() => {
    const selectedImage = settings?.backgroundImage?.selectedImage;

    if (selectedImage === 'random') {
      if (availableImages.length === 0) return DEFAULT_BACKGROUND;
      const image =
        availableImages[Math.floor(Math.random() * availableImages.length)];
      return `url(${API_BASE_URL}${image.path})`;
    }

    if (selectedImage === 'favorites') {
      const favorites = settings?.backgroundImage?.favorites || [];
      if (favorites.length === 0) return DEFAULT_BACKGROUND;
      const url = getImageUrl(
        favorites[Math.floor(Math.random() * favorites.length)]
      );
      return url ? `url(${url})` : DEFAULT_BACKGROUND;
    }

    const url = getImageUrl(selectedImage ?? null);
    return url ? `url(${url})` : DEFAULT_BACKGROUND;
  }, [
    settings?.backgroundImage?.selectedImage,
    settings?.backgroundImage?.favorites,
    availableImages,
  ]);

  useEffect(() => {
    if (backgroundImage !== DEFAULT_BACKGROUND) setCustomLoaded(true);
  }, [backgroundImage]);

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
          style={{ backgroundImage, opacity: customLoaded ? 1 : 0 }}
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
