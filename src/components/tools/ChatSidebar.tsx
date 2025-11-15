import { useEffect, useRef, useState } from 'react';
import {
  fetchChatMessages,
  reportChatMessage,
  fetchGlobalChatMessages,
  reportGlobalChatMessage,
} from '../../utils/fetch/chats';
import {
  formatStationDisplay,
  renderMessage,
  isUserInActiveChat,
  handleMentionSuggestions,
  handleGlobalMentionSuggestions,
  insertMentionIntoText,
  shouldShowMessageHeader,
  isMessageMentioned,
  getMessageTimeString,
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
  Send,
  Trash,
  X,
  Flag,
  MessageCircle,
  Radio,
  MapPin,
} from 'lucide-react';
import type { ChatMessage, ChatMention } from '../../types/chats';
import type { SessionUser } from '../../types/session';
import type { ToastType } from '../common/Toast';
import Button from '../common/Button';
import Loader from '../common/Loader';
import Modal from '../common/Modal';
import Toast from '../common/Toast';

interface ChatSidebarProps {
  sessionId: string;
  accessId: string;
  open: boolean;
  onClose: () => void;
  sessionUsers: SessionUser[];
  onMentionReceived?: (mention: ChatMention) => void;
  station?: string;
  position?: string;
  isPFATC?: boolean;
  unreadSessionCount?: number;
  unreadGlobalCount?: number;
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
  unreadSessionCount = 0,
  unreadGlobalCount = 0,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingDeleteRef = useRef<ChatMessage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);

  const [activeTab, setActiveTab] = useState<'session' | 'pfatc'>(
    sessionId ? 'session' : 'pfatc'
  );
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
  const globalMessagesEndRef = useRef<HTMLDivElement>(null);
  const globalPendingDeleteRef = useRef<GlobalChatMessage | null>(null);
  const globalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const onMentionReceivedRef = useRef(onMentionReceived);

  const [unreadSessionMentions, setUnreadSessionMentions] = useState<
    ChatMention[]
  >([]);
  const [unreadGlobalMentions, setUnreadGlobalMentions] = useState<
    ChatMention[]
  >([]);
  const [chatOpen, setChatOpen] = useState(false);

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
  }, [sessionId, accessId, user, open, activeTab]);

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

  useEffect(() => {
    if (!user || !isPFATC) return;

    if (!globalSocketRef.current) {
      globalSocketRef.current = createGlobalChatSocket(
        user.userId,
        station || null,
        position || null,
        (msg: GlobalChatMessage) => {
          setGlobalMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) {
              return prev;
            }
            return [...prev, msg];
          });
        },
        (data: { messageId: number }) => {
          setGlobalMessages((prev) =>
            prev.filter((m) => m.id !== data.messageId)
          );
        },
        (data: { messageId: number; error: string }) => {
          if (
            globalPendingDeleteRef.current &&
            globalPendingDeleteRef.current.id === data.messageId
          ) {
            setGlobalMessages((prev) => {
              const newMessages = [...prev, globalPendingDeleteRef.current!];
              return newMessages.sort(
                (a, b) =>
                  new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
              );
            });
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
        }
      );

      if (open && activeTab === 'pfatc') {
        globalSocketRef.current.socket.emit('globalChatOpened');
      }
    }

    return () => {
      if (globalSocketRef.current) {
        globalSocketRef.current.socket.disconnect();
        globalSocketRef.current = null;
      }
    };
  }, [user?.userId, station, position, isPFATC, open, activeTab]);

  useEffect(() => {
    if (!globalSocketRef.current) return;

    if (open && activeTab === 'pfatc') {
      globalSocketRef.current.socket.emit('globalChatOpened');
    } else {
      globalSocketRef.current.socket.emit('globalChatClosed');
    }
  }, [open, activeTab]);

  useEffect(() => {
    if (!open || activeTab !== 'pfatc' || globalMessages.length > 0) return;

    setGlobalLoading(true);
    fetchGlobalChatMessages()
      .then((fetchedMessages) => {
        setGlobalMessages(fetchedMessages);
        setGlobalLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch global chat messages:', error);
        setGlobalMessages([]);
        setGlobalLoading(false);
      });
  }, [open, activeTab]);

  useEffect(() => {
    if (messagesEndRef.current && isAtBottomRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
  };

  const sendGlobalMessage = () => {
    if (
      !globalInput.trim() ||
      !globalSocketRef.current ||
      globalInput.trim().length > 500
    )
      return;
    globalSocketRef.current.socket.emit('globalChatMessage', {
      user,
      message: globalInput.trim(),
    });
    setGlobalInput('');
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
    if (!globalSocketRef.current || !user) return;

    const messageToDelete = globalMessages.find((m) => m.id === msgId);
    if (!messageToDelete) return;

    globalPendingDeleteRef.current = messageToDelete;
    setGlobalMessages((prev) => prev.filter((m) => m.id !== msgId));
    globalSocketRef.current.deleteMessage(msgId, user.userId);
  }

  const handleGlobalInputChange = (value: string) => {
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
  };

  const insertGlobalMention = (value: string) => {
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
    if (chatOpen) {
      if (activeTab === 'session') {
        setUnreadSessionMentions([]);
      } else if (activeTab === 'pfatc') {
        setUnreadGlobalMentions([]);
      }
      const totalUnread = [
        ...unreadSessionMentions,
        ...unreadGlobalMentions,
      ].filter((mention) => {
        if (activeTab === 'session') {
          return mention.sessionId !== 'global-chat';
        } else {
          return mention.sessionId === 'global-chat';
        }
      });
      setUnreadGlobalMentions(totalUnread);
    }
  }, [chatOpen, activeTab]);

  useEffect(() => {
    if (open) {
      if (activeTab === 'session') {
        setUnreadSessionMentions([]);
      } else if (activeTab === 'pfatc') {
        setUnreadGlobalMentions([]);
      }
    }
  }, [activeTab, open]);

  return (
    // Z-Index: 10000 - Always-on-top sidebars (see Z_INDEX_GUIDE.md)
    <div
      className={`fixed top-0 right-0 h-full w-100 bg-zinc-900 text-white transition-transform duration-300 ${
        open ? 'translate-x-[] shadow-2xl shadow-black/90' : 'translate-x-full'
      } rounded-l-3xl border-l-2 border-blue-800 flex flex-col`}
      style={{ zIndex: 10000 }}
    >
      <div className="flex justify-between items-center p-5 border-b border-blue-800 rounded-tl-3xl">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-xl text-blue-300">
            {isPFATC && sessionId
              ? activeTab === 'session'
                ? 'Session Chat'
                : 'PFATC Chat'
              : sessionId
                ? 'Session Chat'
                : 'PFATC Chat'}
          </span>
        </div>
        <button
          onClick={() => onClose()}
          className="p-1 rounded-full hover:bg-gray-700"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {isPFATC && sessionId && (
        <div className="border-b border-blue-800 bg-zinc-900">
          <div className="flex">
            <button
              onClick={() => setActiveTab('session')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 font-semibold transition-colors relative ${
                activeTab === 'session'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Session</span>
              {unreadSessionCount > 0 && activeTab !== 'session' && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadSessionCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('pfatc')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 font-semibold transition-colors relative ${
                activeTab === 'pfatc'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>PFATC</span>
              {unreadGlobalCount > 0 && activeTab !== 'pfatc' && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadGlobalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="px-5 py-2 border-b border-blue-800 bg-zinc-900">
        <div className="flex flex-wrap gap-1">
          {(isPFATC ? activeTab === 'session' : true) ? (
            sessionUsers.map((sessionUser) => (
              <img
                key={sessionUser.id}
                src={sessionUser.avatar || '/assets/app/default/avatar.webp'}
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
              {connectedGlobalChatUsers.map((globalUser) => (
                <img
                  key={globalUser.id}
                  src={globalUser.avatar || '/assets/app/default/avatar.webp'}
                  alt={globalUser.username}
                  className="w-8 h-8 rounded-full border-2 border-blue-500 shadow-sm"
                  title={`${globalUser.username} - ${globalUser.station || 'No Station'}`}
                  onError={(e) => {
                    e.currentTarget.src = '/assets/app/default/avatar.webp';
                  }}
                />
              ))}
              {connectedGlobalChatUsers.length === 0 && (
                <div className="text-xs text-zinc-400">
                  No controllers online
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {sessionId && (isPFATC ? activeTab === 'session' : true) && (
        <div
          className={`flex-1 ${messages.length > 0 ? 'overflow-y-auto' : ''} px-5 py-4 space-y-4`}
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader />
            </div>
          ) : errorMessage ? (
            <div className="flex justify-center items-center h-full text-red-400">
              {errorMessage}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-400">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const showHeader = shouldShowMessageHeader(msg, prevMsg);
              const isOwn = String(msg.userId) === String(user?.userId);
              const isMentioned = isMessageMentioned(msg, user?.userId);

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-1 relative ${
                    isOwn ? 'justify-end' : 'gap-3'
                  } ${isMentioned ? 'bg-blue-900/20 rounded-lg p-1 my-1' : 'gap-3'}`}
                  onMouseEnter={() => setHoveredMessage(msg.id)}
                  onMouseLeave={() => setHoveredMessage(null)}
                >
                  {showHeader && !isOwn && (
                    <img
                      src={msg.avatar || '/assets/app/default/avatar.webp'}
                      alt={msg.username}
                      className="w-9 h-9 rounded-full border-2 border-blue-700 shadow"
                    />
                  )}
                  {!showHeader && !isOwn && <div className="w-9 h-9" />}
                  <div
                    className={`${isOwn ? 'text-right' : ''} relative group`}
                  >
                    {showHeader && (
                      <div className="text-xs text-gray-400 mb-1">
                        <span className="font-semibold text-blue-300">
                          {msg.username}
                        </span>
                        {' • '}
                        {getMessageTimeString(msg.sent_at)}
                      </div>
                    )}
                    <div
                      className={`rounded-l-2xl rounded-tr-2xl px-3 py-2 text-sm shadow relative ${
                        isOwn
                          ? 'bg-blue-800 text-white ml-auto max-w-[19rem]'
                          : 'bg-zinc-800 text-white max-w-[19rem]'
                      } break-words overflow-wrap-anywhere`}
                      style={
                        isOwn
                          ? {
                              borderTopRightRadius: '1rem',
                              borderBottomRightRadius: '0rem',
                            }
                          : {
                              borderTopLeftRadius: '1rem',
                              borderBottomLeftRadius: '0rem',
                              borderBottomRightRadius: '1rem',
                            }
                      }
                    >
                      <div
                        className="break-words whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: renderMessage(msg.message),
                        }}
                      />

                      {hoveredMessage === msg.id && (
                        <div className="absolute -top-2 -right-2 flex space-x-1">
                          {!isOwn && (
                            <button
                              className="bg-zinc-700 hover:bg-yellow-600 text-gray-300 hover:text-white rounded-full p-1.5 shadow-lg transition-colors duration-200"
                              onClick={() => handleReport(msg.id)}
                              title="Report message"
                            >
                              <Flag className="h-3 w-3" />
                            </button>
                          )}
                          {isOwn && (
                            <button
                              className="bg-zinc-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-full p-1.5 shadow-lg transition-colors duration-200"
                              onClick={() => handleDelete(msg.id)}
                              title="Delete message"
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {isOwn && automoddedMessages.has(msg.id) && (
                      <div className="relative group inline-block ml-2">
                        <img
                          src="/assets/images/automod.webp"
                          alt="Flagged by automod"
                          className="w-4 h-4 cursor-help rounded-full shadow-lg"
                        />
                        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-[9999] whitespace-nowrap">
                          <div className="relative p-[1px] rounded-lg bg-gradient-to-r from-red-600 to-orange-600">
                            <div className="px-3 py-1.5 bg-zinc-900/95 backdrop-blur-md rounded-lg">
                              <div className="text-xs text-white">
                                Automod flagged this for{' '}
                                <span className="text-yellow-300 font-semibold">
                                  {automoddedMessages.get(msg.id)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {!showHeader && isOwn && <div className="w-9 h-9" />}
                  {showHeader && isOwn && (
                    <img
                      src={msg.avatar || '/assets/app/default/avatar.webp'}
                      alt={msg.username}
                      className="w-9 h-9 rounded-full border-2 border-blue-700 shadow"
                    />
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {isPFATC && activeTab === 'pfatc' && (
        <div
          className={`flex-1 ${globalMessages.length > 0 ? 'overflow-y-auto' : ''} px-5 py-4 space-y-2`}
        >
          {globalLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader />
            </div>
          ) : globalMessages.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-400">
              No messages yet. Start the conversation!
            </div>
          ) : (
            globalMessages.map((msg, index) => {
              const prevMsg = index > 0 ? globalMessages[index - 1] : null;
              const showHeader = shouldShowMessageHeader(msg, prevMsg);
              const isOwn = String(msg.userId) === String(user?.userId);
              const isMentioned = isMessageMentioned(
                msg,
                user?.username,
                station
              );

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 relative ${
                    isOwn ? 'justify-end' : ''
                  } ${isMentioned ? 'bg-blue-900/20 rounded-lg p-1 my-1' : 'gap-3'}`}
                  onMouseEnter={() => setHoveredMessage(msg.id)}
                  onMouseLeave={() => setHoveredMessage(null)}
                >
                  {showHeader && !isOwn && (
                    <img
                      src={msg.avatar || '/assets/app/default/avatar.webp'}
                      alt={msg.username || 'User'}
                      className="w-9 h-9 rounded-full border-2 border-blue-700 shadow"
                    />
                  )}
                  {!showHeader && !isOwn && <div className="w-9 h-9" />}
                  <div className={`${isOwn ? 'text-right' : ''}`}>
                    {showHeader && (
                      <div className="text-xs text-gray-400 mb-1">
                        <span className="font-semibold text-blue-300">
                          {msg.username || 'Unknown'}
                        </span>
                        {msg.station && (
                          <span className="text-green-400">
                            {' - '}
                            {formatStationDisplay(msg.station, msg.position)}
                          </span>
                        )}
                        {' • '}
                        {getMessageTimeString(msg.sent_at)}
                      </div>
                    )}
                    <div
                      className={`rounded-l-2xl rounded-tr-2xl px-3 py-2 text-sm shadow relative ${
                        isOwn
                          ? 'bg-blue-800 text-white ml-auto max-w-[19rem]'
                          : 'bg-zinc-800 text-white max-w-[19rem]'
                      } break-words overflow-wrap-anywhere`}
                      style={
                        isOwn
                          ? {
                              borderTopRightRadius: '1rem',
                              borderBottomRightRadius: '0rem',
                            }
                          : {
                              borderTopLeftRadius: '1rem',
                              borderBottomLeftRadius: '0rem',
                              borderBottomRightRadius: '1rem',
                            }
                      }
                    >
                      <div
                        className="break-words whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: renderMessage(msg.message),
                        }}
                      />

                      {hoveredMessage === msg.id && (
                        <div className="absolute -top-2 -right-2 flex space-x-1">
                          {!isOwn && (
                            <button
                              className="bg-zinc-700 hover:bg-yellow-600 text-gray-300 hover:text-white rounded-full p-1.5 shadow-lg transition-colors duration-200"
                              onClick={() => handleGlobalReport(msg.id)}
                              title="Report message"
                            >
                              <Flag className="h-3 w-3" />
                            </button>
                          )}
                          {isOwn && (
                            <button
                              className="bg-zinc-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-full p-1.5 shadow-lg transition-colors duration-200"
                              onClick={() => handleGlobalDelete(msg.id)}
                              title="Delete message"
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {isOwn && automoddedMessages.has(msg.id) && (
                      <div className="relative group inline-block ml-2">
                        <img
                          src="/assets/images/automod.webp"
                          alt="Flagged by automod"
                          className="w-4 h-4 cursor-help rounded-full shadow-lg"
                        />
                        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-[9999] whitespace-nowrap">
                          <div className="relative p-[1px] rounded-lg bg-gradient-to-r from-red-600 to-orange-600">
                            <div className="px-3 py-1.5 bg-zinc-900/95 backdrop-blur-md rounded-lg">
                              <div className="text-xs text-white">
                                Automod flagged this for{' '}
                                <span className="text-yellow-300 font-semibold">
                                  {automoddedMessages.get(msg.id)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {!showHeader && isOwn && <div className="w-9 h-9" />}
                  {showHeader && isOwn && (
                    <img
                      src={msg.avatar || '/assets/app/default/avatar.webp'}
                      alt={msg.username || 'User'}
                      className="w-9 h-9 rounded-full border-2 border-blue-700 shadow"
                    />
                  )}
                </div>
              );
            })
          )}
          <div ref={globalMessagesEndRef} />
        </div>
      )}

      <div className="p-5 border-t border-blue-800 bg-zinc-900 rounded-bl-3xl relative">
        <div className="relative">
          {activeTab === 'session' && (
            <>
              {showMentionSuggestions && mentionSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-800 border border-blue-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {mentionSuggestions.map((suggestedUser, index) => (
                    <button
                      key={suggestedUser.id}
                      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-600/20 text-left ${
                        index === selectedSuggestionIndex
                          ? 'bg-blue-600/40'
                          : ''
                      }`}
                      onClick={() => insertMention(suggestedUser.username)}
                    >
                      <img
                        src={
                          suggestedUser.avatar ||
                          '/assets/app/default/avatar.webp'
                        }
                        alt={suggestedUser.username}
                        className="w-6 h-6 rounded-full"
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium">
                          {suggestedUser.username}
                        </span>
                        {suggestedUser.position && (
                          <span className="text-xs text-gray-400">
                            {suggestedUser.position}
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isUserInActiveChat(suggestedUser.id, activeChatUsers)
                            ? 'bg-green-400'
                            : 'bg-gray-400'
                        }`}
                      ></div>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                className="w-full bg-zinc-800 text-white px-4 py-2 pr-12 rounded-xl border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
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
                        insertMention(
                          mentionSuggestions[selectedSuggestionIndex].username
                        );
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
                }}
                maxLength={500}
                rows={3}
                placeholder="Type a message... Use @ to mention users"
                aria-label="Type a message"
              />

              <Button
                variant="outline"
                size="sm"
                className="absolute right-2 bottom-4 rounded-full px-3 py-1"
                onClick={sendMessage}
                disabled={!input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </>
          )}

          {isPFATC && activeTab === 'pfatc' && (
            <>
              {showGlobalSuggestions && globalSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-800 border border-blue-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {globalSuggestions.map((suggestion, index) => {
                    if (suggestion.type === 'airport') {
                      const airport = suggestion.data as {
                        icao: string;
                        name: string;
                      };
                      return (
                        <button
                          key={`airport-${airport.icao}`}
                          className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-600/20 text-left ${
                            index === selectedGlobalSuggestionIndex
                              ? 'bg-blue-600/40'
                              : ''
                          }`}
                          onClick={() =>
                            insertGlobalMention(airport.icao.toLowerCase())
                          }
                        >
                          <MapPin className="w-5 h-5 text-green-400 flex-shrink-0" />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-medium font-mono">
                              {airport.icao}
                            </span>
                            <span className="text-xs text-gray-400 truncate">
                              {airport.name}
                            </span>
                          </div>
                        </button>
                      );
                    } else {
                      const userSuggestion = suggestion.data as
                        | SessionUser
                        | {
                            id: string;
                            username: string;
                            position?: string;
                            avatar?: string;
                            station?: string;
                          };
                      const station =
                        'station' in userSuggestion
                          ? userSuggestion.station
                          : undefined;
                      const position =
                        'position' in userSuggestion &&
                        typeof userSuggestion.position === 'string'
                          ? userSuggestion.position
                          : undefined;
                      const displayStation = formatStationDisplay(
                        station || null,
                        position || null
                      );

                      return (
                        <button
                          key={`user-${userSuggestion.id}`}
                          className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-600/20 text-left ${
                            index === selectedGlobalSuggestionIndex
                              ? 'bg-blue-600/40'
                              : ''
                          }`}
                          onClick={() =>
                            insertGlobalMention(userSuggestion.username)
                          }
                        >
                          <img
                            src={
                              userSuggestion.avatar ||
                              '/assets/app/default/avatar.webp'
                            }
                            alt={userSuggestion.username}
                            className="w-6 h-6 rounded-full"
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-medium">
                              {userSuggestion.username}
                            </span>
                            {displayStation && (
                              <span className="text-xs text-gray-400">
                                {displayStation}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    }
                  })}
                </div>
              )}
              <textarea
                ref={globalTextareaRef}
                className="w-full bg-zinc-800 text-white px-4 py-2 pr-12 rounded-xl border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={globalInput}
                onChange={(e) => handleGlobalInputChange(e.target.value)}
                onKeyDown={(e) => {
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
                          (prev - 1 + globalSuggestions.length) %
                          globalSuggestions.length
                      );
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (
                        selectedGlobalSuggestionIndex >= 0 &&
                        selectedGlobalSuggestionIndex < globalSuggestions.length
                      ) {
                        const suggestion =
                          globalSuggestions[selectedGlobalSuggestionIndex];
                        if (suggestion.type === 'airport') {
                          const airport = suggestion.data as {
                            icao: string;
                            name: string;
                          };
                          insertGlobalMention(airport.icao.toLowerCase());
                        } else {
                          const user = suggestion.data as SessionUser;
                          insertGlobalMention(user.username);
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
                }}
                maxLength={500}
                rows={3}
                placeholder="Type a message... Use @ICAO or @username for mentions"
                aria-label="Type a global message"
              />

              <Button
                variant="outline"
                size="sm"
                className="absolute right-2 bottom-4 rounded-full px-3 py-1"
                onClick={sendGlobalMessage}
                disabled={!globalInput.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

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
    </div>
  );
}
