import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { fetchBackgrounds } from '../../utils/fetch/data';
import type { Settings } from '../../types/settings';
import SettingsSection from './SettingsSection';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

interface CephieSnapImage {
  id: string;
  url: string;
  time: number;
}

interface BackgroundImageSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

type BackgroundMode = 'none' | 'image' | 'random' | 'favorites';

const TILE_CLASS =
  'relative block aspect-video w-full overflow-hidden rounded-xl bg-muted outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring';
const SELECTED_TILE_CLASS =
  'ring-2 ring-primary ring-offset-2 ring-offset-card focus-visible:ring-primary';

interface BackgroundImageItemProps {
  image: AvailableImage;
  index: number;
  isSelected: boolean;
  isFavorite: boolean;
  isImageLoaded: boolean;
  photoCredit: string | null;
  onSelectImage: (filename: string) => void;
  onToggleFavorite: (filename: string) => void;
  onImageLoad: (path: string) => void;
}

function BackgroundImageItem({
  image,
  index,
  isSelected,
  isFavorite,
  isImageLoaded,
  photoCredit,
  onSelectImage,
  onToggleFavorite,
  onImageLoad,
}: BackgroundImageItemProps) {
  const fullImageUrl = `${API_BASE_URL}${image.path}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const label = photoCredit
    ? `Background ${index + 1}, photo by @${photoCredit}`
    : `Background ${index + 1}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => onSelectImage(image.filename)}
        aria-pressed={isSelected}
        aria-label={label}
        title={photoCredit ? `Photo by @${photoCredit}` : undefined}
        className={cn(TILE_CLASS, isSelected && SELECTED_TILE_CLASS)}
      >
        {!isImageLoaded && (
          <span className="absolute inset-0 animate-pulse bg-muted" />
        )}
        {inView && (
          <img
            src={fullImageUrl}
            alt=""
            className={cn(
              'size-full object-cover transition-opacity duration-300',
              isImageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => onImageLoad(image.path)}
          />
        )}
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute top-2 right-2"
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            onClick={() => onToggleFavorite(image.filename)}
          >
            <Star
              className={cn(
                isFavorite
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground'
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function StatusLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export default function BackgroundImageSettings({
  settings,
  onChange,
}: BackgroundImageSettingsProps) {
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [cephieSnapImages, setCephieSnapImages] = useState<CephieSnapImage[]>(
    []
  );
  const [loadingImages, setLoadingImages] = useState(false);
  const [loadingCephieSnap, setLoadingCephieSnap] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  // "Image" mode picked, but no image clicked yet. Stores the selection it was
  // picked from so it resets as soon as the selection changes.
  const [pendingImageFrom, setPendingImageFrom] = useState<
    string | null | undefined
  >(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAvailableImages();
    loadCephieSnapImages();
  }, []);

  const loadCephieSnapImages = async () => {
    try {
      setLoadingCephieSnap(true);
      const res = await fetch(
        `${API_BASE_URL}/api/uploads/cephie-snap-images`,
        {
          credentials: 'include',
        }
      );
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setCephieSnapImages(data.images ?? []);
    } catch {
      setCephieSnapImages([]);
    } finally {
      setLoadingCephieSnap(false);
    }
  };

  const loadAvailableImages = async () => {
    try {
      setLoadingImages(true);
      const data = await fetchBackgrounds();
      setAvailableImages(data);
    } catch (error) {
      console.error('Error loading available images:', error);
      setError('Failed to load background images');
    } finally {
      setLoadingImages(false);
    }
  };

  const handleSelectImage = (imageUrl: string) => {
    if (!settings) return;

    let selectedValue: string | null = imageUrl;
    if (imageUrl === '') {
      selectedValue = null;
    }

    const isUserUploaded =
      selectedValue && selectedValue.startsWith('https://api.cephie.app/');

    const updatedSettings = {
      ...settings,
      backgroundImage: {
        ...settings.backgroundImage,
        selectedImage: selectedValue,
        useCustomBackground: !!isUserUploaded,
      },
    };
    onChange(updatedSettings);
  };

  const handleToggleFavorite = (filename: string) => {
    if (!settings) return;

    const currentFavorites = settings.backgroundImage?.favorites || [];
    const isFavorite = currentFavorites.includes(filename);

    const newFavorites = isFavorite
      ? currentFavorites.filter((f) => f !== filename)
      : [...currentFavorites, filename];

    const updatedSettings = {
      ...settings,
      backgroundImage: {
        ...settings.backgroundImage,
        favorites: newFavorites,
      },
    };
    onChange(updatedSettings);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    setUploading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/uploads/upload-background`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');

      const uploadResult = await res.json();
      const newImageUrl = uploadResult.url;

      if (settings && newImageUrl) {
        const updatedSettings = {
          ...settings,
          backgroundImage: {
            ...settings.backgroundImage,
            selectedImage: newImageUrl,
            useCustomBackground: true,
          },
        };
        onChange(updatedSettings);
      }

      await loadAvailableImages();
      await loadCephieSnapImages();
    } catch {
      setError('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (uploading) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = '';
    if (file) {
      handleFile(file);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/uploads/delete-background`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');

      if (settings) {
        const updatedSettings = {
          ...settings,
          backgroundImage: {
            ...settings.backgroundImage,
            selectedImage: null,
            useCustomBackground: false,
          },
        };
        onChange(updatedSettings);
      }

      await loadAvailableImages();
    } catch {
      setError('Failed to delete image');
    } finally {
      setDeleting(false);
    }
  };

  const handleImageLoad = (imagePath: string) => {
    setLoadedImages((prev) => ({
      ...prev,
      [imagePath]: true,
    }));
  };

  const getPhotoCredit = (filename: string): string | null => {
    if (!filename) return null;
    if (filename.match(/^[A-Z]{4}\.(png|jpg|jpeg)$/i)) {
      return null;
    }
    const match = filename.match(/^(.+?)__\d{3}\.(png|jpg|jpeg)$/i);
    if (match) {
      return match[1];
    }
    return null;
  };

  const getImageUrl = (filename: string | null): string | null => {
    if (!filename || filename === 'random' || filename === 'favorites') {
      return filename;
    }
    if (filename.startsWith('https://api.cephie.app/')) {
      return filename;
    }
    return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
  };

  const favorites = settings?.backgroundImage?.favorites || [];
  const favoriteCount = favorites.length;
  const selectedImage = settings?.backgroundImage?.selectedImage ?? null;
  const useCustomBackground = !!settings?.backgroundImage?.useCustomBackground;

  const savedMode: BackgroundMode =
    selectedImage === null || selectedImage === ''
      ? 'none'
      : selectedImage === 'random'
        ? 'random'
        : selectedImage === 'favorites'
          ? 'favorites'
          : 'image';
  const mode: BackgroundMode =
    savedMode !== 'image' &&
    pendingImageFrom !== undefined &&
    pendingImageFrom === selectedImage
      ? 'image'
      : savedMode;

  const handleModeChange = (value: string) => {
    if (!value || value === mode) return;
    if (value === 'image') {
      setPendingImageFrom(selectedImage);
      return;
    }
    setPendingImageFrom(undefined);
    if (value === 'none') handleSelectImage('');
    else if (value === 'random') handleSelectImage('random');
    else if (value === 'favorites' && favoriteCount > 0)
      handleSelectImage('favorites');
  };

  const modeDescription: Record<BackgroundMode, string> = {
    none: 'Uses the default background.',
    image:
      savedMode === 'image'
        ? 'Uses the image selected below.'
        : 'Pick an image below.',
    random: 'Shows a different image each session.',
    favorites: `Picks from your ${favoriteCount} starred ${
      favoriteCount === 1 ? 'image' : 'images'
    } each session.`,
  };

  const showCurrent =
    savedMode === 'image' &&
    !!selectedImage &&
    (!!getPhotoCredit(selectedImage) || useCustomBackground);
  const currentCredit = selectedImage ? getPhotoCredit(selectedImage) : null;

  return (
    <TooltipProvider>
      <SettingsSection title="Background image" icon={ImageIcon}>
        {error ? (
          <div
            role="alert"
            className="flex items-center gap-2 px-1 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss error"
              onClick={() => setError('')}
            >
              <X />
            </Button>
          </div>
        ) : null}

        <SettingsGroup>
          <SettingsRow label="Mode" description={modeDescription[mode]}>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={handleModeChange}
              aria-label="Background mode"
              className="w-full sm:w-auto"
            >
              <ToggleGroupItem value="none">None</ToggleGroupItem>
              <ToggleGroupItem value="image">Image</ToggleGroupItem>
              <ToggleGroupItem value="random">Random</ToggleGroupItem>
              <ToggleGroupItem
                value="favorites"
                disabled={favoriteCount === 0 && mode !== 'favorites'}
              >
                Favorites
              </ToggleGroupItem>
            </ToggleGroup>
          </SettingsRow>

          {showCurrent ? (
            <SettingsRow
              label="Current background"
              description={
                currentCredit ? `Photo by @${currentCredit}` : undefined
              }
              stacked
            >
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
                <img
                  src={getImageUrl(selectedImage) ?? undefined}
                  alt="Current background"
                  className="aspect-video w-full rounded-xl border bg-muted object-cover sm:max-w-sm"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="self-start sm:self-end"
                >
                  {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </SettingsRow>
          ) : null}

          {!useCustomBackground ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'transition-colors',
                dragActive && !uploading && 'bg-accent'
              )}
            >
              <SettingsRow
                label="Custom image"
                description={
                  uploading
                    ? 'Uploading image…'
                    : dragActive
                      ? 'Drop the image to upload it.'
                      : 'Click Upload or drop an image here. Uploads are public.'
                }
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  disabled={uploading}
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Upload />
                  )}
                  {uploading ? 'Uploading…' : 'Upload'}
                </Button>
              </SettingsRow>
            </div>
          ) : null}
        </SettingsGroup>

        <SettingsGroup title="Cephie Snap pictures">
          <div className="flex flex-col gap-3 px-5 py-4">
            <p className="text-sm text-muted-foreground">
              Images you uploaded at{' '}
              <a
                href="https://cephie.app/media"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:underline"
              >
                cephie.app/media
                <ExternalLink className="size-3" />
              </a>
              .
            </p>
            {loadingCephieSnap ? (
              <StatusLine>
                <Loader2 className="size-4 animate-spin" />
                Loading your Snap pictures…
              </StatusLine>
            ) : cephieSnapImages.length === 0 ? (
              <StatusLine>No Cephie Snap pictures yet.</StatusLine>
            ) : (
              <div className="-m-1 max-h-80 overflow-y-auto p-1">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {cephieSnapImages.map((img) => {
                    const isSelected = selectedImage === img.url;
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => handleSelectImage(img.url)}
                        aria-pressed={isSelected}
                        aria-label="Cephie Snap picture"
                        className={cn(
                          TILE_CLASS,
                          isSelected && SELECTED_TILE_CLASS
                        )}
                      >
                        <img
                          src={img.url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SettingsGroup>

        <SettingsGroup title="Backgrounds">
          <div className="px-5 py-4">
            {loadingImages ? (
              <StatusLine>
                <Loader2 className="size-4 animate-spin" />
                Loading backgrounds…
              </StatusLine>
            ) : availableImages.length === 0 ? (
              <StatusLine>No background images available yet.</StatusLine>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {availableImages.map((image, index) => (
                  <BackgroundImageItem
                    key={image.filename}
                    image={image}
                    index={index}
                    isSelected={selectedImage === image.filename}
                    isFavorite={favorites.includes(image.filename)}
                    isImageLoaded={!!loadedImages[image.path]}
                    photoCredit={getPhotoCredit(image.filename)}
                    onSelectImage={handleSelectImage}
                    onToggleFavorite={handleToggleFavorite}
                    onImageLoad={handleImageLoad}
                  />
                ))}
              </div>
            )}
          </div>
        </SettingsGroup>
      </SettingsSection>
    </TooltipProvider>
  );
}
