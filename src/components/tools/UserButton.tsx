import { useState, useRef, useEffect } from 'react';
import {
  User,
  LogOut,
  Settings,
  List,
  LayoutDashboard,
  ChevronDown,
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
      ? 'w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-xl'
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
      <div className={`w-full ${className}`}>
        <div className="flex items-center space-x-3 px-3.5 py-3">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-9 h-9 rounded-full"
            />
          ) : (
            <div className="w-9 h-9 bg-zinc-800 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-zinc-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-zinc-50 font-semibold text-sm truncate">{user.username}</p>
            {user.isAdmin && (
              <p className="text-xs text-zinc-500 mt-0.5">Administrator</p>
            )}
          </div>
        </div>

        <div className="p-1.5 border-t border-zinc-800/80">
          <button
            onClick={() => handleAction(() => (window.location.href = '/user/' + user.username))}
            className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-2xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-150 text-sm font-medium"
          >
            <User className="w-4 h-4 shrink-0" />
            <span>Profile</span>
          </button>

          <button
            onClick={() => handleAction(() => (window.location.href = '/sessions'))}
            className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-2xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-150 text-sm font-medium"
          >
            <List className="w-4 h-4 shrink-0" />
            <span>My Sessions</span>
          </button>

          <button
            onClick={() => handleAction(() => (window.location.href = '/settings'))}
            className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-2xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-150 text-sm font-medium"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Settings</span>
          </button>

          {(user.isAdmin ||
            (user.rolePermissions && user.rolePermissions.admin)) && (
            <ProtectedRoute requirePermission="admin" requireTester={false}>
              <button
                onClick={() => handleAction(() => (window.location.href = '/admin'))}
                className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-2xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-150 text-sm font-medium"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </button>
            </ProtectedRoute>
          )}
        </div>

        <div className="p-1.5 border-t border-zinc-800/80">
          <button
            onClick={() => handleAction(logout)}
            className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-2xl text-zinc-500 hover:bg-zinc-800 hover:text-red-400 transition-colors duration-150 text-sm font-medium"
          >
            <LogOut className="w-4 h-4 shrink-0" />
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
        className="flex items-center space-x-2.5 text-white px-1.5 py-1.5 rounded-full transition-colors duration-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.username}
            className="w-7 h-7 rounded-full"
          />
        ) : (
          <div className="w-7 h-7 bg-zinc-800 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-zinc-400" />
          </div>
        )}
        <span className="hidden md:block text-md font-medium text-zinc-200">
          {user.username}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-blue-300 transition-transform duration-200 -ml-1 ${isDropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-60 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in slide-in-from-top-1 duration-150">
          <div className="px-3.5 py-3 border-b border-zinc-800/80">
            <div className="flex items-center space-x-2.5">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-zinc-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-zinc-50 font-semibold text-sm truncate">
                  {user.username}
                </p>
                {user.isAdmin && (
                  <p className="text-xs text-zinc-500 mt-0.5">Administrator</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-1.5">
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                window.location.href = '/user/' + user.username;
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-150 text-sm"
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="font-medium">Profile</span>
            </button>

            <button
              onClick={() => {
                setIsDropdownOpen(false);
                window.location.href = '/sessions';
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-150 text-sm"
            >
              <List className="w-4 h-4 shrink-0" />
              <span className="font-medium">My Sessions</span>
            </button>

            <button
              onClick={() => {
                setIsDropdownOpen(false);
                window.location.href = '/settings';
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition-colors duration-150 text-sm"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="font-medium">Settings</span>
            </button>
          </div>

          {(user.isAdmin ||
            (user.rolePermissions &&
              (user.rolePermissions.admin ||
                user.rolePermissions.support ||
                user.rolePermissions.moderation))) && (
            <ProtectedRoute requirePermission="admin" requireTester={false}>
              <div className="border-t border-zinc-800/80 p-1.5">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    window.location.href = '/admin';
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-blue-400 hover:bg-blue-800/20 transition-colors duration-150 text-sm"
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span className="font-medium">Dashboard</span>
                </button>
              </div>
            </ProtectedRoute>
          )}

          <div className="border-t border-zinc-800/80 p-1.5">
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                logout();
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-red-500 hover:bg-red-800/20 hover:text-red-400 transition-colors duration-150 text-sm"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
