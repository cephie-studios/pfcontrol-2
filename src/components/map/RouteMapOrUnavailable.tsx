import RouteMap from './RouteMap';
import { isPastCutover } from '../../utils/cutover';

interface RouteMapOrUnavailableProps {
  createdAt?: string | Date | null;
  route?: string;
  departure?: string;
  arrival?: string;
  sid?: string;
  star?: string;
  className?: string;
}

export default function RouteMapOrUnavailable({
  createdAt,
  ...routeMapProps
}: RouteMapOrUnavailableProps) {
  if (createdAt && isPastCutover(createdAt)) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-zinc-400 bg-zinc-800/50">
        Route map temporarily unavailable
      </div>
    );
  }
  return <RouteMap {...routeMapProps} />;
}
