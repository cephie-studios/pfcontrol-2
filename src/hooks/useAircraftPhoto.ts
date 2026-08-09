import { useEffect, useState } from 'react';
import type { Flight } from '../types/flight';
import type { Airline } from '../types/airlines';
import {
  resolveAircraftFolder,
  extractAirlineIcaoPrefix,
  parseAuthorFromFilename,
  pickLiveryAndFile,
  buildManifestUrl,
  buildAircraftPhotoUrl,
  type AircraftPhotoTier,
} from '../utils/aircraftPhoto';

export interface AircraftPhoto {
  tier: AircraftPhotoTier;
  imageUrl: string | null;
  livery: string | null;
  author: string | null;
  loading: boolean;
}

const NO_PHOTO: AircraftPhoto = {
  tier: 'none',
  imageUrl: null,
  livery: null,
  author: null,
  loading: false,
};

const manifestCache = new Map<string, Promise<Record<string, string[]>>>();

function fetchManifest(
  apiBase: string,
  folder: string
): Promise<Record<string, string[]>> {
  const cached = manifestCache.get(folder);
  if (cached) return cached;

  const promise = fetch(buildManifestUrl(apiBase, folder))
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}));
  manifestCache.set(folder, promise);
  return promise;
}

export function useAircraftPhoto(
  flight: Flight | null | undefined,
  airlines: Airline[]
): AircraftPhoto {
  const [photo, setPhoto] = useState<AircraftPhoto>(NO_PHOTO);
  const apiBase = import.meta.env.VITE_SERVER_URL || '';

  const folder = resolveAircraftFolder(flight?.aircraft);
  const flightId = flight?.id;

  useEffect(() => {
    if (!folder || flightId === undefined) {
      setPhoto(NO_PHOTO);
      return;
    }

    let cancelled = false;
    setPhoto((prev) => ({ ...prev, loading: true }));

    const icaoPrefix = extractAirlineIcaoPrefix(flight?.callsign);
    const airline = icaoPrefix
      ? (airlines.find((a) => a.icao === icaoPrefix) ?? null)
      : null;

    fetchManifest(apiBase, folder).then((manifest) => {
      if (cancelled) return;
      const pick = pickLiveryAndFile(
        manifest,
        airline?.callsign ?? null,
        String(flightId)
      );
      if (!pick) {
        setPhoto(NO_PHOTO);
        return;
      }
      setPhoto({
        tier: pick.tier,
        imageUrl: buildAircraftPhotoUrl(
          apiBase,
          folder,
          pick.livery,
          pick.filename
        ),
        livery: pick.livery,
        author: parseAuthorFromFilename(pick.filename),
        loading: false,
      });
    });

    return () => {
      cancelled = true;
    };
    // airlines is a stable array from context once loaded; re-running per
    // element identity change would refetch unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, folder, flightId, flight?.callsign, airlines.length]);

  return photo;
}
