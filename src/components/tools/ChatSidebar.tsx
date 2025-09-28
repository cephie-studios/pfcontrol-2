import { useEffect, useRef, useState } from 'react';
import { fetchChatMessages } from '../../utils/fetch/chats';
import { useAuth } from '../../hooks/auth/useAuth';
import { createChatSocket } from '../../sockets/chatSocket';
import { Trash, X } from 'lucide-react';
import Button from '../common/Button';

interface ChatMessage {
	id: number;
	userId: string;
	username: string;
	avatar?: string;
	message: string;
	sent_at: string;
}

interface ChatSidebarProps {
	sessionId: string;
	accessId: string;
	open: boolean;
	onClose: () => void;
}

export default function ChatSidebar({
	sessionId,
	accessId,
	open,
	onClose
}: ChatSidebarProps) {
	const { user } = useAuth();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!sessionId || !accessId || !open) return;

		fetchChatMessages(sessionId)
			.then(setMessages)
			.catch(() => setMessages([]));

		socketRef.current = createChatSocket(
			sessionId,
			accessId,
			(msg: ChatMessage) => {
				console.log(
					'Received chat message:',
					msg,
					'Current user:',
					user
				);
				setMessages((prev) => [...prev, msg]);
			}
		);

		return () => {
			if (socketRef.current) {
				socketRef.current.disconnect();
				socketRef.current = null;
			}
		};
	}, [sessionId, accessId, open, user]);

	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
		}
	}, [messages]);

	const sendMessage = () => {
		if (!input.trim() || !socketRef.current) return;
		socketRef.current.emit('chatMessage', {
			sessionId,
			user,
			message: input
		});
		setInput('');
	};

	async function handleDelete(msgId: number) {
		try {
			await fetch(
				`${
					import.meta.env.VITE_SERVER_URL
				}/api/chats/${sessionId}/${msgId}`,
				{
					method: 'DELETE',
					credentials: 'include'
				}
			);
			setMessages((prev) => prev.filter((m) => m.id !== msgId));
		} catch {
			console.error('Failed to delete message');
		}
	}

	return (
		<div
			className={`fixed top-0 right-0 h-full w-100 bg-zinc-900 text-white shadow-2xl transition-transform duration-300 ${
				open ? 'translate-x-0' : 'translate-x-full'
			} rounded-l-3xl border-l-2 border-blue-800 flex flex-col shadow-2xl`}
			style={{ zIndex: 100 }}
		>
			<div className="flex justify-between items-center p-5 border-b border-blue-800 rounded-tl-3xl">
				<span className="font-bold text-lg text-blue-300">
					Session Chat
				</span>
				<button
					onClick={() => onClose()}
					className="p-1 rounded-full hover:bg-gray-700"
				>
					<X className="h-5 w-5 text-gray-400" />
				</button>
			</div>
			<div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
				{messages.map((msg) => {
					const isOwn = String(msg.userId) === String(user?.userId);
					return (
						<div
							key={msg.id}
							className={`flex items-start gap-3 ${
								isOwn ? 'justify-end' : ''
							}`}
						>
							{!isOwn && (
								<img
									src={msg.avatar || '/default-avatar.png'}
									alt={msg.username}
									className="w-9 h-9 rounded-full border-2 border-blue-700 shadow"
								/>
							)}
							<div className={`${isOwn ? 'text-right' : ''}`}>
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
									className={`rounded-l-2xl rounded-tr-2xl px-3 py-2 text-sm shadow ${
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
									{msg.message}
									{isOwn && (
										<button
											className="ml-2 text-xs text-red-400 hover:underline"
											onClick={() => handleDelete(msg.id)}
											title="Delete message"
										>
											<Trash className="inline h-3 w-3" />
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
			<div className="p-5 border-t border-blue-800 bg-zinc-900 rounded-bl-3xl flex gap-2">
				<input
					className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded-l-xl rounded-tr-xl border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
					placeholder="Type a message..."
					aria-label="Type a message"
				/>
				<Button
					variant="primary"
					size="md"
					className="rounded-xl px-6 py-2"
					onClick={sendMessage}
					disabled={!input.trim()}
				>
					Send
				</Button>
			</div>
		</div>
	);
}
