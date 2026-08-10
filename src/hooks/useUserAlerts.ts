import { useCallback, useEffect, useState } from 'react';
import {
  fetchUnreadUserNotifications,
  markUserNotificationRead,
  type UserNotification,
} from '../utils/fetch/userNotifications';

export function useUserAlerts(user: { userId?: string } | null) {
  const [alerts, setAlerts] = useState<UserNotification[]>([]);

  useEffect(() => {
    if (!user) {
      setAlerts([]);
      return;
    }
    fetchUnreadUserNotifications()
      .then(({ notifications }) => setAlerts(notifications))
      .catch((error) => {
        console.error('Error fetching user alerts:', error);
      });
  }, [user]);

  const dismiss = useCallback(async (id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await markUserNotificationRead(id);
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  }, []);

  return { alerts, dismiss };
}
