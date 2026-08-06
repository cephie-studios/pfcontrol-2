import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Toast from './Toast';
import { ToastContext } from '../../hooks/useToast';
import type { ToastItem } from '../../hooks/useToast';

const MAX_VISIBLE_TOASTS = 5;
const ERROR_DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastItem['type'] = 'info', duration?: number) => {
      const id = ++nextId.current;
      setToasts((prev) => {
        const next = [...prev, { id, message, type, duration }];
        // Keep the stack bounded — drop the oldest if it overflows.
        return next.length > MAX_VISIBLE_TOASTS
          ? next.slice(next.length - MAX_VISIBLE_TOASTS)
          : next;
      });
    },
    []
  );

  const showError = useCallback(
    (message: string) => showToast(message, 'error', ERROR_DURATION),
    [showToast]
  );

  const value = useMemo(
    () => ({ showToast, showError }),
    [showToast, showError]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-6 right-6 z-[10000] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
              className="relative"
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
