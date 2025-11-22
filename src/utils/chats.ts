import type { SessionUser } from '../types/session';
import type { Airport } from '../types/airports';
import type { ChatMessage } from '../types/chats';
import type {
  GlobalChatMessage,
  ConnectedGlobalChatUser,
} from '../sockets/globalChatSocket';

interface MentionSuggestionsResult {
  suggestions: SessionUser[];
  shouldShow: boolean;
  searchTerm: string;
}

interface GlobalMentionSuggestionsResult {
  suggestions: Array<{
    type: 'user' | 'airport';
    data:
      | SessionUser
      | { icao: string; name: string }
      | ConnectedGlobalChatUser;
  }>;
  shouldShow: boolean;
  searchTerm: string;
}

interface TextInsertionResult {
  newText: string;
  newCursorPos: number;
}

export const formatStationDisplay = (
  station: string | null,
  position: string | null
): string => {
  if (!station) return '';

  const showablePositions = ['DEL', 'GND', 'TWR', 'ALL'];

  if (
    station &&
    !station.includes('_') &&
    position &&
    showablePositions.includes(position.toUpperCase())
  ) {
    const displayPosition =
      position.toUpperCase() === 'ALL' ? 'APP' : position.toUpperCase();
    return `${station}_${displayPosition}`;
  }

  return station;
};

export const renderMessage = (message: string): string => {
  return message.replace(
    /@([^\s]+)/g,
    '<span class="text-blue-400 font-semibold">@$1</span>'
  );
};

export const isUserInActiveChat = (
  userId: string,
  activeChatUsers: string[]
): boolean => {
  return activeChatUsers.includes(userId);
};

export const handleMentionSuggestions = (
  value: string,
  cursorPos: number,
  sessionUsers: SessionUser[],
  currentUserId?: string
): MentionSuggestionsResult => {
  const textBeforeCursor = value.substring(0, cursorPos);
  const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

  if (mentionMatch) {
    const searchTerm = mentionMatch[1].toLowerCase();
    const suggestions = sessionUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(searchTerm) && u.id !== currentUserId
    );
    return {
      suggestions,
      shouldShow: suggestions.length > 0,
      searchTerm,
    };
  }

  return {
    suggestions: [],
    shouldShow: false,
    searchTerm: '',
  };
};

export const handleGlobalMentionSuggestions = (
  value: string,
  cursorPos: number,
  airports: Airport[],
  globalMessages: GlobalChatMessage[],
  connectedGlobalChatUsers: ConnectedGlobalChatUser[],
  sessionUsers: SessionUser[],
  currentUserId?: string
): GlobalMentionSuggestionsResult => {
  const textBeforeCursor = value.substring(0, cursorPos);
  const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

  if (mentionMatch) {
    const searchTerm = mentionMatch[1].toLowerCase();

    const activeAirports = Array.from(
      new Set(
        globalMessages
          .filter((msg) => msg.station && msg.station.length === 4)
          .map((msg) => msg.station!.toUpperCase())
      )
    );

    const airportSugs = airports
      .filter(
        (a) =>
          a.icao.toLowerCase().startsWith(searchTerm) &&
          activeAirports.includes(a.icao.toUpperCase())
      )
      .slice(0, 10)
      .map((a) => ({
        type: 'airport' as const,
        data: { icao: a.icao, name: a.name },
      }));

    const usersToSearch: ConnectedGlobalChatUser[] =
      connectedGlobalChatUsers.length > 0
        ? connectedGlobalChatUsers
        : sessionUsers.map((u) => ({
            id: u.id,
            username: u.username,
            position: u.position || null,
            avatar: u.avatar || null,
            station: null,
          }));

    const userSugs = usersToSearch
      .filter(
        (u) =>
          u.username.toLowerCase().includes(searchTerm) &&
          u.id !== currentUserId
      )
      .slice(0, 10)
      .map((u) => ({ type: 'user' as const, data: u }));

    const combinedSuggestions = [...airportSugs, ...userSugs].slice(0, 10);

    return {
      suggestions: combinedSuggestions,
      shouldShow: combinedSuggestions.length > 0,
      searchTerm,
    };
  }

  return {
    suggestions: [],
    shouldShow: false,
    searchTerm: '',
  };
};

export const insertMentionIntoText = (
  currentText: string,
  cursorPos: number,
  username: string
): TextInsertionResult => {
  const textBeforeCursor = currentText.substring(0, cursorPos);
  const textAfterCursor = currentText.substring(cursorPos);
  const mentionMatch = textBeforeCursor.match(/(.*)@(\w*)$/);

  if (mentionMatch) {
    const beforeMention = mentionMatch[1];
    const newText = beforeMention + `@${username} ` + textAfterCursor;
    const newCursorPos = beforeMention.length + username.length + 2;

    return { newText, newCursorPos };
  }

  return { newText: currentText, newCursorPos: cursorPos };
};

export const shouldShowMessageHeader = (
  currentMessage: ChatMessage | GlobalChatMessage,
  previousMessage: ChatMessage | GlobalChatMessage | null
): boolean => {
  return (
    !previousMessage ||
    previousMessage.userId !== currentMessage.userId ||
    new Date(currentMessage.sent_at).getTime() -
      new Date(previousMessage.sent_at).getTime() >=
      60000
  );
};

export const isMessageMentioned = (
  message: ChatMessage | GlobalChatMessage,
  currentUserId?: string,
  station?: string
): boolean => {
  const isMentionedByUser = Boolean(
    'mentions' in message &&
      message.mentions &&
      Array.isArray(message.mentions) &&
      currentUserId &&
      message.mentions.includes(currentUserId)
  );

  const isMentionedByUserInGlobal = Boolean(
    'userMentions' in message &&
      message.userMentions &&
      Array.isArray(message.userMentions) &&
      currentUserId &&
      message.userMentions.some(
        (username: string) =>
          username.toLowerCase() === currentUserId.toLowerCase()
      )
  );

  const isMentionedByAirport = Boolean(
    'airportMentions' in message &&
      message.airportMentions &&
      Array.isArray(message.airportMentions) &&
      station &&
      message.airportMentions.some(
        (icao: string) => icao.toUpperCase() === station.toUpperCase()
      )
  );

  return isMentionedByUser || isMentionedByUserInGlobal || isMentionedByAirport;
};

export const getMessageTimeString = (timestamp: string | Date): string => {
  const date =
    typeof timestamp === 'string'
      ? new Date(timestamp.endsWith('Z') ? timestamp : timestamp + 'Z')
      : timestamp;

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const isAtBottom = (element: HTMLDivElement): boolean => {
  return element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
};
