import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/auth/useAuth';

export default function VatsimCallback() {
    const navigate = useNavigate();
    const { refreshUser } = useAuth();
    const hasSubmitted = useRef(false);

    useEffect(() => {
        if (hasSubmitted.current) return;
        hasSubmitted.current = true;

        const run = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const state = params.get('state');
            if (!code || !state) {
                navigate('/settings?error=vatsim_missing_code');
                return;
            }
            try {
                const res = await fetch(
                    `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim/exchange`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ code, state }),
                    }
                );
                if (!res.ok) {
                    navigate('/settings?error=vatsim_link_failed');
                    return;
                }
                await refreshUser();
                try {
                    const url = new URL(window.location.href);
                    url.search = '';
                    window.history.replaceState({}, '', url.toString());
                } catch {
                    // If URL API is not supported, do nothing
                }
                navigate('/settings?vatsim_linked=true');
            } catch {
                navigate('/settings?error=vatsim_link_failed');
            }
        };
        run();
    }, [navigate, refreshUser]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
            Processing VATSIM login...
        </div>
    );
}
