import { useEffect, useMemo, useState } from 'react';
import { useSettings } from './useSettings';
import { fetchBackgrounds } from '../../utils/fetch/data';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

type BackgroundImage = { path: string };

let images: BackgroundImage[] | null = null;
let imagesRequest: Promise<BackgroundImage[]> | null = null;
const picks = new Map<string, string | null>();

function loadImages() {
  imagesRequest ??= fetchBackgrounds()
    .then((data) => (images = data ?? []))
    .catch((error) => {
      imagesRequest = null;
      console.error('Error loading available images:', error);
      return [];
    });
  return imagesRequest;
}

export function getBackgroundImageUrl(filename: string | null | undefined) {
  if (!filename || filename === 'random' || filename === 'favorites') {
    return null;
  }
  if (filename.startsWith('https://api.cephie.app/')) return filename;
  return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
}

function pickOnce(key: string, pick: () => string | null) {
  if (!picks.has(key)) picks.set(key, pick());
  return picks.get(key) ?? null;
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

type BackgroundSetting = {
  selectedImage?: string | null;
  favorites?: string[];
};

export function useBackgroundImage(
  source?: BackgroundSetting | null
): string | null {
  const { settings } = useSettings();
  const background = source === undefined ? settings?.backgroundImage : source;
  const selected = background?.selectedImage;
  const favorites = background?.favorites;
  const [available, setAvailable] = useState(images);

  useEffect(() => {
    if (selected !== 'random' || available) return;
    let active = true;
    loadImages().then((data) => {
      if (active) setAvailable(data);
    });
    return () => {
      active = false;
    };
  }, [selected, available]);

  return useMemo(() => {
    if (selected === 'random') {
      if (!available?.length) return null;
      return pickOnce(
        'random',
        () => `${API_BASE_URL}${randomItem(available).path}`
      );
    }
    if (selected === 'favorites') {
      if (!favorites?.length) return null;
      return pickOnce(`favorites:${favorites.join('|')}`, () =>
        getBackgroundImageUrl(randomItem(favorites))
      );
    }
    return getBackgroundImageUrl(selected);
  }, [selected, favorites, available]);
}
