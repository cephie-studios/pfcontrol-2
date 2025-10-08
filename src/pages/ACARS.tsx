import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import Button from '../components/common/Button';
import { createFlightsSocket } from '../sockets/flightsSocket';

export default function ACARS() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [searchParams] = useSearchParams();
    const requestedFlightIdFromQuery = searchParams.get('flightId') ?? null;
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<{ id: string; flightId?: string | number; text: string; ts: string }[]>([]);
    const [socketWrapper, setSocketWrapper] = useState<any>(null);
    const [flashingFlightId, setFlashingFlightId] = useState<string | number | null>(null);

    useEffect(() => {
        if (!sessionId) return;
        setLoading(true);

        // Connect as a viewer (no accessId) so ACARS receives pdcIssued
        const wrapper = createFlightsSocket(sessionId, '', () => {}, () => {}, () => {}, () => {});
        setSocketWrapper(wrapper);

        const handlePdc = (payload: any) => {
            try {
                // pdcText might be top-level or inside updatedFlight
                const ptext = payload?.pdcText ?? payload?.updatedFlight?.pdc_remarks ?? payload?.updatedFlight?.pdc_text ?? null;
                if (!ptext) return;
                const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                setMessages((m) => [{ id, flightId: payload?.flightId ?? payload?.updatedFlight?.id, text: String(ptext), ts: new Date().toISOString() }, ...m]);
            } catch (e) {
                console.debug('ACARS pdc handler error', e);
            }
        };

        const handleConnect = () => setLoading(false);
        try {
            wrapper.socket.on('pdcIssued', handlePdc);
            wrapper.socket.on('connect', handleConnect);
            wrapper.socket.on('connect_error', handleConnect);
        } catch (e) {
            console.debug('ACARS socket attach failed', e);
            setLoading(false);
        }

        return () => {
            try {
                wrapper.socket.off('pdcIssued', handlePdc);
                wrapper.socket.off('connect', handleConnect);
                wrapper.socket.disconnect();
            } catch (e) {}
        };
    }, [sessionId]);

    // emit requestPDC and flash C locally for the requested flight
    const handleRequestPDC = (flightId?: string | number | null) => {
        const id = flightId ?? requestedFlightIdFromQuery;
        if (!id || !socketWrapper?.socket) return;
        try {
            socketWrapper.socket.emit('requestPDC', { flightId: id });
        } catch (e) {
            console.debug('ACARS requestPDC emit failed', e);
        }
        setFlashingFlightId(id);
        setTimeout(() => setFlashingFlightId(null), 3000);
    };

    if (!sessionId) return <div className="min-h-screen"><Navbar /><div className="p-8">Missing session</div></div>;
    if (loading) return (<div className="min-h-screen"><Navbar /><div className="p-8"><Loader /></div></div>);

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <Navbar />
            <div className="container mx-auto px-4 py-8 max-w-3xl">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">ACARS / PDC Inbox</h1>
                    <div className="flex gap-2">
                        <Button onClick={() => navigate(`/submit/${sessionId}`)} variant="outline">Back to Submit</Button>
                        <Button onClick={() => handleRequestPDC(requestedFlightIdFromQuery)} variant="primary">Request PDC</Button>
                    </div>
                </div>

                {messages.length === 0 ? (
                    <div className="text-gray-400">No PDCs yet.</div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((m) => (
                            <div key={m.id} className="p-4 bg-gray-900/40 border border-gray-800 rounded-md">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-xs text-gray-400">Received: {new Date(m.ts).toLocaleString()}</div>
                                        {m.flightId && <div className="text-xs text-gray-400">Flight ID: {m.flightId}</div>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button onClick={() => handleRequestPDC(m.flightId)} size="sm" variant="outline">Request PDC for this flight</Button>
                                        {String(flashingFlightId) === String(m.flightId) && (
                                            <div className="inline-flex items-center justify-center w-6 h-6 rounded border ring-2 ring-blue-400 animate-pulse">
                                                <span className="text-xs font-bold text-white">C</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <pre className="mt-3 text-sm font-mono whitespace-pre-wrap">{m.text}</pre>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}