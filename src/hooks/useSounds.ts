import { useAuth } from './auth/useAuth';
import { playSoundWithSettings } from '../utils/playSound';

export function useSounds() {
  const { user } = useAuth();

  const playStartupSound = () => {
    if (!user) return Promise.resolve();
    return playSoundWithSettings('startupSound', user.settings, 0.7);
  };

  const playChatNotificationSound = () => {
    if (!user) return Promise.resolve();
    return playSoundWithSettings('chatNotificationSound', user.settings, 0.7);
  };

  const playNewStripSound = () => {
    if (!user) return Promise.resolve();
    return playSoundWithSettings('newStripSound', user.settings, 0.7);
  };

  return {
    playStartupSound,
    playChatNotificationSound,
    playNewStripSound,
  };
}
