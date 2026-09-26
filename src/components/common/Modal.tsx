import { useRef } from 'react';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

interface ModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'success';
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  variant = 'primary',
  icon,
  footer,
  dismissible = true,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const borderColor =
    variant === 'danger'
      ? 'border-red-600'
      : variant === 'success'
        ? 'border-green-600'
        : 'border-blue-800';
  const iconBg =
    variant === 'danger'
      ? 'bg-red-900/30'
      : variant === 'success'
        ? 'bg-green-900/30'
        : 'bg-blue-900/30';
  const iconColor =
    variant === 'danger'
      ? 'text-red-500'
      : variant === 'success'
        ? 'text-green-500'
        : 'text-blue-400';

  return (
    <DialogPrimitive.Root
      open={!!isOpen}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/65 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <DialogPrimitive.Content
            ref={contentRef}
            aria-describedby={undefined}
            onEscapeKeyDown={(e) => {
              if (!dismissible) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (!dismissible) e.preventDefault();
            }}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              const active = document.activeElement;
              returnFocusRef.current =
                active instanceof HTMLElement && active !== document.body
                  ? active
                  : null;
              contentRef.current?.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              const el = returnFocusRef.current;
              returnFocusRef.current = null;
              if (el?.isConnected) el.focus({ preventScroll: true });
            }}
            className={`bg-zinc-900 border-2 ${borderColor} rounded-2xl max-w-md w-full p-6 animate-fade-in focus:outline-none`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                {icon && (
                  <div
                    className={`p-2 ${iconBg} ${iconColor} rounded-full mr-3`}
                  >
                    {icon}
                  </div>
                )}
                <DialogPrimitive.Title asChild>
                  <h3 className="text-xl font-semibold">{title}</h3>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="p-1 rounded-full hover:bg-gray-700"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </DialogPrimitive.Close>
            </div>
            <div className="mb-6">{children}</div>
            {footer && (
              <div className="flex justify-start space-x-3">{footer}</div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
