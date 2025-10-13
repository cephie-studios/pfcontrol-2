import type { TelemetryPoint } from '../types/publicFlight';

export const formatDuration = (
    minutes: number | null,
    isLive: boolean = false
): string => {
    if (minutes === null || minutes === undefined) return 'N/A';
    if (minutes < 1 && !isLive) return 'N/A';
    if (minutes < 1) return '0m';
    const totalMinutes = Math.floor(minutes);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

export const getLandingGrade = (fpm: number | null) => {
    if (!fpm)
        return {
            text: 'N/A',
            color: 'text-zinc-400',
            bg: 'bg-gradient-to-br from-zinc-800/50 to-zinc-900/50',
            border: 'border-zinc-700',
            glow: '',
        };

    const rate = Math.abs(fpm);

    if (rate < 100)
        return {
            text: 'Butter',
            color: 'text-yellow-400',
            bg: 'bg-gradient-to-br from-yellow-900/30 to-orange-900/30',
            border: 'border-yellow-500/50',
            glow: 'shadow-lg shadow-yellow-500/20',
        };
    if (rate < 300)
        return {
            text: 'Smooth',
            color: 'text-green-400',
            bg: 'bg-gradient-to-br from-green-900/30 to-emerald-900/30',
            border: 'border-green-500/50',
            glow: 'shadow-lg shadow-green-500/20',
        };
    if (rate < 600)
        return {
            text: 'Firm',
            color: 'text-blue-400',
            bg: 'bg-gradient-to-br from-blue-900/30 to-cyan-900/30',
            border: 'border-blue-500/50',
            glow: 'shadow-lg shadow-blue-500/20',
        };
    if (rate < 1000)
        return {
            text: 'Hard',
            color: 'text-orange-400',
            bg: 'bg-gradient-to-br from-orange-900/30 to-red-900/30',
            border: 'border-orange-500/50',
            glow: 'shadow-lg shadow-orange-500/20',
        };
    return {
        text: 'Crash',
        color: 'text-red-400',
        bg: 'bg-gradient-to-br from-red-900/30 to-rose-900/30',
        border: 'border-red-500/50',
        glow: 'shadow-lg shadow-red-500/20',
    };
};

export const getPhaseColor = (phase: string | null | undefined): string => {
    const colors: Record<string, string> = {
        awaiting_clearance: 'text-cyan-400 bg-cyan-900/30',
        origin_taxi: 'text-zinc-400 bg-zinc-900/50',
        destination_taxi: 'text-zinc-400 bg-zinc-900/50',
        taxi: 'text-zinc-400 bg-zinc-900/50',
        origin_runway: 'text-pink-400 bg-pink-900/30',
        destination_runway: 'text-pink-400 bg-pink-900/30',
        runway: 'text-pink-400 bg-pink-900/30',
        climb: 'text-blue-400 bg-blue-900/30',
        cruise: 'text-purple-400 bg-purple-900/30',
        descent: 'text-yellow-400 bg-yellow-900/30',
        approach: 'text-orange-400 bg-orange-900/30',
        landing: 'text-red-400 bg-red-900/30',
        push: 'text-indigo-400 bg-indigo-900/30',
        parked: 'text-slate-400 bg-slate-900/30',
    };
    return colors[phase || ''] || 'text-zinc-400 bg-zinc-900/50';
};

export const calculatePhases = (telemetry: TelemetryPoint[]): Array<{
    phase: string;
    startTime: Date;
    endTime: Date;
    duration: number;
}> => {
    if (!telemetry || telemetry.length < 2) return [];

    const normalizePhase = (phase: string | null | undefined): string => {
        if (!phase) return 'unknown';
        const lower = phase.toLowerCase();
        if (lower.includes('taxi')) return 'taxi';
        if (lower.includes('takeoff')) return 'takeoff';
        if (lower.includes('landing')) return 'landing';
        if (lower.includes('runway')) return 'runway';
        if (lower.includes('climb')) return 'climb';
        if (lower.includes('cruise')) return 'cruise';
        if (lower.includes('descent')) return 'descent';
        if (lower.includes('approach')) return 'approach';
        if (lower.includes('gate') || lower.includes('parked')) return 'gate';
        return lower.replace(/\s+/g, '_');
    };

    const out: Array<{
        phase: string;
        startTime: Date;
        endTime: Date;
        duration: number;
    }> = [];
    let current = normalizePhase(telemetry[0].flight_phase);
    let start = new Date(telemetry[0].timestamp);
    for (let i = 1; i < telemetry.length; i++) {
        const n = normalizePhase(telemetry[i].flight_phase);
        if (n !== current) {
            const end = new Date(telemetry[i - 1].timestamp);
            const dur = Math.round((end.getTime() - start.getTime()) / 60000);
            if (dur >= 1) out.push({ phase: current, startTime: start, endTime: end, duration: dur });
            current = n;
            start = new Date(telemetry[i].timestamp);
        }
    }
    const finalEnd = new Date(telemetry[telemetry.length - 1].timestamp);
    const finalDur = Math.round((finalEnd.getTime() - start.getTime()) / 60000);
    if (finalDur >= 1) out.push({ phase: current, startTime: start, endTime: finalEnd, duration: finalDur });

    const filtered = out.filter((p) => p.phase !== 'unknown');
    const merged: typeof out = [];
    for (const p of filtered) {
        const last = merged[merged.length - 1];
        if (last && last.phase === p.phase) {
            last.endTime = p.endTime;
            last.duration += p.duration;
        } else {
            merged.push({ ...p });
        }
    }
    const last = merged[merged.length - 1];
    if (last && last.phase === 'taxi') {
        merged.push({
            phase: 'gate',
            startTime: last.endTime,
            endTime: last.endTime,
            duration: 0,
        });
    }
    return merged;
};