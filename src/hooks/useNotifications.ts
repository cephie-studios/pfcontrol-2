import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchActiveNotifications } from '../utils/fetch/data';
import type { Notification as AdminNotification } from '../utils/fetch/admin';

type AppNotification = AdminNotification & { custom_icon?: React.ReactNode };

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentNotificationIndex, setCurrentNotificationIndex] = useState(0);
  const [hiddenNotifications, setHiddenNotifications] = useState<string[]>([]);

  useEffect(() => {
    const storedHidden = localStorage.getItem('hiddenNotifications');
    if (storedHidden) {
      try {
        setHiddenNotifications(JSON.parse(storedHidden));
      } catch (error) {
        console.error(
          'Error parsing hidden notifications from localStorage:',
          error
        );
      }
    }

    const storedNotifications = localStorage.getItem('cachedNotifications');
    if (storedNotifications) {
      try {
        setNotifications(JSON.parse(storedNotifications));
      } catch (error) {
        console.error(
          'Error parsing cached notifications from localStorage:',
          error
        );
      }
    }
  }, []);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(
      (n) => !hiddenNotifications.includes(n.id.toString())
    );
  }, [notifications, hiddenNotifications]);

  const fetchNotifications = useCallback(async () => {
    try {
      const activeNotifications = await fetchActiveNotifications();
      const mapped = activeNotifications.map(
        (n) => ({ ...n }) as AppNotification
      );
      setNotifications(mapped);
      localStorage.setItem('cachedNotifications', JSON.stringify(mapped));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Rotate notifications every 10 seconds
  useEffect(() => {
    if (filteredNotifications.length > 1) {
      const interval = setInterval(() => {
        setCurrentNotificationIndex(
          (prev) => (prev + 1) % filteredNotifications.length
        );
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [filteredNotifications]);

  const hideNotification = useCallback((id: number) => {
    const idStr = id.toString();
    setHiddenNotifications((prev) => {
      const updatedHidden = [...prev, idStr];
      localStorage.setItem('hiddenNotifications', JSON.stringify(updatedHidden));
      return updatedHidden;
    });
    setNotifications((prev) => prev.filter((n) => n.id.toString() !== idStr));
  }, []);

  const currentNotification = filteredNotifications[currentNotificationIndex];

  return {
    notifications: filteredNotifications,
    currentNotification,
    currentNotificationIndex,
    hideNotification,
    setCurrentNotificationIndex,
  };
}
