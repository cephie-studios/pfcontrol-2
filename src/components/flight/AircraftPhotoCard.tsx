import { Plane } from 'lucide-react';
import { useAircraftPhoto } from '../../hooks/useAircraftPhoto';
import { useData } from '../../hooks/data/useData';
import type { Flight } from '../../types/flight';

interface AircraftPhotoCardProps {
  flight: Flight;
}

export default function AircraftPhotoCard({ flight }: AircraftPhotoCardProps) {
  const { airlines } = useData();
  const photo = useAircraftPhoto(flight, airlines);

  const aircraftLine = [
    flight.flight_type || 'N/A',
    flight.wtc ? `/${flight.wtc}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (photo.loading) {
    return (
      <div className="h-44 rounded-2xl bg-zinc-800/60 animate-pulse mb-4" />
    );
  }

  if (photo.tier === 'none' || !photo.imageUrl) {
    return (
      <div className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-4 py-3 mb-4">
        <Plane className="h-5 w-5 text-zinc-400 shrink-0" />
        <div>
          <div className="text-sm font-bold text-zinc-100 font-mono">
            {flight.aircraft || 'N/A'}
          </div>
          <div className="text-xs text-zinc-400">{aircraftLine}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-44 rounded-2xl overflow-hidden mb-4 bg-zinc-800">
      <img
        src={photo.imageUrl}
        alt={`${flight.aircraft ?? 'Aircraft'}${photo.livery ? `, ${photo.livery} livery` : ''}`}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/35" />
      <div className="absolute left-4 bottom-3.5">
        <div className="text-lg font-extrabold font-mono text-white">
          {flight.aircraft || 'N/A'}
        </div>
        <div className="text-xs text-zinc-400 mt-0.5">{aircraftLine}</div>
      </div>
      <div className="absolute right-3 bottom-2.5 text-right text-[9px] leading-relaxed text-zinc-300/70">
        Image by @{photo.author}
        <br />© 2024 PFPhotos. All Rights Reserved.
      </div>
    </div>
  );
}
