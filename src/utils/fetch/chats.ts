const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export async function fetchChatMessages(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/api/chats/${sessionId}`, {
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch chat messages');
    return res.json();
}

export async function sendChatMessage(sessionId: string, message: string) {
    const res = await fetch(`${API_BASE_URL}/api/chats/${sessionId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
}

export async function deleteChatMessage(sessionId: string, messageId: number) {
    const res = await fetch(`${API_BASE_URL}/api/chats/${sessionId}/${messageId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete message');
    return res.json();
}

export async function reportChatMessage(sessionId: string, messageId: number, reason: string) {
    const res = await fetch(`${API_BASE_URL}/api/chats/${sessionId}/${messageId}/report`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Failed to report message');
    return res.json();
}