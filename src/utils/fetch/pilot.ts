import type { PilotProfile } from '../../types/pilot';

export async function fetchPilotProfile(username: string): Promise<PilotProfile | null> {
    try {
        const res = await fetch(
            `${import.meta.env.VITE_SERVER_URL}/api/pilot/${username}`
        );
        if (res.ok) {
            return await res.json();
        } else {
            return null;
        }
    } catch {
        return null;
    }
}