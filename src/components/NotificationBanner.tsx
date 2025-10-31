import {
  Info,
  AlertTriangle,
  CheckCircle,
  ShieldX,
  X,
} from 'lucide-react';
import { useSettings } from '../hooks/settings/useSettings';
import { useNotifications } from '../hooks/useNotifications';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { linkify } from '../utils/linkify';

export default function NotificationBanner() {
  const { settings } = useSettings();
  const { currentNotification, hideNotification } = useNotifications();

  const isMobile = useMediaQuery('(max-width: 767px)');
  const notificationMode = isMobile ? 'list' : (settings?.notificationViewMode || 'list');

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'success':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <ShieldX className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getLegacyNotificationClass = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-900/30 border-blue-800/50 text-blue-300';
      case 'warning':
        return 'bg-yellow-900/30 border-yellow-800/50 text-yellow-300';
      case 'error':
        return 'bg-red-900/30 border-red-800/50 text-red-300';
      case 'success':
        return 'bg-green-900/30 border-green-800/50 text-green-300';
      default:
        return 'bg-gray-900/30 border-gray-800/50 text-gray-300';
    }
  };

  const getLegacyCustomStyle = (customColor?: string) => {
    if (!customColor) return {};
    return {
      backgroundColor: `${customColor}4D`,
      borderColor: `${customColor}80`,
      color: customColor,
    };
  };

  if (notificationMode !== 'legacy' || !currentNotification) {
    return null;
  }

  return (
    <div
      className={`border-b px-4 py-2 ${!currentNotification.custom_color ? getLegacyNotificationClass(currentNotification.type) : ''}`}
      style={currentNotification.custom_color ? getLegacyCustomStyle(currentNotification.custom_color) : {}}
    >
      <div className="container mx-auto max-w-7xl flex justify-between items-center">
        <div className="flex items-center space-x-2 flex-1 justify-center">
          <div className="flex items-center space-x-2 flex-shrink-0">
            {currentNotification.custom_icon || getNotificationIcon(currentNotification.type)}
            <span className="text-sm font-medium">System Notice:</span>
          </div>
          <span className="text-sm">{linkify(currentNotification.text)}</span>
        </div>
        <button
          onClick={() => hideNotification(currentNotification.id)}
          className="flex-shrink-0 ml-4 hover:opacity-70 transition-opacity"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
