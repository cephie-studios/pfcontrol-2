import { useState, useEffect, useRef } from 'react';
import {
  Info,
  MessageCircle,
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
} from 'lucide-react';
import { io } from 'socket.io-client';
import { createSessionUsersSocket } from '../../sockets/sessionUsersSocket';
import { fetchSession } from '../../utils/fetch/sessions';
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
import ChatSidebar from './ChatSidebar';
import ATIS from './ATIS';

interface ToolbarProps {
  sessionId?: string;
  accessId?: string;
  icao: string | null;
  activeRunway?: string;
  onRunwayChange?: (runway: string) => void;
  isPFATC?: boolean;
  currentView?: 'departures' | 'arrivals';
  onViewChange?: (view: 'departures' | 'arrivals') => void;
  showViewTabs?: boolean;
  position: Position;
  onPositionChange: (position: Position) => void;
  onContactAcarsClick?: () => void;
  onChartClick?: () => void;
}

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
  currentView = 'departures',
  onViewChange,
  showViewTabs = true,
  position,
  onPositionChange,
  onContactAcarsClick,
  onChartClick,
}: ToolbarProps) {
  const [runway, setRunway] = useState(activeRunway || '');
  const [chatOpen, setChatOpen] = useState(false);
  const [atisOpen, setAtisOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<SessionUser[]>([]);
  const [unreadMentions, setUnreadMentions] = useState<ChatMention[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    'Connected' | 'Reconnecting' | 'Disconnected'
  >('Disconnected');
  const [atisLetter, setAtisLetter] = useState<string>('A');
  const [atisFlash, setAtisFlash] = useState<boolean>(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const { user } = useAuth();

  // Load initial ATIS data on mount or when sessionId/accessId changes
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

  const handleAtisOpen = () => {
    setAtisOpen(true);
    setChatOpen(false);
    setAtisFlash(false);
  };

  const handleAtisClose = () => {
    setAtisOpen(false);
  };

  const handleChatOpen = () => {
    setChatOpen(true);
    setAtisOpen(false);
  };

  const handleChatClose = () => {
    setChatOpen(false);
  };

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

  // Update position without reconnecting socket
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
    }
  }, [chatOpen]);

  useEffect(() => {
    const loadInitialAtisData = async () => {
      if (!sessionId || !accessId) return;

      try {
        const sessionData = await fetchSession(sessionId, accessId);
        if (sessionData?.atis?.letter) {
          setAtisLetter(sessionData.atis.letter);
        }
      } catch (error) {
        console.error('Error loading initial ATIS data:', error);
      }
    };

    loadInitialAtisData();
  }, [sessionId, accessId]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'Connected':
        return 'text-green-500';
      case 'Reconnecting':
        return 'text-yellow-500';
      case 'Disconnected':
        return 'text-red-500';
    }
  };

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
    <div
      className="
                toolbar
                flex items-center justify-between w-full px-4 py-2
                gap-2
                lg:flex-row lg:gap-4 lg:items-center
                md:flex-col md:items-start md:gap-3
                sm:flex-col sm:items-start sm:gap-2
            "
    >
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

      <div
        id="toolbar-middle"
        className="flex flex-col items-center gap-1 flex-1 relative"
      >
        <div className="relative flex">
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
                {/* Combined tooltip for username and role */}
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
            <span id="icao-display" className="text-md text-gray-300 font-bold">
              {icao}
            </span>
          )}
          {getStatusIcon()}
        </div>
      </div>

      <div
        className="
                    flex items-center gap-4
                    lg:gap-4
                    md:gap-3
                    sm:gap-2
                    flex-wrap
                "
      >
        {isPFATC && showViewTabs && (
          <div id="view-tabs" className="flex items-center gap-2">
            <Button
              className={`p-1 rounded ${
                currentView === 'departures'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent text-gray-400 hover:text-white'
              }`}
              onClick={() => handleViewChange('departures')}
              size="sm"
              aria-label="Departures"
            >
              <PlaneTakeoff className="w-4 h-4" />
            </Button>
            <Button
              className={`p-1 rounded ${
                currentView === 'arrivals'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent text-gray-400 hover:text-white'
              }`}
              onClick={() => handleViewChange('arrivals')}
              size="sm"
              aria-label="Arrivals"
            >
              <PlaneLanding className="w-4 h-4" />
            </Button>
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
          onClick={handleAtisOpen}
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
          onClick={handleChatOpen}
          id="chat-button"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="hidden sm:inline font-medium">Chat</span>
          {unreadMentions.length > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unreadMentions.length}
            </div>
          )}
        </Button>

        <Button
          className="flex items-center gap-2 px-4 py-2"
          aria-label="Charts"
          size="sm"
          onClick={() => {
            setChatOpen(false);
            setAtisOpen(false);
            onChartClick?.();
          }}
          id="chart-button"
        >
          <Map className="w-5 h-5" />
          <span className="hidden sm:inline font-medium">Charts</span>
        </Button>

        {isPFATC && (
          <Button
            className="flex items-center gap-2 px-4 py-2"
            aria-label="Contact"
            size="sm"
            onClick={() => {
              setChatOpen(false);
              setAtisOpen(false);
              onContactAcarsClick?.();
            }}
            id="contact-button"
          >
            <Radio className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Contact</span>
          </Button>
        )}

        <ChatSidebar
          sessionId={sessionId ?? ''}
          accessId={accessId ?? ''}
          open={chatOpen}
          onClose={handleChatClose}
          sessionUsers={activeUsers}
          onMentionReceived={handleChatSidebarMention}
        />

        <Button
          className="flex items-center gap-2 px-4 py-2"
          aria-label="Settings"
          size="sm"
          onClick={() => {
            const isTutorial = window.location.search.includes('tutorial');
            window.open(
              '/settings' + (isTutorial ? '?tutorial=true' : ''),
              isTutorial ? '_self' : '_blank'
            );
          }}
          id="settings-button"
        >
          <Settings className="w-5 h-5" />
          <span className="hidden sm:inline font-medium">Settings</span>
        </Button>

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
  );
}
