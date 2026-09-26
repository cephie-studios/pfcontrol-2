import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type AdminModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: ReactNode;
  className?: string;
  variant?: 'primary' | 'danger' | 'success';
};

const SIZE_CLASS = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
};

export default function AdminModal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'lg',
  footer,
  className,
  variant = 'primary',
}: AdminModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        variant={variant}
        className={cn(
          'flex max-h-[80vh] flex-col gap-0 p-0 [&>[data-slot=dialog-close]]:top-5 [&>[data-slot=dialog-close]]:right-5',
          SIZE_CLASS[size],
          className
        )}
        {...(description ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const content = e.currentTarget as HTMLElement | null;
          if (content && !content.contains(document.activeElement)) {
            content.focus({ preventScroll: true });
          }
        }}
      >
        <DialogHeader className="shrink-0 gap-1 px-5 pt-5 pb-3 pr-12">
          <DialogTitle className="truncate text-lg">{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-1 pb-5">
          {children}
        </div>
        {footer ? (
          <DialogFooter className="shrink-0 border-t px-5 py-3 sm:gap-2">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
