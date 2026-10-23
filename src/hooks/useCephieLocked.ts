import { useAuth } from './auth/useAuth';

export function useCephieLocked() {
  const { user, isLoading } = useAuth();
  return !isLoading && (!user?.plan || user.plan === 'free');
}
