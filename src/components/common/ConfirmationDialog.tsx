import React, { useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'success';
  icon?: React.ReactNode;
}

const variantStyles = {
  primary: {
    border: 'border-blue-600',
    confirmButton:
      'bg-linear-to-b from-blue-500 to-blue-700 hover:bg-linear-to-b hover:from-blue-600 hover:to-blue-800',
    icon: 'text-blue-400',
  },
  danger: {
    border: 'border-red-600',
    confirmButton:
      'bg-linear-to-b from-red-500 to-red-700 hover:bg-linear-to-b hover:from-red-600 hover:to-red-800',
    icon: 'text-red-400',
  },
  success: {
    border: 'border-green-600',
    confirmButton:
      'bg-linear-to-b from-green-500 to-green-700 hover:bg-linear-to-b hover:from-green-600 hover:to-green-800',
    icon: 'text-green-400',
  },
};

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  icon,
}) => {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const currentVariant = variantStyles[variant];

  return (
    <AlertDialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 px-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCancel();
          }}
        >
          <AlertDialogPrimitive.Content
            onClick={(e) => e.stopPropagation()}
            onOpenAutoFocus={() => {
              const active = document.activeElement;
              returnFocusRef.current =
                active instanceof HTMLElement && active !== document.body
                  ? active
                  : null;
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              const el = returnFocusRef.current;
              returnFocusRef.current = null;
              if (el?.isConnected) el.focus({ preventScroll: true });
            }}
            className={`bg-zinc-900 border-2 ${currentVariant.border} rounded-4xl shadow-lg max-w-md w-full focus:outline-none`}
          >
            <div className="p-6 pb-4">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 ${currentVariant.icon}`}>
                  {icon || <AlertCircle size={24} />}
                </div>

                <div className="flex-1">
                  <AlertDialogPrimitive.Title asChild>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {title}
                    </h3>
                  </AlertDialogPrimitive.Title>
                  <AlertDialogPrimitive.Description asChild>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {description}
                    </p>
                  </AlertDialogPrimitive.Description>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-800 flex gap-3 justify-end">
              <AlertDialogPrimitive.Cancel asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition-colors font-medium"
                >
                  {cancelText}
                </button>
              </AlertDialogPrimitive.Cancel>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 rounded-full text-white transition-colors font-medium ${currentVariant.confirmButton}`}
              >
                {confirmText}
              </button>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Overlay>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
};

export default ConfirmationDialog;
