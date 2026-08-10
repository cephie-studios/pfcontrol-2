import { useEffect } from 'react';
import { X, Bell } from 'lucide-react';
import Button from '../common/Button';
import type { UserNotification } from '../../utils/fetch/userNotifications';

interface Props {
  alerts: UserNotification[];
  onDismiss: (id: number) => void;
}

export default function UserAlertsModal({ alerts, onDismiss }: Props) {
  const isOpen = alerts.length > 0;

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-linear-to-b from-zinc-900 to-zinc-950 border-2 border-zinc-700 rounded-4xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-2 px-5 py-4">
          <Bell className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">
            {alerts.length === 1
              ? 'You have an alert'
              : `You have ${alerts.length} alerts`}
          </h2>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-zinc-800/80">
          {alerts.map((a) => (
            <div key={a.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100">{a.title}</p>
                  <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                    {a.message}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-2">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(a.id)}
                  aria-label="Dismiss"
                  className="shrink-0 rounded-full p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4">
          <Button
            onClick={() => alerts.forEach((a) => onDismiss(a.id))}
            variant="primary"
            className="w-full"
          >
            Dismiss all
          </Button>
        </div>
      </div>
    </div>
  );
}
