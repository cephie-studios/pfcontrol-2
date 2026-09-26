import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AdminSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  grow?: boolean;
  'aria-label'?: string;
};

export default function AdminSearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  loading = false,
  className,
  grow = true,
  'aria-label': ariaLabel,
}: AdminSearchInputProps) {
  return (
    <div
      className={cn(
        'relative w-full',
        grow ? 'sm:max-w-sm sm:min-w-56 sm:flex-1' : 'sm:w-56',
        className
      )}
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {loading ? (
        <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}
