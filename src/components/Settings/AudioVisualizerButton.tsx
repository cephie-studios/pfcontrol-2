import { useEffect, useState, type MouseEvent } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const BAR_COUNT = 4;
const IDLE_LEVELS = Array.from({ length: BAR_COUNT }, () => 0.4);

type AudioVisualizerButtonProps = {
  isPlaying: boolean;
  onClick: (e: MouseEvent) => void;
  /** Used for the tooltip and the accessible name. */
  label?: string;
  disabled?: boolean;
};

export default function AudioVisualizerButton({
  isPlaying,
  onClick,
  label = 'Preview',
  disabled = false,
}: AudioVisualizerButtonProps) {
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setLevels(
        Array.from({ length: BAR_COUNT }, () => Math.random() * 0.75 + 0.25)
      );
    }, 150);

    return () => {
      clearInterval(interval);
      setLevels(IDLE_LEVELS);
    };
  }, [isPlaying]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <span
                aria-hidden="true"
                className="flex h-4 items-end justify-center gap-0.5"
              >
                {levels.map((level, index) => (
                  <span
                    key={index}
                    className="w-0.5 rounded-full bg-blue-400 transition-[height] duration-150 ease-out"
                    style={{ height: `${level * 100}%` }}
                  />
                ))}
              </span>
            ) : (
              <Play />
            )}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{isPlaying ? 'Playing' : label}</TooltipContent>
    </Tooltip>
  );
}
