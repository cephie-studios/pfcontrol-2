import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminRefreshButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  iconOnly?: boolean;
  className?: string;
};

export default function AdminRefreshButton({
  onClick,
  disabled,
  loading = false,
  label = 'Refresh',
  iconOnly = false,
  className,
}: AdminRefreshButtonProps) {
  return (
    <Button
      variant="outline"
      size={iconOnly ? 'icon' : 'default'}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
      aria-label={iconOnly ? label : undefined}
    >
      <RefreshCw className={cn(loading && 'animate-spin')} />
      {iconOnly ? null : label}
    </Button>
  );
}
