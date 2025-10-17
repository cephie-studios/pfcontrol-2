import {
  TowerControl,
  Menu,
  X,
  Copy,
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  ShieldX,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchActiveNotifications } from '../utils/fetch/data';
import type { Notification as AdminNotification } from '../utils/fetch/admin';
import CustomUserButton from './buttons/UserButton';
import Button from './common/Button';

type NavbarProps = {
  sessionId?: string;
  accessId?: string;
};

type NotificationType = 'info' | 'warning' | 'success' | 'error';

type AppNotification = AdminNotification & { custom_icon?: React.ReactNode };

export default function Navbar({ sessionId, accessId }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [utcTime, setUtcTime] = useState<string>(
    new Date().toISOString().slice(11, 19)
  );
  const [isCompact, setIsCompact] = useState<boolean>(window.innerWidth < 950);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentNotificationIndex, setCurrentNotificationIndex] = useState(0);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [hiddenNotifications, setHiddenNotifications] = useState<string[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      setAtTop(window.scrollY === 0);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth < 950);
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        isMenuOpen &&
        !(event.target as HTMLElement).closest('.mobile-menu-container')
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (sessionId && accessId) {
      const interval = setInterval(() => {
        setUtcTime(new Date().toISOString().slice(11, 19));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [sessionId, accessId]);

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

  useEffect(() => {
    if (filteredNotifications.length > 1 && !showAllNotifications) {
      const interval = setInterval(() => {
        setCurrentNotificationIndex(
          (prev) => (prev + 1) % filteredNotifications.length
        );
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [filteredNotifications, showAllNotifications]);

  const hideNotification = (id: number) => {
    const idStr = id.toString();
    const updatedHidden = [...hiddenNotifications, idStr];
    setHiddenNotifications(updatedHidden);
    localStorage.setItem('hiddenNotifications', JSON.stringify(updatedHidden));
    setNotifications((prev) => prev.filter((n) => n.id.toString() !== idStr));
  };

  const navClass = [
    'fixed top-0 w-full z-50 transition-all duration-300',
    atTop
      ? 'bg-transparent border-none'
      : 'bg-black/30 backdrop-blur-md border-white/10',
  ].join(' ');

  const submitLink = `${window.location.origin}/submit/${sessionId}`;
  const viewLink = `${window.location.origin}/view/${sessionId}?accessId=${accessId}`;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      console.error('Failed to copy text to clipboard');
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'info':
        return <Info className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <ShieldX className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationStyle = (notification: AppNotification) => {
    if (notification.custom_color) {
      return {
        backgroundColor: `${notification.custom_color}B3`,
        borderColor: `${notification.custom_color}80`,
      };
    }

    switch (notification.type) {
      case 'info':
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(96, 165, 250, 0.5)',
        };
      case 'warning':
        return {
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderColor: 'rgba(251, 191, 36, 0.5)',
        };
      case 'success':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgba(52, 211, 153, 0.5)',
        };
      case 'error':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: 'rgba(248, 113, 113, 0.5)',
        };
      default:
        return {
          backgroundColor: 'rgba(107, 114, 128, 0.7)',
          borderColor: 'rgba(156, 163, 175, 0.5)',
        };
    }
  };

  const currentNotification = filteredNotifications[currentNotificationIndex];

  return (
    <>
      {/* Mobile Notification Banner */}
      {filteredNotifications.length > 0 && isMobile && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <div className="flex items-start space-x-2">
            {/* Control Circle */}
            {filteredNotifications.length > 1 && (
              <button
                onClick={() => setShowAllNotifications(!showAllNotifications)}
                className="flex-shrink-0 w-8 h-8 rounded-full backdrop-blur-lg border flex items-center justify-center"
                style={{
                  backgroundColor: currentNotification.custom_color
                    ? `${currentNotification.custom_color}B3`
                    : currentNotification.type === 'info'
                      ? 'rgba(59, 130, 246, 0.7)'
                      : currentNotification.type === 'warning'
                        ? 'rgba(245, 158, 11, 0.7)'
                        : currentNotification.type === 'success'
                          ? 'rgba(16, 185, 129, 0.7)'
                          : currentNotification.type === 'error'
                            ? 'rgba(239, 68, 68, 0.7)'
                            : 'rgba(107, 114, 128, 0.7)',
                  borderColor: currentNotification.custom_color
                    ? `${currentNotification.custom_color}80`
                    : currentNotification.type === 'info'
                      ? 'rgba(96, 165, 250, 0.5)'
                      : currentNotification.type === 'warning'
                        ? 'rgba(251, 191, 36, 0.5)'
                        : currentNotification.type === 'success'
                          ? 'rgba(52, 211, 153, 0.5)'
                          : currentNotification.type === 'error'
                            ? 'rgba(248, 113, 113, 0.5)'
                            : 'rgba(156, 163, 175, 0.5)',
                }}
              >
                {showAllNotifications ? (
                  <ChevronUp className="h-4 w-4 text-white" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-white" />
                )}
              </button>
            )}

            {/* Notifications */}
            <div className="flex-1">
              <div
                className="transition-all duration-300 ease-in-out overflow-hidden"
                style={{
                  maxHeight: showAllNotifications ? '300px' : '60px',
                }}
              >
                <div className={showAllNotifications ? 'space-y-2' : ''}>
                  {filteredNotifications.map((notification, index) => (
                    <div
                      key={index}
                      className={`backdrop-blur-lg border rounded-2xl px-3 py-2 ${
                        showAllNotifications ||
                        index === currentNotificationIndex
                          ? ''
                          : 'hidden'
                      }`}
                      style={getNotificationStyle(notification)}
                    >
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {notification.custom_icon ||
                            getNotificationIcon(notification.type)}
                        </div>
                        <p className="text-sm font-medium text-white leading-tight flex-1">
                          {notification.text}
                        </p>
                        {/* New: Hide button */}
                        <button
                          onClick={() => hideNotification(notification.id)}
                          className="flex-shrink-0 ml-2 text-white hover:text-gray-300 transition-colors"
                          aria-label="Hide notification"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className={navClass}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <a href="/" className="flex items-center space-x-2">
                <TowerControl className="h-8 w-8 text-blue-400" />
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                  PFControl{' '}
                  <span className="text-red-300 font-medium text-md">Beta</span>
                </span>
              </a>
            </div>

            {sessionId && accessId && (
              <div className="flex-1 flex justify-center items-center space-x-3">
                <span
                  id="utc-time"
                  className="text-white font-mono text-sm px-3 py-1.5 rounded-lg hidden sm:inline"
                >
                  {utcTime} UTC
                </span>
                <div className="relative">
                  <Button
                    variant="primary"
                    className={`relative overflow-hidden transition-all duration-300 ${
                      copied === submitLink
                        ? 'bg-emerald-600 hover:bg-emerald-600 border-emerald-600'
                        : ''
                    }`}
                    size="sm"
                    onClick={() => handleCopy(submitLink)}
                    id="submit-link-btn"
                  >
                    <div
                      className={`flex items-center space-x-2 transition-transform duration-300 ${
                        copied === submitLink ? 'scale-105' : ''
                      }`}
                    >
                      {isCompact ? (
                        <Copy
                          className={`h-4 w-4 transition-transform duration-300 ${
                            copied === submitLink ? 'rotate-12' : ''
                          }`}
                          aria-label="Copy Submit Link"
                        />
                      ) : (
                        <>
                          <Copy
                            className={`h-4 w-4 transition-transform duration-300 ${
                              copied === submitLink ? 'rotate-12' : ''
                            }`}
                          />
                          <span className="font-medium">
                            {copied === submitLink ? 'Copied!' : 'Submit Link'}
                          </span>
                        </>
                      )}
                    </div>
                    {copied === submitLink && (
                      <div className="absolute inset-0 bg-emerald-400/20 animate-pulse rounded-lg"></div>
                    )}
                  </Button>
                </div>
                <div className="relative">
                  <Button
                    variant="danger"
                    className={`relative overflow-hidden transition-all duration-300 ${
                      copied === viewLink
                        ? '!bg-emerald-600 hover:!bg-emerald-600 !border-emerald-600'
                        : ''
                    }`}
                    size="sm"
                    onClick={() => handleCopy(viewLink)}
                    id="view-link-btn"
                  >
                    <div
                      className={`flex items-center space-x-2 transition-transform duration-300 ${
                        copied === viewLink ? 'scale-105' : ''
                      }`}
                    >
                      {isCompact ? (
                        <Copy
                          className={`h-4 w-4 transition-transform duration-300 ${
                            copied === viewLink ? 'rotate-12' : ''
                          }`}
                          aria-label="Copy View Link"
                        />
                      ) : (
                        <>
                          <Copy
                            className={`h-4 w-4 transition-transform duration-300 ${
                              copied === viewLink ? 'rotate-12' : ''
                            }`}
                          />
                          <span className="font-medium">
                            {copied === viewLink ? 'Copied!' : 'View Link'}
                          </span>
                        </>
                      )}
                    </div>
                    {copied === viewLink && (
                      <div className="absolute inset-0 bg-emerald-400/20 animate-pulse rounded-lg"></div>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {!sessionId && (
                <div className="space-x-6">
                  <a
                    href="/create"
                    className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
                  >
                    Create Session
                  </a>
                  <a
                    href="/sessions"
                    className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
                  >
                    My Sessions
                  </a>
                  <a
                    href="/pfatc"
                    className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
                  >
                    PFATC Flights
                  </a>
                </div>
              )}
              <CustomUserButton />
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="text-white hover:text-blue-400 transition-colors duration-300 p-2 rounded-lg hover:bg-white/10"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Dropdown */}
          <div className="mobile-menu-container relative md:hidden">
            <div
              className={`
                            absolute top-2 right-0 w-80 max-w-[calc(100vw-2rem)]
                            bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50
                            rounded-2xl shadow-2xl overflow-hidden
                            transform transition-all duration-300 ease-out origin-top-right
                            ${
                              isMenuOpen
                                ? 'opacity-100 scale-100 translate-y-0'
                                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                            }
                        `}
            >
              <div className="py-2">
                <a
                  href="/create"
                  className="block px-6 py-3 text-gray-300 hover:text-white hover:bg-blue-600/20 transition-all duration-200 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Create Session
                </a>
                <a
                  href="/sessions"
                  className="block px-6 py-3 text-gray-300 hover:text-white hover:bg-blue-600/20 transition-all duration-200 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  My Sessions
                </a>
                <a
                  href="/pfatc"
                  className="block px-6 py-3 text-gray-300 hover:text-white hover:bg-blue-600/20 transition-all duration-200 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  PFATC Flights
                </a>
              </div>

              <div className="border-t border-zinc-700/50 p-4">
                <CustomUserButton
                  isMobile={true}
                  className="w-full"
                  onAction={() => setIsMenuOpen(false)}
                />
              </div>
            </div>

            {isMenuOpen && (
              <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
                onClick={() => setIsMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </nav>

      {currentNotification && !isMobile && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="relative">
            <div
              className="transition-all duration-300 ease-in-out overflow-hidden"
              style={{
                maxHeight: showAllNotifications ? '300px' : '60px',
              }}
            >
              <div className={showAllNotifications ? 'space-y-2' : ''}>
                {filteredNotifications.map((notification, index) => (
                  <div
                    key={index}
                    className={`backdrop-blur-lg border rounded-full px-4 py-3 max-w-full transition-all duration-300 ease-in-out ${
                      showAllNotifications || index === currentNotificationIndex
                        ? ''
                        : 'hidden'
                    }`}
                    style={getNotificationStyle(notification)}
                  >
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {notification.custom_icon ||
                          getNotificationIcon(notification.type)}
                      </div>
                      <p className="text-sm font-medium text-white leading-tight flex-1">
                        {notification.text}
                      </p>
                      <button
                        onClick={() => hideNotification(notification.id)}
                        className="flex-shrink-0 ml-2 text-white hover:text-gray-300 transition-colors"
                        aria-label="Hide notification"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {filteredNotifications.length > 1 && (
              <button
                onClick={() => setShowAllNotifications(!showAllNotifications)}
                className="absolute bottom-0.5 -left-12 w-10 h-10 rounded-full backdrop-blur-lg border flex items-center justify-center transition-all duration-300 ease-in-out"
                style={{
                  backgroundColor: currentNotification.custom_color
                    ? `${currentNotification.custom_color}B3`
                    : currentNotification.type === 'info'
                      ? 'rgba(59, 130, 246, 0.7)'
                      : currentNotification.type === 'warning'
                        ? 'rgba(245, 158, 11, 0.7)'
                        : currentNotification.type === 'success'
                          ? 'rgba(16, 185, 129, 0.7)'
                          : currentNotification.type === 'error'
                            ? 'rgba(239, 68, 68, 0.7)'
                            : 'rgba(107, 114, 128, 0.7)',
                  borderColor: currentNotification.custom_color
                    ? `${currentNotification.custom_color}80`
                    : currentNotification.type === 'info'
                      ? 'rgba(96, 165, 250, 0.5)'
                      : currentNotification.type === 'warning'
                        ? 'rgba(251, 191, 36, 0.5)'
                        : currentNotification.type === 'success'
                          ? 'rgba(52, 211, 153, 0.5)'
                          : currentNotification.type === 'error'
                            ? 'rgba(248, 113, 113, 0.5)'
                            : 'rgba(156, 163, 175, 0.5)',
                }}
              >
                {showAllNotifications ? (
                  <ChevronUp className="h-5 w-5 text-white" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-white" />
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
