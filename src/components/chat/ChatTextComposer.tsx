import type { KeyboardEventHandler, RefObject } from 'react';
import { MapPin, Send } from 'lucide-react';
import type { SessionUser } from '../../types/session';
import type { ConnectedGlobalChatUser } from '../../sockets/globalChatSocket';
import { formatStationDisplay, isUserInActiveChat } from '../../utils/chats';
import Button from '../common/Button';

export type GlobalChatSuggestion = {
  type: 'user' | 'airport';
  data:
    | SessionUser
    | { icao: string; name: string }
    | ConnectedGlobalChatUser;
};

const mentionListClass =
  'absolute bottom-full left-0 right-0 mb-2 bg-zinc-800 border border-blue-700 rounded-lg shadow-lg max-h-40 overflow-y-auto';

function typingText(users: Map<string, string>): string | null {
  const names = Array.from(users.values());
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

/** Single floating composer for session + PFATC: gradient, @-mentions, textarea, send. */
export function ChatTextComposer({
  isGlobalChat,
  textareaRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  sendDisabled,
  placeholder,
  ariaLabel,
  showMentionSuggestions,
  mentionSuggestions,
  selectedSuggestionIndex,
  activeChatUsers,
  insertMention,
  showGlobalSuggestions,
  globalSuggestions,
  selectedGlobalSuggestionIndex,
  insertGlobalMention,
  typingUsers,
}: {
  isGlobalChat: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onSend: () => void;
  sendDisabled: boolean;
  placeholder: string;
  ariaLabel: string;
  showMentionSuggestions: boolean;
  mentionSuggestions: SessionUser[];
  selectedSuggestionIndex: number;
  activeChatUsers: string[];
  insertMention: (username: string) => void;
  showGlobalSuggestions: boolean;
  globalSuggestions: GlobalChatSuggestion[];
  selectedGlobalSuggestionIndex: number;
  insertGlobalMention: (value: string) => void;
  typingUsers: Map<string, string>;
}) {
  const typing = typingText(typingUsers);
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10">
      <div className="relative px-5 pb-5 pt-14 rounded-bl-3xl">
        <div
          className="pointer-events-none absolute inset-0 rounded-bl-3xl bg-gradient-to-t from-zinc-900 to-transparent"
          aria-hidden
        />
        <div className="relative z-10 pointer-events-auto">
          {isGlobalChat
            ? showGlobalSuggestions &&
              globalSuggestions.length > 0 && (
                <div className={mentionListClass}>
                  {globalSuggestions.map((suggestion, index) => {
                    if (suggestion.type === 'airport') {
                      const airport = suggestion.data as {
                        icao: string;
                        name: string;
                      };
                      return (
                        <button
                          key={`airport-${airport.icao}`}
                          type="button"
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
                    }
                    const userSuggestion = suggestion.data as
                      | SessionUser
                      | {
                          id: string;
                          username: string;
                          position?: string;
                          avatar?: string;
                          station?: string;
                        };
                    const sugStation =
                      'station' in userSuggestion
                        ? userSuggestion.station
                        : undefined;
                    const sugPosition =
                      'position' in userSuggestion &&
                      typeof userSuggestion.position === 'string'
                        ? userSuggestion.position
                        : undefined;
                    const displayStation = formatStationDisplay(
                      sugStation || null,
                      sugPosition || null
                    );

                    return (
                      <button
                        key={`user-${userSuggestion.id}`}
                        type="button"
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
                  })}
                </div>
              )
            : showMentionSuggestions &&
              mentionSuggestions.length > 0 && (
                <div className={mentionListClass}>
                  {mentionSuggestions.map((suggestedUser, index) => (
                    <button
                      key={suggestedUser.id}
                      type="button"
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
                          isUserInActiveChat(
                            suggestedUser.id,
                            activeChatUsers
                          )
                            ? 'bg-green-400'
                            : 'bg-gray-400'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}

          {typing && (
            <div className="flex items-center gap-1.5 px-1 pb-1.5 text-xs text-zinc-400">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
              </span>
              {typing}
            </div>
          )}

          <textarea
            ref={textareaRef}
            className="w-full bg-zinc-800 text-white px-4 py-2 pr-12 rounded-3xl border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={500}
            rows={3}
            placeholder={placeholder}
            aria-label={ariaLabel}
          />

          <Button
            variant="outline"
            size="sm"
            className="absolute right-2 bottom-3.5 rounded-full px-3 py-1"
            onClick={onSend}
            disabled={sendDisabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
