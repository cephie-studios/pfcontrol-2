import type { SessionInfo } from "../../types/session";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export async function fetchSession(sessionId: string, accessId: string): Promise<SessionInfo> {
    const url = new URL(`${API_BASE_URL}/api/sessions/${sessionId}`);
    url.searchParams.append('accessId', accessId);
    
    const res = await fetch(url.toString(), {
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch session');
    return res.json();
}

export async function fetchMySessions(): Promise<SessionInfo[]> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/mine`, {
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch user sessions');
    return res.json();
}

export async function fetchAllSessions(): Promise<SessionInfo[]> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/`, {
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch sessions');
    return res.json();
}

export async function createSession(data: {
    airportIcao: string;
    createdBy: string;
    isPFATC?: boolean;
    activeRunway?: string | null;
}): Promise<SessionInfo> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
}

export async function updateSession(sessionId: string, accessId: string, updates: Partial<SessionInfo>): Promise<SessionInfo> {
    const url = new URL(`${API_BASE_URL}/api/sessions/${sessionId}`);
    url.searchParams.append('accessId', accessId);

    const res = await fetch(url.toString(), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update session');
    return res.json();
}

export async function updateSessionName(sessionId: string, name: string): Promise<{ customName: string }> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/update-name`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name })
    });
    if (!res.ok) throw new Error('Failed to update session name');
    return res.json();
}

export async function deleteSession(sessionId: string): Promise<{ message: string; sessionId: string }> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
    });
    if (!res.ok) throw new Error('Failed to delete session');
    return res.json();
}

export async function deleteOldestSession(): Promise<{ message: string; sessionId: string; airportIcao: string; createdAt: string }> {
    const response = await fetch(`${API_BASE_URL}/api/sessions/delete-oldest`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete oldest session');
    }

    return await response.json();
}