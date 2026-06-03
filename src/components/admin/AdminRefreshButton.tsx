import { MdRefresh } from 'react-icons/md';
import Button from '../common/Button';
import { ADMIN_TOOLBAR_HEIGHT } from './adminConstants';

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
  className = '',
}: AdminRefreshButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || loading}
      className={
        iconOnly
          ? `${ADMIN_TOOLBAR_HEIGHT} w-10 shrink-0 px-0 ${className}`.trim()
          : className
      }
      aria-label={iconOnly ? label : undefined}
    >
      <MdRefresh
        size={16}
        className={`shrink-0 ${iconOnly ? '' : 'inline mr-1'} ${loading ? 'animate-spin' : ''}`}
      />
      {!iconOnly ? label : null}
    </Button>
  );
}
