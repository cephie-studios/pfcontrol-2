import type { User } from '../../types/user';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export async function getCurrentUser(): Promise<User> {
    const API_BASE_URL = import.meta.env.VITE_SERVER_URL;
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    return await res.json();
}

export async function updateTutorialStatus(completed: boolean): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/tutorial`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed })
        });
        return response.ok;
    } catch (error) {
        console.error('Error updating tutorial status:', error);
        return false;
    }
}

export async function logout(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        return response.ok;
    } catch (error) {
        console.error('Error logging out:', error);
        return false;
    }
}

export function getDiscordLoginUrl(callback?: string): string {
    const url = new URL(`${API_BASE_URL}/api/auth/discord`);
    if (callback) {
        url.searchParams.set('callback', callback);
    }
    return url.toString();
}