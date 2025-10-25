import { useState, useRef, useEffect } from 'react';
import {
  User,
  LogOut,
  Settings,
  ChevronDown,
  List,
  LayoutDashboard,
  Notebook,
} from 'lucide-react';
import { useAuth } from '../../hooks/auth/useAuth';
import ProtectedRoute from '../ProtectedRoute';

interface CustomUserButtonProps {
  className?: string;
  isMobile?: boolean;
  onAction?: () => void;
}

export default function CustomUserButton({
  className = '',
  isMobile = false,
  onAction,
}: CustomUserButtonProps) {
  const { user, isLoading, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleAction = (callback?: () => void) => {
    if (onAction) onAction();
    if (callback) callback();
    setIsDropdownOpen(false);
  };

  if (isLoading) {
    return (
      <div className={`${isMobile ? 'w-full' : ''} ${className}`}>
        <div className="bg-zinc-700 animate-pulse rounded-full px-4 py-2 h-10"></div>
      </div>
    );
  }

  if (!user) {
    const baseClasses = isMobile
      ? 'w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl'
      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-xl';

    return (
      <button
        onClick={() => {
          handleAction();
          window.location.href = '/login';
        }}
        className={`${baseClasses} ${className}`}
      >
        Sign In with Discord
      </button>
    );
  }

  if (isMobile) {
    return (
      <div className={`w-full space-y-3 ${className}`}>
        <div className="flex items-center space-x-3 px-4 py-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50 hover:bg-zinc-700/60 transition-colors">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-10 h-10 rounded-full ring-2 ring-blue-500/30"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">{user.username}</p>
            {user.isAdmin && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 mt-1">
                Admin
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() =>
              handleAction(
                () => (window.location.href = '/user/' + user.username)
              )
            }
            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-all duration-200 font-medium"
          >
            <User className="w-4 h-4" />
            <span>Profile</span>
          </button>

          <button
            onClick={() =>
              handleAction(() => (window.location.href = '/sessions'))
            }
            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-all duration-200 font-medium"
          >
            <List className="w-4 h-4" />
            <span>My Sessions</span>
          </button>

          <button
            onClick={() => {
              window.open('/settings', '_blank', 'noopener,noreferrer');
            }}
            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-all duration-200 font-medium"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>

          {(user.isAdmin ||
            (user.rolePermissions && user.rolePermissions.admin)) && (
            <ProtectedRoute requirePermission="admin" requireTester={false}>
              <button
                onClick={() => {
                  window.location.href = '/admin';
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-blue-400 hover:text-blue-300 hover:bg-blue-600/20 rounded-xl transition-all duration-200 font-medium"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            </ProtectedRoute>
          )}

          <button
            onClick={() => handleAction(logout)}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded-xl transition-all duration-200 font-medium border-t border-zinc-700/50 pt-4 mt-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-3 hover:border-blue-500 text-white px-4 py-2 rounded-full font-medium transition-all duration-300 hover:shadow-xl hover:bg-zinc-900/95"
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.username}
            className="w-8 h-8 rounded-full ring-2 ring-blue-500/30"
          />
        ) : (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        )}
        <span className="hidden md:block font-semibold">{user.username}</span>
        <ChevronDown
          className={`w-4 h-4 text-blue-400 transition-transform duration-200 ${
            isDropdownOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl py-2 z-50 animate-in slide-in-from-top-1 duration-200">
          <div className="px-4 py-3 border-b border-gray-700/50 block cursor-default">
            <div className="flex items-center space-x-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-10 h-10 rounded-full ring-2 ring-blue-500/30"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">
                  {user.username}
                </p>
                {user.isAdmin && (
                  <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 mt-1">
                    Administrator
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                window.location.href = '/user/' + user.username;
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-blue-600/20 hover:text-white transition-all duration-200 group"
            >
              <User className="w-4 h-4" />
              <span className="font-medium">Profile</span>
            </button>

            <button
              onClick={() => {
                setIsDropdownOpen(false);
                window.location.href = '/sessions';
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-blue-600/20 hover:text-white transition-all duration-200 group"
            >
              <List className="w-4 h-4" />
              <span className="font-medium">My Sessions</span>
            </button>

            <button
              onClick={() => {
                window.open('/settings', '_blank', 'noopener,noreferrer');
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-blue-600/20 hover:text-white transition-all duration-200 group"
            >
              <Settings className="w-4 h-4" />
              <span className="font-medium">Settings</span>
            </button>
          </div>
          {(user.isAdmin ||
            (user.rolePermissions &&
              (user.rolePermissions.admin ||
                user.rolePermissions.support ||
                user.rolePermissions.moderation))) && (
            <ProtectedRoute requirePermission="admin" requireTester={false}>
              <div className="border-t border-gray-700/50 py-1">
                <button
                  onClick={() => {
                    window.location.href = '/admin';
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 transition-all duration-200 group"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="font-medium">Dashboard</span>
                </button>
              </div>
            </ProtectedRoute>
          )}
          <div className="border-t border-gray-700/50 pt-1">
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                logout();
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-all duration-200 group"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
