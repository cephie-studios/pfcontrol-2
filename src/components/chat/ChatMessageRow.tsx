import { Flag, Trash } from 'lucide-react';
import type { ChatMessage } from '../../types/chats';
import type { GlobalChatMessage } from '../../sockets/globalChatSocket';
import {
  formatStationDisplay,
  renderMessage,
  shouldShowMessageHeader,
  isMessageMentioned,
  getMessageTimeString,
} from '../../utils/chats';

export type ChatListMessage = ChatMessage | GlobalChatMessage;

export function ChatMessageRow({
  msg,
  prevMsg,
  isGlobal,
  userId,
  username,
  station,
  hoveredId,
  onHover,
  onReport,
  onDelete,
  automodReason,
}: {
  msg: ChatListMessage;
  prevMsg: ChatListMessage | null;
  isGlobal: boolean;
  userId: string | undefined;
  username: string | undefined;
  station: string | undefined;
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  onReport: (id: number) => void;
  onDelete: (id: number) => void;
  automodReason?: string;
}) {
  const showHeader = shouldShowMessageHeader(msg, prevMsg);
  const isOwn = String(msg.userId) === String(userId);
  const isMentioned = isGlobal
    ? isMessageMentioned(msg, username, station)
    : isMessageMentioned(msg, userId);

  const rowClass = isGlobal
    ? `flex items-start gap-2 relative ${
        isOwn ? 'justify-end' : ''
      } ${isMentioned ? 'bg-blue-900/20 rounded-lg p-1 my-1' : 'gap-3'}`
    : `flex items-start gap-1 relative ${
        isOwn ? 'justify-end' : 'gap-3'
      } ${isMentioned ? 'bg-blue-900/20 rounded-lg p-1 my-1' : 'gap-3'}`;

  const displayName = msg.username || 'Unknown';

  return (
    <div
      className={rowClass}
      onMouseEnter={() => onHover(msg.id)}
      onMouseLeave={() => onHover(null)}
    >
      {showHeader && !isOwn && (
        <img
          src={msg.avatar || '/assets/app/default/avatar.webp'}
          alt={displayName}
          className="w-9 h-9 rounded-full border-2 border-blue-700 shadow"
        />
      )}
      {!showHeader && !isOwn && <div className="w-9 h-9" />}
      <div className={`${isOwn ? 'text-right' : ''} relative group`}>
        {showHeader && (
          <div className="text-xs text-gray-400 mb-1">
            <span className="font-semibold text-blue-300">{displayName}</span>
            {isGlobal &&
              'station' in msg &&
              msg.station && (
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

          {hoveredId === msg.id && (
            <div className="absolute -top-2 -right-2 flex space-x-1">
              {!isOwn && (
                <button
                  className="bg-zinc-700 hover:bg-yellow-600 text-gray-300 hover:text-white rounded-full p-1.5 shadow-lg transition-colors duration-200"
                  onClick={() => onReport(msg.id)}
                  title="Report message"
                  type="button"
                >
                  <Flag className="h-3 w-3" />
                </button>
              )}
              {isOwn && (
                <button
                  className="bg-zinc-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-full p-1.5 shadow-lg transition-colors duration-200"
                  onClick={() => onDelete(msg.id)}
                  title="Delete message"
                  type="button"
                >
                  <Trash className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
        {isOwn && automodReason && (
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
                      {automodReason}
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
          alt={displayName}
          className="w-9 h-9 rounded-full border-2 border-blue-700 shadow"
        />
      )}
    </div>
  );
}
