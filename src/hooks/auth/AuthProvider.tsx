import React, { useState, useEffect, useRef } from 'react';
import { getCurrentUser, logout as apiLogout } from '../../utils/fetch/auth';
import { AuthContext } from './useAuth';
import { useFingerprint } from './useFingerprint';
import type { User } from '../../types/user';
import { usePostHog } from '@posthog/react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const posthog = usePostHog();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRefreshing = useRef(false);
  const prevUserRef = useRef<User | null>(null);

  useFingerprint(user?.userId);

  useEffect(() => {
    if (user) {
      posthog?.identify(user.userId, {
        username: user.username,
        discord_id: user.userId,
        is_admin: user.isAdmin,
        is_tester: user.isTester,
        has_roblox: !!user.robloxUserId,
        roblox_username: user.robloxUsername ?? null,
        has_vatsim: !!user.vatsimCid,
        vatsim_cid: user.vatsimCid ?? null,
        vatsim_rating: user.vatsimRatingShort ?? null,
        role: user.roleName ?? null,
        tutorial_completed: user.tutorialCompleted,
      });
      prevUserRef.current = user;
    } else if (prevUserRef.current) {
      posthog?.reset();
      prevUserRef.current = null;
    }
  }, [user, posthog]);

  const refreshUser = async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;
    setIsLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser({
        ...currentUser,
        rolePermissions: currentUser.rolePermissions || {},
      });
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
      isRefreshing.current = false;
    }
  };

  const login = () => {
    window.location.href = `${
      import.meta.env.VITE_SERVER_URL
    }/api/auth/discord`;
  };

  const logout = async () => {
    try {
      await apiLogout();
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    const handler = () => refreshUser();
    window.addEventListener('auth:forbidden', handler);
    return () => window.removeEventListener('auth:forbidden', handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
