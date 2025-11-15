import { X } from 'lucide-react';

interface ModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'success';
  icon?: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  variant = 'primary',
  icon,
  footer,
}: ModalProps) {
  if (!isOpen) return null;

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
    // Z-Index: 50000 (z-50) - Top layer for critical system modals (see Z_INDEX_GUIDE.md)
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`bg-zinc-900 border-2 ${borderColor} rounded-lg max-w-md w-full p-6 animate-fade-in`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            {icon && (
              <div className={`p-2 ${iconBg} ${iconColor} rounded-full mr-3`}>
                {icon}
              </div>
            )}
            <h3 className="text-xl font-semibold">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-700"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <div className="mb-6">{children}</div>
        {footer && <div className="flex justify-start space-x-3">{footer}</div>}
      </div>
    </div>
  );
}
