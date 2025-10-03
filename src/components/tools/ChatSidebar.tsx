import { useEffect, useRef, useState } from 'react';
import { fetchChatMessages } from '../../utils/fetch/chats';
import { useAuth } from '../../hooks/auth/useAuth';
import { createChatSocket } from '../../sockets/chatSocket';
import type { ChatMessage, ChatMention } from '../../types/chats';
import type { SessionUser } from '../../types/session';
import { Send, Trash, X } from 'lucide-react';
import Button from '../common/Button';

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
	onMentionReceived
}: ChatSidebarProps) {
	const { user } = useAuth();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);
	const [activeChatUsers, setActiveChatUsers] = useState<string[]>([]);
	const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
	const [mentionSuggestions, setMentionSuggestions] = useState<SessionUser[]>(
		[]
	);
	const [cursorPosition, setCursorPosition] = useState(0);
	const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const pendingDeleteRef = useRef<ChatMessage | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (!sessionId || !accessId || !open || !user) return;

		fetchChatMessages(sessionId)
			.then(setMessages)
			.catch(() => setMessages([]));

		socketRef.current = createChatSocket(
			sessionId,
			accessId,
			user.userId,
			(msg: ChatMessage) => {
				setMessages((prev) => [...prev, msg]);
			},
			(data: { messageId: number }) => {
				setMessages((prev) =>
					prev.filter((m) => m.id !== data.messageId)
				);
			},
			(data: { messageId: number; error: string }) => {
				if (
					pendingDeleteRef.current &&
					pendingDeleteRef.current.id === data.messageId
				) {
					setMessages((prev) => {
						const newMessages = [
							...prev,
							pendingDeleteRef.current!
						];
						return newMessages.sort(
							(a, b) =>
								new Date(a.sent_at).getTime() -
								new Date(b.sent_at).getTime()
						);
					});
					pendingDeleteRef.current = null;
				}
			},
			(users: string[]) => {
				setActiveChatUsers(users);
			},
			(mention: ChatMention) => {
				if (
					mention.mentionedUserId === user.userId &&
					onMentionReceived
				) {
					onMentionReceived(mention);
				}
			}
		);

		return () => {
			if (socketRef.current) {
				socketRef.current.socket.disconnect();
				socketRef.current = null;
			}
		};
	}, [sessionId, accessId, open, user, onMentionReceived]);

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
					u.username.toLowerCase().includes(searchTerm) &&
					u.id !== user?.userId
			);
			setMentionSuggestions(suggestions);
			setShowMentionSuggestions(true);
			setCursorPosition(cursorPos);
		} else {
			setShowMentionSuggestions(false);
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
					const newCursorPos =
						beforeMention.length + username.length + 2;
					textareaRef.current.focus();
					textareaRef.current.setSelectionRange(
						newCursorPos,
						newCursorPos
					);
				}
			}, 0);
		}
	};

	const sendMessage = () => {
		if (!input.trim() || !socketRef.current || input.trim().length > 500)
			return;
		socketRef.current.socket.emit('chatMessage', {
			sessionId,
			user,
			message: input.trim()
		});
		setInput('');
	};

	const renderMessage = (message: string) => {
		return message.replace(
			/@(\w+)/g,
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

	return (
		<div
			className={`fixed top-0 right-0 h-full w-100 bg-zinc-900 text-white shadow-2xl transition-transform duration-300 ${
				open ? 'translate-x-0' : 'translate-x-full'
			} rounded-l-3xl border-l-2 border-blue-800 flex flex-col shadow-2xl`}
			style={{ zIndex: 100 }}
		>
			<div className="flex justify-between items-center p-5 border-b border-blue-800 rounded-tl-3xl">
				<div className="flex items-center gap-3">
					<span className="font-extrabold text-xl text-blue-300">
						Session Chat
					</span>
					<div className="flex items-center gap-1">
						<div className="w-2 h-2 rounded-full bg-green-500"></div>
						<span className="text-xs text-gray-400">
							{activeChatUsers.length} online
						</span>
					</div>
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
						<div
							key={sessionUser.id}
							className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
								isUserInActiveChat(sessionUser.id)
									? 'bg-green-600/20 text-green-400 border border-green-500/30'
									: 'bg-gray-600/20 text-gray-400 border border-gray-500/30'
							}`}
						>
							<div
								className={`w-1.5 h-1.5 rounded-full ${
									isUserInActiveChat(sessionUser.id)
										? 'bg-green-400'
										: 'bg-gray-400'
								}`}
							></div>
							{sessionUser.username}
						</div>
					))}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
				{messages.map((msg) => {
					const isOwn = String(msg.userId) === String(user?.userId);
					const isMentioned = msg.mentions?.includes(
						user?.userId || ''
					);

					return (
						<div
							key={msg.id}
							className={`flex items-start gap-3 relative ${
								isOwn ? 'justify-end' : ''
							} ${
								isMentioned
									? 'bg-blue-900/20 rounded-lg p-2 -m-2'
									: ''
							}`}
							onMouseEnter={() => setHoveredMessage(msg.id)}
							onMouseLeave={() => setHoveredMessage(null)}
						>
							{!isOwn && (
								<img
									src={msg.avatar || '/default-avatar.png'}
									alt={msg.username}
									className="w-9 h-9 rounded-full border-2 border-blue-700 shadow"
								/>
							)}
							<div
								className={`${
									isOwn ? 'text-right' : ''
								} relative group`}
							>
								<div className="text-xs text-gray-400 mb-1">
									<span className="font-semibold text-blue-300">
										{msg.username}
									</span>
									{' • '}
									{new Date(msg.sent_at).toLocaleTimeString(
										[],
										{
											hour: '2-digit',
											minute: '2-digit'
										}
									)}
								</div>
								<div
									className={`rounded-l-2xl rounded-tr-2xl px-3 py-2 text-sm shadow relative ${
										isOwn
											? 'bg-blue-800 text-white ml-auto max-w-xs'
											: 'bg-zinc-800 text-white'
									}`}
									style={
										isOwn
											? {
													borderTopRightRadius:
														'1rem',
													borderBottomRightRadius:
														'0rem'
											  }
											: {
													borderTopLeftRadius: '1rem',
													borderBottomRightRadius:
														'1rem',
													borderBottomLeftRadius:
														'0rem'
											  }
									}
								>
									<div
										dangerouslySetInnerHTML={{
											__html: renderMessage(msg.message)
										}}
									/>

									{isOwn && hoveredMessage === msg.id && (
										<button
											className="absolute -top-2 -right-2 bg-zinc-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-full p-1.5 shadow-lg transition-colors duration-200"
											onClick={() => handleDelete(msg.id)}
											title="Delete message"
										>
											<Trash className="h-3 w-3" />
										</button>
									)}
								</div>
							</div>
							{isOwn && (
								<img
									src={msg.avatar || '/default-avatar.png'}
									alt={msg.username}
									className="w-9 h-9 rounded-full border-2 border-blue-700 shadow"
								/>
							)}
						</div>
					);
				})}
				<div ref={messagesEndRef} />
			</div>

			<div className="p-5 border-t border-blue-800 bg-zinc-900 rounded-bl-3xl relative">
				<div className="relative">
					{showMentionSuggestions &&
						mentionSuggestions.length > 0 && (
							<div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-800 border border-blue-700 rounded-lg shadow-lg max-h-32 overflow-y-auto">
								{mentionSuggestions.map((suggestedUser) => (
									<button
										key={suggestedUser.id}
										className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-600/20 text-left"
										onClick={() =>
											insertMention(
												suggestedUser.username
											)
										}
									>
										<img
											src={
												suggestedUser.avatar ||
												'/default-avatar.png'
											}
											alt={suggestedUser.username}
											className="w-6 h-6 rounded-full"
										/>
										<span>{suggestedUser.username}</span>
										<div
											className={`w-2 h-2 rounded-full ml-auto ${
												isUserInActiveChat(
													suggestedUser.id
												)
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
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								sendMessage();
							} else if (e.key === 'Escape') {
								setShowMentionSuggestions(false);
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
		</div>
	);
}
