import { useEffect, useRef, useState } from 'react';
import { fetchChatMessages, reportChatMessage } from '../../utils/fetch/chats';
import { useAuth } from '../../hooks/auth/useAuth';
import { createChatSocket } from '../../sockets/chatSocket';
import { Send, Trash, X, Flag } from 'lucide-react';
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
}

export default function ChatSidebar({
  sessionId,
  accessId,
  open,
  onClose,
  sessionUsers,
  onMentionReceived,
}: ChatSidebarProps) {
  const { user } = useAuth();
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
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [automoddedMessages, setAutomoddedMessages] = useState<Set<number>>(
    new Set()
  );
  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingDeleteRef = useRef<ChatMessage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sessionId || !accessId || !open || !user) return;

    setLoading(true);
    fetchChatMessages(sessionId)
      .then((fetchedMessages) => {
        setMessages(fetchedMessages);
        setLoading(false);
      })
      .catch(() => {
        setMessages([]);
        setLoading(false);
      });

    socketRef.current = createChatSocket(
      sessionId,
      accessId,
      user.userId,
      (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
      },
      (data: { messageId: number }) => {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
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
        if (mention.mentionedUserId === user.userId && onMentionReceived) {
          onMentionReceived(mention);
        }
      },
      (data: { messageId: number }) => {
        setAutomoddedMessages((prev) => new Set(prev).add(data.messageId));
      }
    );

    return () => {
      if (socketRef.current) {
        socketRef.current.socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [sessionId, accessId, open, user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleInputChange = (value: string) => {
    setInput(value);

    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const searchTerm = mentionMatch[1].toLowerCase();
      const suggestions = sessionUsers.filter(
        (u) =>
          u.username.toLowerCase().includes(searchTerm) && u.id !== user?.userId
      );
      setMentionSuggestions(suggestions);
      setShowMentionSuggestions(suggestions.length > 0);
      setSelectedSuggestionIndex(suggestions.length > 0 ? 0 : -1);
    } else {
      setShowMentionSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const insertMention = (username: string) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = input.substring(0, cursorPos);
    const textAfterCursor = input.substring(cursorPos);
    const mentionMatch = textBeforeCursor.match(/(.*)@(\w*)$/);

    if (mentionMatch) {
      const beforeMention = mentionMatch[1];
      const newText = beforeMention + `@${username} ` + textAfterCursor;
      setInput(newText);
      setShowMentionSuggestions(false);

      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + username.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
    setSelectedSuggestionIndex(-1);
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

  const renderMessage = (message: string) => {
    return message.replace(
      /@([^\s]+)/g,
      '<span class="text-blue-400 font-semibold">@$1</span>'
    );
  };

  const isUserInActiveChat = (userId: string) => {
    return activeChatUsers.includes(userId);
  };

  async function handleDelete(msgId: number) {
    if (!socketRef.current || !user) return;

    const messageToDelete = messages.find((m) => m.id === msgId);
    if (!messageToDelete) return;

    pendingDeleteRef.current = messageToDelete;
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    socketRef.current.deleteMessage(msgId, user.userId);
  }

  async function handleReport(msgId: number) {
    setReportingMessageId(msgId);
    setShowReportModal(true);
  }

  async function handleSubmitReport() {
    if (!reportingMessageId || !reportReason.trim()) return;

    try {
      await reportChatMessage(
        sessionId,
        reportingMessageId,
        reportReason.trim()
      );
      setToast({ message: 'Message reported successfully.', type: 'success' }); // Update to use state
      setShowReportModal(false);
      setReportReason('');
      setReportingMessageId(null);
    } catch {
      setToast({ message: 'Failed to report message.', type: 'error' }); // Update to use state
    }
  }

  return (
    <div
      className={`fixed top-0 right-0 h-full w-100 bg-zinc-900 text-white transition-transform duration-300 ${
        open ? 'translate-x-0 shadow-2xl' : 'translate-x-full'
      } rounded-l-3xl border-l-2 border-blue-800 flex flex-col`}
      style={{ zIndex: 100 }}
    >
      <div className="flex justify-between items-center p-5 border-b border-blue-800 rounded-tl-3xl">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-xl text-blue-300">
            Session Chat
          </span>
        </div>
        <button
          onClick={() => onClose()}
          className="p-1 rounded-full hover:bg-gray-700"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      <div className="px-5 py-2 border-b border-blue-800 bg-zinc-900">
        <div className="flex flex-wrap gap-1">
          {sessionUsers.map((sessionUser) => (
            <img
              key={sessionUser.id}
              src={sessionUser.avatar || '/assets/app/default/avatar.webp'}
              alt={sessionUser.username}
              className={`w-8 h-8 rounded-full border-2 ${
                isUserInActiveChat(sessionUser.id)
                  ? 'border-green-500'
                  : 'border-gray-500'
              }`}
              title={sessionUser.username}
            />
          ))}
        </div>
      </div>

      <div
        className={`flex-1 ${
          messages.length > 0 ? 'overflow-y-auto' : ''
        } px-5 py-4 space-y-4`}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-400">
            No messages yet.
          </div>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showHeader =
              !prevMsg ||
              prevMsg.userId !== msg.userId ||
              new Date(msg.sent_at).getTime() -
                new Date(prevMsg.sent_at).getTime() >=
                60000;
            const isOwn = String(msg.userId) === String(user?.userId);
            const isMentioned =
              msg.mentions &&
              Array.isArray(msg.mentions) &&
              msg.mentions.includes(user?.userId || '');

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 relative ${
                  isOwn ? 'justify-end' : ''
                } ${isMentioned ? 'bg-blue-900/20 rounded-lg p-2 -m-2' : ''}`}
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
                <div className={`${isOwn ? 'text-right' : ''} relative group`}>
                  {showHeader && (
                    <div className="text-xs text-gray-400 mb-1">
                      <span className="font-semibold text-blue-300">
                        {msg.username}
                      </span>
                      {' • '}
                      {new Date(msg.sent_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
                  {showHeader && isOwn && automoddedMessages.has(msg.id) && (
                    <img
                      src="/assets/images/automod.webp"
                      alt="Flagged by automod"
                      title="Your message was flagged by automod for inappropriate language."
                      className="w-4 h-4 ml-2 hover:cursor-help"
                    />
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

      <div className="p-5 border-t border-blue-800 bg-zinc-900 rounded-bl-3xl relative">
        <div className="relative">
          {showMentionSuggestions && mentionSuggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-800 border border-blue-700 rounded-lg shadow-lg max-h-32 overflow-y-auto">
              {mentionSuggestions.map((suggestedUser, index) => (
                <button
                  key={suggestedUser.id}
                  className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-600/20 text-left ${
                    index === selectedSuggestionIndex ? 'bg-blue-600/40' : ''
                  }`}
                  onClick={() => insertMention(suggestedUser.username)}
                >
                  <img
                    src={
                      suggestedUser.avatar || '/assets/app/default/avatar.webp'
                    }
                    alt={suggestedUser.username}
                    className="w-6 h-6 rounded-full"
                  />
                  <span>{suggestedUser.username}</span>
                  <div
                    className={`w-2 h-2 rounded-full ml-auto ${
                      isUserInActiveChat(suggestedUser.id)
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
        </div>
      </div>

      {/* Report Modal */}
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

      {/* Add this at the end of the return statement, before the closing </div> */}
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
