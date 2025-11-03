import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';

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
  if (!isOpen) return null;

  const variantStyles = {
    primary: {
      border: 'border-blue-600',
      confirmButton: 'bg-blue-600 hover:bg-blue-700',
      icon: 'text-blue-400',
    },
    danger: {
      border: 'border-red-600',
      confirmButton: 'bg-red-600 hover:bg-red-700',
      icon: 'text-red-400',
    },
    success: {
      border: 'border-green-600',
      confirmButton: 'bg-green-600 hover:bg-green-700',
      icon: 'text-green-400',
    },
  };

  const currentVariant = variantStyles[variant];

  const dialogContent = (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className={`bg-zinc-900 border-2 ${currentVariant.border} rounded-lg shadow-lg max-w-md w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={`flex-shrink-0 ${currentVariant.icon}`}>
              {icon || <AlertCircle size={24} />}
            </div>

            {/* Title and Description */}
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-2">
                {title}
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-full text-white transition-colors font-medium ${currentVariant.confirmButton}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
};

export default ConfirmationDialog;
