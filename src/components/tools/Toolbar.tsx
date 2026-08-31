import { useState, useEffect, useRef } from 'react';
import {
  Info,
  MessageCircle,
  Phone,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  PlaneLanding,
  PlaneTakeoff,
  Star,
  Shield,
  Wrench,
  Award,
  Crown,
  Trophy,
  Zap,
  Target,
  Heart,
  Sparkles,
  Flame,
  TrendingUp,
  FlaskConical,
  Braces,
  Radio,
  Map,
  X,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { createSessionUsersSocket } from '../../sockets/sessionUsersSocket';
import { useAuth } from '../../hooks/auth/useAuth';
import { playSoundWithSettings } from '../../utils/playSound';
import type {
  Position,
  SessionUser,
  ChatMention as SessionChatMention,
} from '../../types/session';
import type { ChatMention } from '../../types/chats';
import WindDisplay from './WindDisplay';
import Button from '../common/Button';
import RunwayDropdown from '../dropdowns/RunwayDropdown';
import Dropdown from '../common/Dropdown';
import FrequencyDisplay from './FrequencyDisplay';
import { ChatSidebar } from '../chat';
import ATIS from './ATIS';
import DeveloperPillSegmentedControl from '../../pages/developers/DeveloperPillSegmentedControl';

interface ToolbarProps {
  sessionId?: string;
  accessId?: string;
  icao: string | null;
  activeRunway?: string;
  onRunwayChange?: (runway: string) => void;
  isPFATC?: boolean;
  isAdvancedATC?: boolean;
  currentView?: 'departures' | 'arrivals';
  onViewChange?: (view: 'departures' | 'arrivals') => void;
  showViewTabs?: boolean;
  feedbackEnabled?: boolean;
  onFeedbackToggle?: () => void;
  position: Position;
  onPositionChange: (position: Position) => void;
  onContactAcarsClick?: () => void;
  onChartClick?: () => void;
  showChartsDrawer?: boolean;
  showContactAcarsModal?: boolean;
  onCloseAllSidebars?: () => void;
}

const SETTINGS_TIP_STORAGE_KEY = 'settingsTipDismissedUntil';
const SETTINGS_TIP_DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

const getIconComponent = (iconName: string) => {
  const icons: Record<
    string,
    React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  > = {
    Star,
    Shield,
    Wrench,
    Award,
    Crown,
    Trophy,
    Zap,
    Target,
    Heart,
    Sparkles,
    Flame,
    TrendingUp,
    FlaskConical,
    Braces,
  };
  return icons[iconName] || Star;
};

const getHighestRole = (
  roles?: Array<{
    id: number;
    name: string;
    color: string;
    icon: string;
    priority: number;
  }>
) => {
  if (!roles || roles.length === 0) return null;
  return roles.reduce((highest, current) =>
    current.priority > highest.priority ? current : highest
  );
};

export default function Toolbar({
  icao,
  sessionId,
  accessId,
  activeRunway,
  onRunwayChange,
  isPFATC = false,
  isAdvancedATC = false,
  currentView = 'departures',
  onViewChange,
  showViewTabs = true,
  feedbackEnabled = true,
  onFeedbackToggle,
  position,
  onPositionChange,
  onContactAcarsClick,
  onChartClick,
  showChartsDrawer = false,
  showContactAcarsModal = false,
  onCloseAllSidebars,
}: ToolbarProps) {
  const [runway, setRunway] = useState(activeRunway || '');
  const [chatOpen, setChatOpen] = useState(false);
  const [isInVoice, setIsInVoice] = useState(false);
  const [atisOpen, setAtisOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [showSettingsTip, setShowSettingsTip] = useState(false);
  const [activeUsers, setActiveUsers] = useState<SessionUser[]>([]);
  const [unreadMentions, setUnreadMentions] = useState<ChatMention[]>([]);
  const [unreadSessionMentions, setUnreadSessionMentions] = useState<
    ChatMention[]
  >([]);
  const [unreadGlobalMentions, setUnreadGlobalMentions] = useState<
    ChatMention[]
  >([]);
  const [connectionStatus, setConnectionStatus] = useState<
    'Connected' | 'Reconnecting' | 'Disconnected'
  >('Disconnected');
  const [atisLetter, setAtisLetter] = useState<string>('A');
  const [atisFlash, setAtisFlash] = useState<boolean>(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!settingsMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(event.target as Node)
      ) {
        setSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsMenuOpen]);

  useEffect(() => {
    if (!isPFATC && !isAdvancedATC) return;
    const dismissedUntil = localStorage.getItem(SETTINGS_TIP_STORAGE_KEY);
    if (!dismissedUntil || Date.now() > Number(dismissedUntil)) {
      setShowSettingsTip(true);
    }
  }, [isPFATC, isAdvancedATC]);

  const dismissSettingsTip = () => {
    localStorage.setItem(
      SETTINGS_TIP_STORAGE_KEY,
      String(Date.now() + SETTINGS_TIP_DISMISS_DURATION_MS)
    );
    setShowSettingsTip(false);
  };

  useEffect(() => {
    const loadInitialAtisData = async () => {
      if (!sessionId || !accessId) return;
      try {
        const { fetchSession } = await import('../../utils/fetch/sessions');
        const session = await fetchSession(sessionId, accessId);
        if (session.atis) {
          let atisObj = session.atis;
          if (typeof atisObj === 'string') {
            try {
              atisObj = JSON.parse(atisObj);
            } catch {
              atisObj = {
                letter: 'A',
                text: '',
                timestamp: new Date().toISOString(),
              };
            }
          }
          if (atisObj && atisObj.letter) {
            setAtisLetter(atisObj.letter);
          }
        }
      } catch {
        console.error('Error loading initial ATIS data');
      }
    };
    loadInitialAtisData();
  }, [sessionId, accessId]);

  const handleRunwayChange = (selectedRunway: string) => {
    setRunway(selectedRunway);
    if (onRunwayChange) {
      onRunwayChange(selectedRunway);
    }
  };

  const handlePositionChange = (selectedPosition: string) => {
    onPositionChange(selectedPosition as Position);
  };

  const handleViewChange = (view: 'departures' | 'arrivals') => {
    if (onViewChange) {
      onViewChange(view);
    }
  };

  const getAvatarUrl = (avatar: string | null) => {
    if (!avatar) return '/assets/app/default/avatar.webp';
    return avatar;
  };

  const handleMentionReceived = (mention: SessionChatMention) => {
    const chatMention: ChatMention = {
      messageId: Number(mention.id),
      mentionedUserId: mention.userId,
      mentionerUsername: mention.username,
      message: mention.message,
      sessionId: mention.sessionId,
      timestamp: mention.timestamp.toString(),
    };
    setUnreadMentions((prev) => [...prev, chatMention]);
    if (user) {
      playSoundWithSettings('chatNotificationSound', user.settings, 0.7).catch(
        (error) => {
          console.warn('Failed to play chat notification sound:', error);
        }
      );
    }
  };

  const handleChatSidebarMention = (mention: ChatMention) => {
    setUnreadMentions((prev) => [...prev, mention]);

    if (mention.sessionId === 'global-chat') {
      setUnreadGlobalMentions((prev) => [...prev, mention]);
    } else {
      setUnreadSessionMentions((prev) => [...prev, mention]);
    }

    if (user) {
      playSoundWithSettings('chatNotificationSound', user.settings, 0.7).catch(
        (error) => {
          console.warn('Failed to play chat notification sound:', error);
        }
      );
    }
  };

  type AtisData = {
    letter?: string;
    updatedBy?: string;
    isAutoGenerated?: boolean;
  };

  const handleAtisUpdate = (atisData: AtisData) => {
    if (atisData.letter) {
      setAtisLetter(atisData.letter);
    }
  };

  const handleAtisUpdateFromSocket = (data: {
    atis?: AtisData;
    updatedBy?: string;
    isAutoGenerated?: boolean;
  }) => {
    if (data.atis?.letter) {
      setAtisLetter(data.atis.letter);

      if (data.updatedBy !== user?.username || data.isAutoGenerated) {
        setAtisFlash(true);
        setTimeout(() => setAtisFlash(false), 30000);
      }
    }
  };

  const handleAtisToggle = () => {
    setAtisOpen((prev) => !prev);
    setAtisFlash(false);
    if (!atisOpen) {
      setChatOpen(false);
      onCloseAllSidebars?.();
    }
  };

  const handleAtisClose = () => {
    setAtisOpen(false);
  };

  const handleChatToggle = () => {
    setChatOpen((prev) => !prev);
    if (!chatOpen) {
      setAtisOpen(false);
      onCloseAllSidebars?.();
    }
  };

  const handleChatClose = () => {
    setChatOpen(false);
  };

  const handleChartsClick = () => {
    setChatOpen(false);
    setAtisOpen(false);
    onChartClick?.();
  };

  const handleContactClick = () => {
    setChatOpen(false);
    setAtisOpen(false);
    onContactAcarsClick?.();
  };

  useEffect(() => {
    if (showChartsDrawer || showContactAcarsModal) {
      setChatOpen(false);
      setAtisOpen(false);
    }
  }, [showChartsDrawer, showContactAcarsModal]);

  useEffect(() => {
    if (!sessionId || !accessId || !user) return;

    socketRef.current = createSessionUsersSocket(
      sessionId,
      accessId,
      {
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
      },
      (users: SessionUser[]) => setActiveUsers(users),
      () => setConnectionStatus('Connected'),
      () => setConnectionStatus('Disconnected'),
      () => setConnectionStatus('Reconnecting'),
      () => setConnectionStatus('Connected'),
      handleMentionReceived,
      undefined,
      position
    );

    if (socketRef.current) {
      socketRef.current.on('atisUpdate', handleAtisUpdateFromSocket);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('atisUpdate', handleAtisUpdateFromSocket);
        socketRef.current.disconnect();
      }
    };
  }, [sessionId, accessId, user]);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('positionChange', position);
    }
  }, [position]);

  useEffect(() => {
    if (activeRunway !== undefined) {
      setRunway(activeRunway);
    }
  }, [activeRunway]);

  useEffect(() => {
    if (chatOpen) {
      setUnreadMentions([]);
      setUnreadSessionMentions([]);
      setUnreadGlobalMentions([]);
    }
  }, [chatOpen]);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'Connected':
        return <Wifi className="w-5 h-5 text-green-500" />;
      case 'Reconnecting':
        return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'Disconnected':
        return <WifiOff className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <div className="toolbar flex items-center justify-between w-full px-4 py-2 gap-2 lg:gap-4">
      <div
        className="
                    wind-frequency-group
                    flex items-center gap-4
                    lg:gap-4
                    md:gap-3
                    sm:gap-2
                "
      >
        <WindDisplay icao={icao} size="small" />
        <FrequencyDisplay airportIcao={icao ?? ''} />
      </div>

      <div className="toolbar-secondary">
        <div
          id="toolbar-middle"
          className="flex flex-col items-center gap-1 flex-1 relative"
        >
          <div className="toolbar-avatar-row relative flex justify-center">
            {activeUsers.slice(0, 5).map((user, index) => {
              const highestRole = getHighestRole(user.roles);
              const RoleIcon = highestRole
                ? getIconComponent(highestRole.icon)
                : null;

              return (
                <div
                  key={user.id}
                  className="relative group"
                  style={{
                    position: 'relative',
                    left: `${index * -10}px`,
                    zIndex: 40,
                  }}
                >
                  <img
                    src={getAvatarUrl(user.avatar)}
                    alt={user.username}
                    className="w-8 h-8 rounded-full shadow-md cursor-pointer transition-all"
                    onError={(e) => {
                      e.currentTarget.src = '/assets/app/default/avatar.webp';
                    }}
                    style={{
                      border: `2px solid ${highestRole?.color || '#ffffff'}`,
                    }}
                  />
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-0.5 bg-zinc-900/80 backdrop-blur-md border-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-2xl"
                    style={{
                      borderColor: highestRole?.color || '#71717a',
                      zIndex: 998,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {user.username}
                      </span>
                      {highestRole && RoleIcon && (
                        <>
                          <span className="text-white/50">•</span>
                          <RoleIcon
                            className="w-3 h-3"
                            style={{
                              color: highestRole.color,
                            }}
                          />
                          <span
                            className="text-xs font-semibold"
                            style={{
                              color: highestRole.color,
                            }}
                          >
                            {highestRole.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {activeUsers.length > 5 && (
              <div
                className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold"
                style={{ position: 'relative', left: '-50px' }}
              >
                +{activeUsers.length - 5}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {icao && (
              <span
                id="icao-display"
                className="text-md text-gray-300 font-bold"
              >
                {icao}
              </span>
            )}
            {getStatusIcon()}
          </div>
        </div>

        <div
          className="
                    toolbar-controls
                    flex items-center gap-4
                    lg:gap-4
                    md:gap-3
                    sm:gap-2
                    flex-wrap
                "
        >
          {(isPFATC || isAdvancedATC) && showViewTabs && (
            <div id="view-tabs" className="w-[120px]">
              <DeveloperPillSegmentedControl
                tabs={[
                  {
                    id: 'departures',
                    label: '',
                    icon: PlaneTakeoff,
                  },
                  { id: 'arrivals', label: '', icon: PlaneLanding },
                ]}
                value={currentView}
                onChange={handleViewChange}
                aria-label="Departures or arrivals view"
              />
            </div>
          )}

          <Dropdown
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'DEL', label: 'Delivery' },
              { value: 'GND', label: 'Ground' },
              { value: 'TWR', label: 'Tower' },
              { value: 'APP', label: 'Approach' },
            ]}
            value={position}
            onChange={handlePositionChange}
            placeholder="Select Position"
            disabled={!icao}
            size="sm"
            className="min-w-[100px]"
            id="position-dropdown"
          />

          <RunwayDropdown
            airportIcao={icao ?? ''}
            onChange={handleRunwayChange}
            value={runway}
            size="sm"
            id="runway-dropdown-toolbar"
          />

          <Button
            className={`flex items-center gap-2 px-4 py-2 transition-all duration-300 ${
              atisFlash
                ? 'bg-yellow-600 border-yellow-600 text-white animate-pulse'
                : ''
            }`}
            aria-label="ATIS"
            size="sm"
            variant="outline"
            onClick={handleAtisToggle}
            id="atis-button"
          >
            <Info className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">
              ATIS {atisLetter}
            </span>
          </Button>

          <Button
            className="flex items-center gap-2 px-4 py-2 relative"
            aria-label="Chat"
            size="sm"
            onClick={handleChatToggle}
            id="chat-button"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Chat</span>
            {unreadMentions.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadMentions.length}
              </div>
            )}
            {isInVoice && !chatOpen && unreadMentions.length === 0 && (
              <div className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 rounded-full bg-green-500 border-2 border-zinc-900">
                <Phone className="w-2.5 h-2.5 text-white" />
              </div>
            )}
            {isInVoice && !chatOpen && unreadMentions.length > 0 && (
              <Phone className="absolute -bottom-1 -right-1 w-3 h-3 text-green-400" />
            )}
          </Button>

          <Button
            className="flex items-center gap-2 px-4 py-2"
            aria-label="Charts"
            size="sm"
            onClick={handleChartsClick}
            id="chart-button"
          >
            <Map className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Charts</span>
          </Button>

          {(isPFATC || isAdvancedATC) && (
            <Button
              className="flex items-center gap-2 px-4 py-2"
              aria-label="Contact"
              size="sm"
              onClick={handleContactClick}
              id="contact-button"
            >
              <Radio className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Contact</span>
            </Button>
          )}

          <div className="relative" ref={settingsMenuRef}>
            <Button
              className="flex items-center gap-2 px-4 py-2"
              aria-label="Settings menu"
              aria-expanded={settingsMenuOpen}
              size="sm"
              onClick={() => {
                setSettingsMenuOpen((prev) => !prev);
                if (showSettingsTip) dismissSettingsTip();
              }}
              id="settings-button"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Settings</span>
            </Button>

            {showSettingsTip && (
              <div className="absolute right-0 bottom-full mb-2.5 w-64 bg-zinc-900 border border-blue-600 rounded-2xl shadow-2xl z-[10000] p-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-zinc-200 font-medium leading-snug">
                    More Layout options are available in the Settings menu.
                  </p>
                  <button
                    type="button"
                    onClick={dismissSettingsTip}
                    aria-label="Dismiss"
                    className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-zinc-900 border-b border-r border-blue-600 rotate-45" />
              </div>
            )}

            {settingsMenuOpen && (
              <div className="absolute right-0 mt-2 w-45 bg-zinc-900 border border-blue-600 rounded-3xl shadow-2xl backdrop-blur-xl z-[10000] overflow-hidden animate-in slide-in-from-top-1 duration-150">
                <div className="p-1.5">
                  {(isPFATC || isAdvancedATC) && (
                    <>
                      <button
                        type="button"
                        onClick={() => onFeedbackToggle?.()}
                        aria-pressed={feedbackEnabled}
                        className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-2xl text-zinc-400 hover:bg-blue-800 hover:text-zinc-50 transition-colors duration-150 text-sm"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Star className="w-4 h-4 shrink-0" />
                          <span className="font-medium truncate">Feedback</span>
                        </span>
                        <span
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${feedbackEnabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
                        >
                          <span
                            className={`absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 transition-transform ${feedbackEnabled ? 'translate-x-full' : ''}`}
                          />
                        </span>
                      </button>
                      <div className="my-1 border-t border-zinc-800" />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSettingsMenuOpen(false);
                      const isTutorial =
                        window.location.search.includes('tutorial');
                      window.location.href =
                        '/settings' + (isTutorial ? '?tutorial=true' : '');
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-zinc-400 hover:bg-blue-800 hover:text-zinc-50 transition-colors duration-150 text-sm"
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    <span className="font-medium">Settings</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <ChatSidebar
            sessionId={sessionId ?? ''}
            accessId={accessId ?? ''}
            open={chatOpen}
            onClose={handleChatClose}
            sessionUsers={activeUsers}
            onMentionReceived={handleChatSidebarMention}
            station={icao ?? undefined}
            position={position as string}
            isPFATC={isPFATC}
            isAdvancedATC={isAdvancedATC}
            unreadSessionCount={unreadSessionMentions.length}
            unreadGlobalCount={unreadGlobalMentions.length}
            onVoiceStateChange={setIsInVoice}
          />

          <ATIS
            icao={icao ?? ''}
            sessionId={sessionId ?? ''}
            accessId={accessId ?? ''}
            activeRunway={activeRunway}
            open={atisOpen}
            onClose={handleAtisClose}
            socket={socketRef.current ?? undefined}
            onAtisUpdate={handleAtisUpdate}
          />
        </div>
      </div>
    </div>
  );
}
