import { useState, useEffect, useRef, useMemo } from 'react';
import {
  fetchChatMessages,
  reportChatMessage,
  fetchGlobalChatMessages,
  reportGlobalChatMessage,
  // fetchAATCChatMessages, // AATC disabled
  // reportAATCChatMessage, // AATC disabled
} from '../../utils/fetch/chats';
import {
  isUserInActiveChat,
  handleMentionSuggestions,
  handleGlobalMentionSuggestions,
  insertMentionIntoText,
  isAtBottom,
} from '../../utils/chats';
import { useAuth } from '../../hooks/auth/useAuth';
import { useData } from '../../hooks/data/useData';
import { createChatSocket } from '../../sockets/chatSocket';
import {
  createGlobalChatSocket,
  type GlobalChatMessage,
  type ConnectedGlobalChatUser,
} from '../../sockets/globalChatSocket';
import {
  X,
  Flag,
  MessageCircle,
  Radio,
  Wifi,
  WifiOff,
  Phone,
} from 'lucide-react';
import type { ChatMessage, ChatMention } from '../../types/chats';
import type { SessionUser } from '../../types/session';
import type { ToastType } from '../common/Toast';
import {
  createVoiceChatSocket,
  type VoiceUser,
  type VoiceConnectionState,
} from '../../sockets/voiceChatSocket';
import Button from '../common/Button';
import Loader from '../common/Loader';
import Modal from '../common/Modal';
import Toast from '../common/Toast';
import VoiceChat from './VoiceChat';
import { ChatMessageRow, type ChatListMessage } from './ChatMessageRow';
import { ChatTextComposer } from './ChatTextComposer';

interface ChatSidebarProps {
  sessionId: string;
  accessId: string;
  open: boolean;
  onClose: () => void;
  sessionUsers: SessionUser[];
  onMentionReceived?: (_: ChatMention) => void;
  station?: string;
  position?: string;
  isPFATC?: boolean;
  // isAdvancedATC?: boolean; // AATC disabled
  unreadSessionCount?: number;
  unreadGlobalCount?: number;
  onVoiceStateChange?: (_inVoice: boolean) => void;
}

export default function ChatSidebar({
  sessionId,
  accessId,
  open,
  onClose,
  sessionUsers,
  onMentionReceived,
  station,
  position,
  isPFATC = false,
  // isAdvancedATC = false, // AATC disabled
  unreadSessionCount = 0,
  unreadGlobalCount = 0,
  onVoiceStateChange,
}: ChatSidebarProps) {
  const { user } = useAuth();
  const { airports } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);
  const [activeChatUsers, setActiveChatUsers] = useState<string[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<SessionUser[]>(
    []
  );
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportingMessageId, setReportingMessageId] = useState<number | null>(
    null
  );
  const [reportingGlobalMessage, setReportingGlobalMessage] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [automoddedMessages, setAutomoddedMessages] = useState<
    Map<number, string>
  >(new Map());
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pendingDeleteRef = useRef<ChatMessage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);

  // AATC disabled — 'aatc' tab removed from type; isAdvancedATC always false
  const [activeTab, setActiveTab] = useState<
    'session' | 'voice' | 'pfatc' /* | 'aatc' */
  >(sessionId ? 'session' : 'pfatc');
  const [globalMessages, setGlobalMessages] = useState<GlobalChatMessage[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalInput, setGlobalInput] = useState('');
  const [connectedGlobalChatUsers, setConnectedGlobalChatUsers] = useState<
    ConnectedGlobalChatUser[]
  >([]);
  const [showGlobalSuggestions, setShowGlobalSuggestions] = useState(false);
  const [globalSuggestions, setGlobalSuggestions] = useState<
    Array<{
      type: 'user' | 'airport';
      data:
        | SessionUser
        | { icao: string; name: string }
        | ConnectedGlobalChatUser;
    }>
  >([]);
  const [selectedGlobalSuggestionIndex, setSelectedGlobalSuggestionIndex] =
    useState(-1);
  const globalSocketRef = useRef<ReturnType<
    typeof createGlobalChatSocket
  > | null>(null);
  const globalPendingDeleteRef = useRef<GlobalChatMessage | null>(null);
  const globalTextareaRef = useRef<HTMLTextAreaElement>(null);
  // AATC disabled — AATC-specific state commented out
  // const aatcSocketRef = useRef<ReturnType<typeof createGlobalChatSocket> | null>(null);
  // const aatcPendingDeleteRef = useRef<GlobalChatMessage | null>(null);
  // const [aatcMessages, setAatcMessages] = useState<GlobalChatMessage[]>([]);
  // const [aatcLoading, setAatcLoading] = useState(false);
  // const [aatcInput, setAatcInput] = useState('');
  // const [aatcConnectedUsers, setAatcConnectedUsers] = useState<ConnectedGlobalChatUser[]>([]);
  // const [aatcTypingUsers, setAatcTypingUsers] = useState<Map<string, string>>(new Map());
  // const aatcTypingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // const lastAatcTypingEmit = useRef(0);
  const onMentionReceivedRef = useRef(onMentionReceived);
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>({
    connected: false,
    connecting: false,
    error: null,
  });
  const [talkingUsers, setTalkingUsers] = useState<Set<string>>(new Set());
  const [audioLevels, setAudioLevels] = useState<Map<string, number>>(
    new Map()
  );
  const [isInVoice, setIsInVoice] = useState(false);
  const [voiceDevices, setVoiceDevices] = useState<MediaDeviceInfo[]>([]);

  const voiceSocketRef = useRef<ReturnType<
    typeof createVoiceChatSocket
  > | null>(null);

  const [, setUnreadSessionMentions] = useState<ChatMention[]>([]);
  const [, setUnreadGlobalMentions] = useState<ChatMention[]>([]);

  // userId -> username for people currently typing
  const [sessionTypingUsers, setSessionTypingUsers] = useState<
    Map<string, string>
  >(new Map());
  const [globalTypingUsers, setGlobalTypingUsers] = useState<
    Map<string, string>
  >(new Map());
  // Timeouts that auto-clear a user from the typing map after inactivity
  const sessionTypingTimeouts = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const globalTypingTimeouts = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  // Timestamp of last typing emit — used to throttle sends
  const lastSessionTypingEmit = useRef(0);
  const lastGlobalTypingEmit = useRef(0);
  const [userVolumes, setUserVolumes] = useState<Map<string, number>>(() => {
    const storedVolumes = localStorage.getItem('userVolumes');
    return storedVolumes ? new Map(JSON.parse(storedVolumes)) : new Map();
  });
  // Ref so the voice socket always reads the latest volumes without needing
  // to be recreated when the map changes.
  const userVolumesRef = useRef(userVolumes);
  useEffect(() => {
    userVolumesRef.current = userVolumes;
  }, [userVolumes]);

  useEffect(() => {
    onVoiceStateChange?.(isInVoice);
  }, [isInVoice, onVoiceStateChange]);

  const getConnectionIcon = () => {
    if (connectionState.connecting)
      return <Wifi className="w-4 h-4 animate-pulse text-yellow-400" />;
    if (connectionState.connected)
      return <Wifi className="w-4 h-4 text-green-400" />;
    return <WifiOff className="w-4 h-4 text-red-400" />;
  };

  useEffect(() => {
    onMentionReceivedRef.current = onMentionReceived;
  }, [onMentionReceived]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!sessionId || !accessId || !user) return;

    if (!socketRef.current) {
      socketRef.current = createChatSocket(
        sessionId,
        accessId,
        user.userId,
        (msg: ChatMessage) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) {
              return prev;
            }
            return [...prev, msg];
          });
        },
        (data: { messageId: number }) => {
          setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
          setAutomoddedMessages((prev) => {
            const newMap = new Map(prev);
            newMap.delete(data.messageId);
            return newMap;
          });
        },
        (data: { messageId: number; error: string }) => {
          if (
            pendingDeleteRef.current &&
            pendingDeleteRef.current.id === data.messageId
          ) {
            setMessages((prev) => {
              const newMessages = [...prev, pendingDeleteRef.current!];
              return newMessages.sort(
                (a, b) =>
                  new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
              );
            });
            pendingDeleteRef.current = null;
          }
        },
        (users: string[]) => {
          setActiveChatUsers(users);
        },
        (mention: ChatMention) => {
          if (!open || activeTab !== 'session') {
            if (mention.mentionedUserId === user.userId && onMentionReceived) {
              onMentionReceived(mention);
            }
          }
        },
        (data: { messageId: number; reason?: string }) => {
          setAutomoddedMessages((prev) => {
            const newMap = new Map(prev);
            newMap.set(data.messageId, data.reason || 'Hate speech detected');
            return newMap;
          });
        },
        ({
          userId: typingId,
          username,
        }: {
          userId: string;
          username: string;
        }) => {
          setSessionTypingUsers((prev) =>
            new Map(prev).set(typingId, username)
          );
          const prev = sessionTypingTimeouts.current.get(typingId);
          if (prev) clearTimeout(prev);
          sessionTypingTimeouts.current.set(
            typingId,
            setTimeout(() => {
              setSessionTypingUsers((m) => {
                const next = new Map(m);
                next.delete(typingId);
                return next;
              });
              sessionTypingTimeouts.current.delete(typingId);
            }, 3000)
          );
        }
      );

      if (open) {
        socketRef.current.socket.emit('chatOpened');
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [sessionId, accessId, user, open, activeTab, onMentionReceived]);

  useEffect(() => {
    if (!socketRef.current) return;

    if (open) {
      socketRef.current.socket.emit('chatOpened');
    } else {
      socketRef.current.socket.emit('chatClosed');
    }
  }, [open]);

  useEffect(() => {
    if (!sessionId || !open || messagesLoaded) return;

    setLoading(true);
    setErrorMessage(null);
    fetchChatMessages(sessionId)
      .then((fetchedMessages) => {
        setMessages(fetchedMessages);
        setLoading(false);
        setMessagesLoaded(true);
      })
      .catch((error) => {
        console.error('Failed to fetch chat messages:', error);
        setErrorMessage('Failed to load chat messages');
        setMessages([]);
        setLoading(false);
        setMessagesLoaded(true);
      });
  }, [sessionId, open, messagesLoaded]);

  // PFATC global chat socket
  useEffect(() => {
    if (!user || !isPFATC) return;

    if (!globalSocketRef.current) {
      globalSocketRef.current = createGlobalChatSocket(
        user.userId,
        station || null,
        position || null,
        (msg: GlobalChatMessage) => {
          setGlobalMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
        (data: { messageId: number }) => {
          setGlobalMessages((prev) =>
            prev.filter((m) => m.id !== data.messageId)
          );
        },
        (data: { messageId: number; error: string }) => {
          if (globalPendingDeleteRef.current?.id === data.messageId) {
            setGlobalMessages((prev) =>
              [...prev, globalPendingDeleteRef.current!].sort(
                (a, b) =>
                  new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
              )
            );
            globalPendingDeleteRef.current = null;
          }
        },
        undefined,
        (data: { messageId: number; reason: string }) => {
          setAutomoddedMessages((prev) => {
            const newMap = new Map(prev);
            newMap.set(data.messageId, data.reason);
            return newMap;
          });
        },
        (mention) => {
          if (!open || activeTab !== 'pfatc') {
            if (
              user &&
              mention.mentionedUserId === user.userId &&
              onMentionReceivedRef.current
            ) {
              onMentionReceivedRef.current({
                messageId: parseInt(mention.messageId, 10),
                mentionedUserId: mention.mentionedUserId,
                mentionerUsername: mention.mentionerUsername,
                message: mention.message,
                timestamp: mention.timestamp,
                sessionId: 'global-chat',
              });
            }
          }
        },
        (mention) => {
          if (!open || activeTab !== 'pfatc') {
            if (
              mention.airport &&
              station &&
              mention.airport.toUpperCase() === station.toUpperCase() &&
              onMentionReceivedRef.current
            ) {
              onMentionReceivedRef.current({
                messageId: parseInt(mention.messageId, 10),
                mentionedUserId: user.userId,
                mentionerUsername: mention.mentionerUsername,
                message: mention.message,
                timestamp: mention.timestamp,
                sessionId: 'global-chat',
              });
            }
          }
        },
        (users: ConnectedGlobalChatUser[]) => {
          setConnectedGlobalChatUsers(users);
        },
        ({
          userId: typingId,
          username,
        }: {
          userId: string;
          username: string;
        }) => {
          setGlobalTypingUsers((prev) => new Map(prev).set(typingId, username));
          const prev = globalTypingTimeouts.current.get(typingId);
          if (prev) clearTimeout(prev);
          globalTypingTimeouts.current.set(
            typingId,
            setTimeout(() => {
              setGlobalTypingUsers((m) => {
                const next = new Map(m);
                next.delete(typingId);
                return next;
              });
              globalTypingTimeouts.current.delete(typingId);
            }, 3000)
          );
        },
        'pfatc'
      );
    }

    return () => {
      if (globalSocketRef.current) {
        globalSocketRef.current.socket.disconnect();
        globalSocketRef.current = null;
      }
    };
  }, [user, station, position, isPFATC]);

  // AATC disabled — AATC global chat socket commented out
  // useEffect(() => {
  //   if (!user || !isAdvancedATC) return;
  //   if (!aatcSocketRef.current) {
  //     aatcSocketRef.current = createGlobalChatSocket(
  /* AATC_SOCKET_PLACEHOLDER_START
  useEffect(() => {
    if (!user || !isAdvancedATC) return;

    if (!aatcSocketRef.current) {
      aatcSocketRef.current = createGlobalChatSocket(
        user.userId,
        station || null,
        position || null,
        (msg: GlobalChatMessage) => {
          setAatcMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
        (data: { messageId: number }) => {
          setAatcMessages((prev) =>
            prev.filter((m) => m.id !== data.messageId)
          );
        },
        (data: { messageId: number; error: string }) => {
          if (aatcPendingDeleteRef.current?.id === data.messageId) {
            setAatcMessages((prev) =>
              [...prev, aatcPendingDeleteRef.current!].sort(
                (a, b) =>
                  new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
              )
            );
            aatcPendingDeleteRef.current = null;
          }
        },
        undefined,
        (data: { messageId: number; reason: string }) => {
          setAutomoddedMessages((prev) => {
            const newMap = new Map(prev);
            newMap.set(data.messageId, data.reason);
            return newMap;
          });
        },
        (mention) => {
          if (!open || activeTab !== 'aatc') {
            if (
              user &&
              mention.mentionedUserId === user.userId &&
              onMentionReceivedRef.current
            ) {
              onMentionReceivedRef.current({
                messageId: parseInt(mention.messageId, 10),
                mentionedUserId: mention.mentionedUserId,
                mentionerUsername: mention.mentionerUsername,
                message: mention.message,
                timestamp: mention.timestamp,
                sessionId: 'aatc-chat',
              });
            }
          }
        },
        (mention) => {
          if (!open || activeTab !== 'aatc') {
            if (
              mention.airport &&
              station &&
              mention.airport.toUpperCase() === station.toUpperCase() &&
              onMentionReceivedRef.current
            ) {
              onMentionReceivedRef.current({
                messageId: parseInt(mention.messageId, 10),
                mentionedUserId: user.userId,
                mentionerUsername: mention.mentionerUsername,
                message: mention.message,
                timestamp: mention.timestamp,
                sessionId: 'aatc-chat',
              });
            }
          }
        },
        (users: ConnectedGlobalChatUser[]) => {
          setAatcConnectedUsers(users);
        },
        ({
          userId: typingId,
          username,
        }: {
          userId: string;
          username: string;
        }) => {
          setAatcTypingUsers((prev) => new Map(prev).set(typingId, username));
          const prev = aatcTypingTimeouts.current.get(typingId);
          if (prev) clearTimeout(prev);
          aatcTypingTimeouts.current.set(
            typingId,
            setTimeout(() => {
              setAatcTypingUsers((m) => {
                const next = new Map(m);
                next.delete(typingId);
                return next;
              });
              aatcTypingTimeouts.current.delete(typingId);
            }, 3000)
          );
        },
        'aatc'
      );
    }

    return () => {
      if (aatcSocketRef.current) {
        aatcSocketRef.current.socket.disconnect();
        aatcSocketRef.current = null;
      }
    };
  }, [user, station, position, isAdvancedATC]);
  AATC_SOCKET_PLACEHOLDER_END */

  useEffect(() => {
    if (globalSocketRef.current) {
      if (open && activeTab === 'pfatc') {
        globalSocketRef.current.socket.emit('globalChatOpened');
      } else {
        globalSocketRef.current.socket.emit('globalChatClosed');
      }
    }
    // AATC disabled — aatcSocketRef open/close removed
    // if (aatcSocketRef.current) {
    //   if (open && activeTab === 'aatc') {
    //     aatcSocketRef.current.socket.emit('globalChatOpened');
    //   } else {
    //     aatcSocketRef.current.socket.emit('globalChatClosed');
    //   }
    // }
  }, [open, activeTab]);

  useEffect(() => {
    if (!open) return;
    if (activeTab === 'pfatc' && globalMessages.length === 0) {
      setGlobalLoading(true);
      fetchGlobalChatMessages()
        .then((msgs) => {
          setGlobalMessages(msgs);
          setGlobalLoading(false);
        })
        .catch(() => {
          setGlobalMessages([]);
          setGlobalLoading(false);
        });
    }
    // AATC disabled — AATC message fetch removed
    // if (activeTab === 'aatc' && aatcMessages.length === 0) {
    //   setAatcLoading(true);
    //   fetchAATCChatMessages()
    //     .then((msgs) => { setAatcMessages(msgs); setAatcLoading(false); })
    //     .catch(() => { setAatcMessages([]); setAatcLoading(false); });
    // }
  }, [open, activeTab, globalMessages.length]);

  const isGlobalChat = activeTab === 'pfatc'; // AATC disabled — was: || activeTab === 'aatc'
  const textMessages: ChatListMessage[] =
    // AATC disabled — was: activeTab === 'aatc' ? aatcMessages :
    isGlobalChat ? globalMessages : messages;
  const textLoading =
    // AATC disabled — was: activeTab === 'aatc' ? aatcLoading :
    isGlobalChat ? globalLoading : loading;
  const showTextChat =
    (sessionId && activeTab === 'session') ||
    (isPFATC && activeTab === 'pfatc');
  // AATC disabled — was: || (isAdvancedATC && activeTab === 'aatc')

  useEffect(() => {
    if (chatEndRef.current && isAtBottomRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [textMessages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    isAtBottomRef.current = isAtBottom(element);
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    const cursorPos = textareaRef.current?.selectionStart || 0;
    const result = handleMentionSuggestions(
      value,
      cursorPos,
      sessionUsers,
      user?.userId
    );

    setMentionSuggestions(result.suggestions);
    setShowMentionSuggestions(result.shouldShow);
    setSelectedSuggestionIndex(result.shouldShow ? 0 : -1);

    if (value && socketRef.current && user) {
      const now = Date.now();
      if (now - lastSessionTypingEmit.current > 2000) {
        lastSessionTypingEmit.current = now;
        socketRef.current.sendTyping(user.username);
      }
    }
  };

  const insertMention = (username: string) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const result = insertMentionIntoText(input, cursorPos, username);

    setInput(result.newText);
    setShowMentionSuggestions(false);
    setSelectedSuggestionIndex(-1);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          result.newCursorPos,
          result.newCursorPos
        );
      }
    }, 0);
  };

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current || input.trim().length > 500)
      return;
    socketRef.current.socket.emit('chatMessage', {
      sessionId,
      user,
      message: input.trim(),
    });
    setInput('');
    lastSessionTypingEmit.current = 0;
  };

  const sendGlobalMessage = () => {
    // AATC disabled — isAatcTab always false
    const socketToUse = globalSocketRef.current;
    const inputValue = globalInput;
    if (!inputValue.trim() || !socketToUse || inputValue.trim().length > 500)
      return;
    socketToUse.socket.emit('globalChatMessage', {
      user,
      message: inputValue.trim(),
    });
    setGlobalInput('');
    lastGlobalTypingEmit.current = 0;
  };

  async function handleDelete(msgId: number) {
    if (!socketRef.current || !user) return;

    const messageToDelete = messages.find((m) => m.id === msgId);
    if (!messageToDelete) return;

    pendingDeleteRef.current = messageToDelete;
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    socketRef.current.deleteMessage(msgId, user.userId);
  }

  async function handleGlobalDelete(msgId: number) {
    // AATC disabled — isAatcTab always false
    const socketToUse = globalSocketRef.current;
    if (!socketToUse || !user) return;

    const messageToDelete = globalMessages.find((m) => m.id === msgId);
    if (!messageToDelete) return;
    globalPendingDeleteRef.current = messageToDelete;
    setGlobalMessages((prev) => prev.filter((m) => m.id !== msgId));
    socketToUse.deleteMessage(msgId, user.userId);
  }

  const handleGlobalInputChange = (value: string) => {
    // AATC disabled — isAatcTab always false
    setGlobalInput(value);

    const cursorPos = globalTextareaRef.current?.selectionStart || 0;
    const result = handleGlobalMentionSuggestions(
      value,
      cursorPos,
      airports,
      globalMessages,
      connectedGlobalChatUsers,
      sessionUsers,
      user?.userId
    );

    setGlobalSuggestions(result.suggestions);
    setShowGlobalSuggestions(result.shouldShow);
    setSelectedGlobalSuggestionIndex(result.shouldShow ? 0 : -1);

    const socketToUse = globalSocketRef.current;
    if (value && socketToUse && user) {
      const now = Date.now();
      if (now - lastGlobalTypingEmit.current > 2000) {
        lastGlobalTypingEmit.current = now;
        socketToUse.sendTyping(user.username);
      }
    }
  };

  const insertGlobalMention = (value: string) => {
    // AATC disabled — isAatcTab always false
    const cursorPos = globalTextareaRef.current?.selectionStart || 0;
    const result = insertMentionIntoText(globalInput, cursorPos, value);

    setGlobalInput(result.newText);
    setShowGlobalSuggestions(false);
    setSelectedGlobalSuggestionIndex(-1);

    setTimeout(() => {
      if (globalTextareaRef.current) {
        globalTextareaRef.current.focus();
        globalTextareaRef.current.setSelectionRange(
          result.newCursorPos,
          result.newCursorPos
        );
      }
    }, 0);
  };

  const handleComposerKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      activeTab === 'pfatc' /* AATC disabled — was: || activeTab === 'aatc' */
    ) {
      const hasSuggestions =
        showGlobalSuggestions && globalSuggestions.length > 0;

      if (hasSuggestions) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedGlobalSuggestionIndex(
            (prev) => (prev + 1) % globalSuggestions.length
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedGlobalSuggestionIndex(
            (prev) =>
              (prev - 1 + globalSuggestions.length) % globalSuggestions.length
          );
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (
            selectedGlobalSuggestionIndex >= 0 &&
            selectedGlobalSuggestionIndex < globalSuggestions.length
          ) {
            const suggestion = globalSuggestions[selectedGlobalSuggestionIndex];
            if (suggestion.type === 'airport') {
              const airport = suggestion.data as {
                icao: string;
                name: string;
              };
              insertGlobalMention(airport.icao.toLowerCase());
            } else {
              const u = suggestion.data as SessionUser;
              insertGlobalMention(u.username);
            }
          }
        } else if (e.key === 'Escape') {
          setShowGlobalSuggestions(false);
          setSelectedGlobalSuggestionIndex(-1);
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendGlobalMessage();
      }
      return;
    }

    if (activeTab === 'session') {
      if (showMentionSuggestions) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedSuggestionIndex(
            (prev) => (prev + 1) % mentionSuggestions.length
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev === 0 ? mentionSuggestions.length - 1 : prev - 1
          );
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            insertMention(mentionSuggestions[selectedSuggestionIndex].username);
          }
        } else if (e.key === 'Escape') {
          setShowMentionSuggestions(false);
          setSelectedSuggestionIndex(-1);
        }
      } else {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        } else if (e.key === 'Escape') {
          setShowMentionSuggestions(false);
        }
      }
    }
  };

  async function handleReport(msgId: number) {
    setReportingMessageId(msgId);
    setShowReportModal(true);
  }

  async function handleGlobalReport(msgId: number) {
    setReportingMessageId(msgId);
    setReportingGlobalMessage(true);
    setShowReportModal(true);
  }

  async function handleSubmitReport() {
    if (!reportingMessageId || !reportReason.trim()) return;

    try {
      if (reportingGlobalMessage) {
        // AATC disabled — was: if (activeTab === 'aatc') { await reportAATCChatMessage(...) } else { ... }
        await reportGlobalChatMessage(reportingMessageId, reportReason.trim());
      } else {
        await reportChatMessage(
          sessionId,
          reportingMessageId,
          reportReason.trim()
        );
      }
      setToast({ message: 'Message reported successfully.', type: 'success' });
      setShowReportModal(false);
      setReportReason('');
      setReportingMessageId(null);
      setReportingGlobalMessage(false);
    } catch {
      setToast({ message: 'Failed to report message.', type: 'error' });
    }
  }

  useEffect(() => {
    if (open) {
      if (activeTab === 'session') {
        setUnreadSessionMentions([]);
      } else if (
        activeTab === 'pfatc' /* AATC disabled — was: || activeTab === 'aatc' */
      ) {
        setUnreadGlobalMentions([]);
      }
    }
  }, [activeTab, open]);

  useEffect(() => {
    if (!sessionId || !accessId || !user) return;

    voiceSocketRef.current = createVoiceChatSocket(
      sessionId,
      accessId,
      user.userId,
      (users) => {
        setVoiceUsers(users);
      },
      (state) => setConnectionState(state),
      // onUserStartedTalking
      (talkingUserId: string) => {
        setTalkingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.add(talkingUserId);
          return newSet;
        });
      },
      // onUserStoppedTalking
      (talkingUserId: string) => {
        setTalkingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(talkingUserId);
          return newSet;
        });
      },
      // onAudioLevelUpdate — 3rd arg is isTalking (derived in socket)
      (levelUserId: string, level: number, isTalking: boolean) => {
        setAudioLevels((prev) => new Map(prev).set(levelUserId, level));
        setTalkingUsers((prev) => {
          const newSet = new Set(prev);
          if (isTalking) newSet.add(levelUserId);
          else newSet.delete(levelUserId);
          return newSet;
        });
      },
      () => userVolumesRef.current,
      (devices: MediaDeviceInfo[]) => setVoiceDevices(devices)
    );

    if (voiceSocketRef.current) {
      voiceSocketRef.current.socket.emit('get-voice-users');
      voiceSocketRef.current.socket.on(
        'user-left-voice',
        ({ userId: leftId }: { userId: string }) => {
          setVoiceUsers((prev) => prev.filter((u) => u.userId !== leftId));
        }
      );
    }

    return () => {
      if (voiceSocketRef.current) {
        voiceSocketRef.current.cleanup();
        voiceSocketRef.current = null;
      }
      setVoiceUsers([]);
      setVoiceDevices([]);
      setTalkingUsers(new Set());
      setConnectionState({ connected: false, connecting: false, error: null });
      setIsInVoice(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, accessId, user]);

  useEffect(() => {
    if (open && voiceSocketRef.current) {
      voiceSocketRef.current.socket.emit('get-voice-users');
    }
  }, [open]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'userVolumes',
        JSON.stringify(Array.from(userVolumes.entries()))
      );
    } catch (error) {
      console.warn('Failed to save user volumes to localStorage:', error);
    }
  }, [userVolumes]);

  type SidebarTabId = 'session' | 'voice' | 'pfatc'; // AATC disabled — was: | 'aatc'

  const sidebarTabs = useMemo(() => {
    const items: SidebarTabId[] = [];
    if (sessionId) {
      items.push('session', 'voice');
    }
    if (isPFATC) items.push('pfatc');
    // AATC disabled — if (isAdvancedATC) items.push('aatc');
    return items;
  }, [sessionId, isPFATC]);

  const activeTabIndex = Math.max(
    0,
    sidebarTabs.indexOf(activeTab as SidebarTabId)
  );
  const tabCount = sidebarTabs.length;

  return (
    <div
      className={`fixed top-0 right-0 h-full w-100 bg-zinc-900 text-white transition-transform duration-300 ${
        open ? 'translate-x-[] shadow-2xl shadow-black/90' : 'translate-x-full'
      } rounded-l-3xl border-l-2 border-blue-800 flex flex-col`}
      style={{ zIndex: 10000 }}
    >
      <div className="flex justify-between items-center p-5 border-b border-blue-800 rounded-tl-3xl">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-xl text-blue-300">
            {
              activeTab === 'session'
                ? 'Session Chat'
                : activeTab === 'voice'
                  ? 'Voice Chat'
                  : 'PFATC Chat' /* AATC disabled — was: activeTab === 'aatc' ? 'AATC Chat' : 'PFATC Chat' */
            }
          </span>
        </div>
        <button
          onClick={() => onClose()}
          className="p-1 rounded-full hover:bg-gray-700"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {(isPFATC || /* isAdvancedATC || */ sessionId) &&
        tabCount > 0 /* AATC disabled */ && (
          <div className="border-b border-blue-800 bg-zinc-900 px-4 pb-3 pt-2">
            <div className="relative flex rounded-full bg-zinc-800/95 p-1 shadow-inner ring-1 ring-zinc-700/60">
              <div
                className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-linear-to-b from-blue-500 to-blue-700 shadow-md transition-[left,width] duration-300 ease-out"
                style={{
                  width:
                    tabCount > 0
                      ? `calc((100% - 0.5rem) / ${tabCount})`
                      : undefined,
                  left:
                    tabCount > 0
                      ? `calc(0.25rem + ${activeTabIndex} * ((100% - 0.5rem) / ${tabCount}))`
                      : undefined,
                }}
                aria-hidden
              />
              {sidebarTabs.map((tabId) => {
                const isActive = activeTab === tabId;
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setActiveTab(tabId)}
                    className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-semibold transition-colors sm:gap-2 sm:px-3 ${
                      isActive
                        ? 'text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tabId === 'session' && (
                      <>
                        <MessageCircle className="h-4 w-4 shrink-0" />
                        <span>Session</span>
                        {unreadSessionCount > 0 && activeTab !== 'session' && (
                          <span className="absolute right-1 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white sm:right-1.5">
                            {unreadSessionCount}
                          </span>
                        )}
                      </>
                    )}
                    {tabId === 'voice' && (
                      <>
                        <Phone className="h-4 w-4 shrink-0" />
                        <span>Voice</span>
                        <span
                          className={`flex h-5 min-w-5 items-center justify-center rounded-full pl-px text-xs text-white ${
                            isInVoice
                              ? 'border border-green-500'
                              : 'bg-zinc-700/90'
                          }`}
                        >
                          {voiceUsers.length}
                        </span>
                      </>
                    )}
                    {tabId === 'pfatc' && (
                      <>
                        <Radio className="h-4 w-4 shrink-0" />
                        <span>PFATC</span>
                        {unreadGlobalCount > 0 && activeTab !== 'pfatc' && (
                          <span className="absolute right-1 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white sm:right-1.5">
                            {unreadGlobalCount}
                          </span>
                        )}
                      </>
                    )}
                    {/* AATC disabled — AATC tab button removed
                  {tabId === 'aatc' && (
                    <>
                      <Radio className="h-4 w-4 shrink-0" />
                      <span>AATC</span>
                      {unreadGlobalCount > 0 && activeTab !== 'aatc' && (
                        <span className="absolute right-1 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white sm:right-1.5">
                          {unreadGlobalCount}
                        </span>
                      )}
                    </>
                  )}
                  */}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {activeTab !== 'voice' && (
        <div className="px-5 py-2 border-b border-blue-800 bg-zinc-900">
          <div className="flex flex-wrap gap-1">
            <>
              {activeTab === 'session' ? (
                sessionUsers.map((sessionUser) => (
                  <img
                    key={sessionUser.id}
                    src={
                      sessionUser.avatar || '/assets/app/default/avatar.webp'
                    }
                    alt={sessionUser.username}
                    className={`w-8 h-8 rounded-full border-2 ${
                      isUserInActiveChat(sessionUser.id, activeChatUsers)
                        ? 'border-green-500'
                        : 'border-gray-500'
                    }`}
                    title={sessionUser.username}
                  />
                ))
              ) : (
                <div className="flex flex-wrap gap-1">
                  {
                    /* AATC disabled — was: activeTab === 'aatc' ? aatcConnectedUsers : */ connectedGlobalChatUsers.map(
                      (globalUser) => (
                        <img
                          key={globalUser.id}
                          src={
                            globalUser.avatar ||
                            '/assets/app/default/avatar.webp'
                          }
                          alt={globalUser.username}
                          className="w-8 h-8 rounded-full border-2 border-blue-500 shadow-sm"
                          title={`${globalUser.username} - ${globalUser.station || 'No Station'}`}
                          onError={(e) => {
                            e.currentTarget.src =
                              '/assets/app/default/avatar.webp';
                          }}
                        />
                      )
                    )
                  }
                  {
                    /* AATC disabled — was: activeTab === 'aatc' ? aatcConnectedUsers : */ connectedGlobalChatUsers.length ===
                      0 && (
                      <div className="text-xs text-zinc-400">
                        No controllers online
                      </div>
                    )
                  }
                </div>
              )}
            </>
          </div>
        </div>
      )}

      {/* Session / PFATC text chat */}
      {showTextChat && (
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div
            className={`flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-36 ${
              isGlobalChat ? 'space-y-2' : 'space-y-4'
            }`}
            onScroll={handleScroll}
          >
            {textLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader />
              </div>
            ) : !isGlobalChat && errorMessage ? (
              <div className="flex justify-center items-center h-full text-red-400">
                {errorMessage}
              </div>
            ) : textMessages.length === 0 ? (
              <div className="flex justify-center items-center h-full text-gray-400">
                No messages yet. Start the conversation!
              </div>
            ) : (
              textMessages.map((msg, index) => {
                const prevMsg = index > 0 ? textMessages[index - 1] : null;
                return (
                  <ChatMessageRow
                    key={msg.id}
                    msg={msg}
                    prevMsg={prevMsg}
                    isGlobal={isGlobalChat}
                    userId={user?.userId}
                    username={user?.username}
                    station={station}
                    hoveredId={hoveredMessage}
                    onHover={setHoveredMessage}
                    onReport={isGlobalChat ? handleGlobalReport : handleReport}
                    onDelete={isGlobalChat ? handleGlobalDelete : handleDelete}
                    automodReason={automoddedMessages.get(msg.id)}
                  />
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <ChatTextComposer
            isGlobalChat={isGlobalChat}
            textareaRef={isGlobalChat ? globalTextareaRef : textareaRef}
            value={
              // AATC disabled — was: activeTab === 'aatc' ? aatcInput :
              isGlobalChat ? globalInput : input
            }
            onChange={
              isGlobalChat ? handleGlobalInputChange : handleInputChange
            }
            onKeyDown={handleComposerKeyDown}
            onSend={isGlobalChat ? sendGlobalMessage : sendMessage}
            sendDisabled={
              isGlobalChat
                ? !globalInput.trim() // AATC disabled — was: !(activeTab === 'aatc' ? aatcInput : globalInput).trim()
                : !input.trim()
            }
            placeholder={
              isGlobalChat
                ? 'Type a message... Use @ICAO or @username for mentions'
                : 'Type a message... Use @ to mention users'
            }
            ariaLabel={
              isGlobalChat ? 'Type a global message' : 'Type a message'
            }
            showMentionSuggestions={showMentionSuggestions}
            mentionSuggestions={mentionSuggestions}
            selectedSuggestionIndex={selectedSuggestionIndex}
            activeChatUsers={activeChatUsers}
            insertMention={insertMention}
            showGlobalSuggestions={showGlobalSuggestions}
            globalSuggestions={globalSuggestions}
            selectedGlobalSuggestionIndex={selectedGlobalSuggestionIndex}
            insertGlobalMention={insertGlobalMention}
            typingUsers={
              // AATC disabled — was: activeTab === 'aatc' ? aatcTypingUsers :
              isGlobalChat ? globalTypingUsers : sessionTypingUsers
            }
          />
        </div>
      )}

      {/* Voice Chat Content */}
      {sessionId && activeTab === 'voice' && (
        <div className="flex-1 flex flex-col min-h-0">
          <VoiceChat
            open={open}
            activeTab={activeTab}
            voiceUsers={voiceUsers}
            isInVoice={isInVoice}
            setIsInVoice={setIsInVoice}
            voiceSocket={voiceSocketRef.current}
            userVolumes={userVolumes}
            setUserVolumes={setUserVolumes}
            talkingUsers={talkingUsers}
            audioLevels={audioLevels}
            externalDevices={voiceDevices}
          />
          <div className="shrink-0 relative mx-5 mb-5 mt-0 rounded-bl-3xl pt-8">
            <div
              className="pointer-events-none absolute inset-0 rounded-bl-3xl bg-linear-to-t from-zinc-900 to-transparent"
              aria-hidden
            />
            <div className="relative z-10 flex justify-center gap-2 w-full px-0 pb-0 pt-1">
              {getConnectionIcon()}
              <span className="text-xs text-zinc-400">
                {connectionState.connected
                  ? `${voiceUsers.length} in voice chat`
                  : connectionState.connecting
                    ? 'Connecting...'
                    : 'Voice chat offline'}
              </span>
              {connectionState.error && (
                <span className="text-xs text-red-400 truncate">
                  {connectionState.error}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Report Message"
        variant="danger"
        icon={<Flag />}
        footer={
          <Button onClick={handleSubmitReport} variant="danger">
            Report
          </Button>
        }
      >
        <textarea
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          placeholder="Enter reason for reporting..."
          className="w-full p-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-800"
          maxLength={200}
          rows={4}
        />
      </Modal>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <style>{`
        .volume-slider::-webkit-slider-thumb {
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #3b82f6;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          position: relative;
          z-index: 10;
        }
        .volume-slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #3b82f6;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          position: relative;
          z-index: 10;
        }
        .volume-slider {
          background: transparent;
          position: relative;
          z-index: 5;
        }
      `}</style>
    </div>
  );
}
