const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export interface Flight {
    id: string;
    callsign: string;
    departure_icao: string;
    arrival_icao: string;
    aircraft_icao: string;
    aircraft_model: string | null;
    flight_status: string;
    controller_status: string | null;
    current_phase: string | null;
    duration_minutes: number | null;
    total_distance_nm: number | null;
    landing_rate_fpm: number | null;
    landing_score: number | null;
    smoothness_score: number | null;
    created_at: string;
}

export interface Stats {
    total_flights: number;
    total_flight_time_minutes: number;
    total_distance_nm: number;
    favorite_aircraft: string | null;
    favorite_departure: string | null;
    best_landing_rate: number | null;
    average_landing_score: number | null;
}

export interface Notification {
    id: number;
    type: 'info' | 'warning' | 'success' | 'error';
    title: string;
    message: string;
    read: boolean;
    created_at: string;
}

export async function fetchStats(): Promise<Stats | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/logbook/stats`, {
            credentials: 'include',
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (err) {
        console.error('Failed to fetch stats:', err);
    }
    return null;
}

export async function fetchActiveFlights(): Promise<Flight[]> {
    try {
        const [pendingRes, activeRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/logbook/flights?page=1&limit=10&status=pending`, {
                credentials: 'include',
            }),
            fetch(`${API_BASE_URL}/api/logbook/flights?page=1&limit=10&status=active`, {
                credentials: 'include',
            }),
        ]);

        const pending = pendingRes.ok ? (await pendingRes.json()).flights : [];
        const active = activeRes.ok ? (await activeRes.json()).flights : [];

        const combined = [...active, ...pending].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return combined;
    } catch (err) {
        console.error('Failed to fetch active flights:', err);
        return [];
    }
}

export async function fetchFlights(page: number, limit: number = 20): Promise<{ flights: Flight[]; hasMore: boolean }> {
    try {
        const res = await fetch(
            `${API_BASE_URL}/api/logbook/flights?page=${page}&limit=${limit}&status=completed`,
            { credentials: 'include' }
        );
        if (res.ok) {
            return await res.json();
        } else {
            throw new Error('Failed to load flights');
        }
    } catch (err) {
        console.error('Failed to fetch flights:', err);
        throw err;
    }
}

export async function fetchNotifications(): Promise<Notification[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/logbook/notifications?unreadOnly=true`, {
            credentials: 'include',
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (err) {
        console.error('Failed to fetch notifications:', err);
    }
    return [];
}

export async function dismissNotification(notificationId: number): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/api/logbook/notifications/${notificationId}/read`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch (err) {
        console.error('Failed to dismiss notification:', err);
    }
}

export async function deleteFlight(flightId: string): Promise<{ error?: string }> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/logbook/flights/${flightId}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        if (res.ok) {
            return {};
        } else {
            const data = await res.json();
            return { error: data.error || 'Failed to delete flight' };
        }
    } catch (err) {
        console.error('Error deleting flight:', err);
        return { error: 'Failed to delete flight' };
    }
}

// Debug functions (admin only)
export async function loadDebugData(type: string): Promise<{ type: string; data: unknown } | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/logbook/debug/${type}`, {
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            return { type, data };
        }
    } catch (err) {
        console.error('Error loading debug data:', err);
    }
    return null;
}

export async function resetStats(): Promise<{ message?: string; error?: string }> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/logbook/debug/reset-stats`, {
            method: 'POST',
            credentials: 'include',
        });
        if (res.ok) {
            return { message: 'Stats reset successfully!' };
        }
    } catch (err) {
        console.error('Error resetting stats:', err);
    }
    return { error: 'Failed to reset stats' };
}

export async function exportData(): Promise<{ data?: unknown; error?: string }> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/logbook/debug/export-data`, {
            method: 'POST',
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            return { data };
        }
    } catch (err) {
        console.error('Error exporting data:', err);
    }
    return { error: 'Failed to export data' };
}