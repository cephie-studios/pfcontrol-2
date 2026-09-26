import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AdminSelect from './AdminSelect';
import AdminTextInput from './AdminTextInput';
import AdminToggleSwitch from './AdminToggleSwitch';
import { fetchAirports } from '../../utils/fetch/data';
import {
  updateAdminSession,
  type AdminSession,
  type AdminSessionUpdate,
} from '../../utils/fetch/admin';
import type { Airport } from '../../types/airports';

type SessionType = NonNullable<AdminSessionUpdate['type']>;
type ExternalMode = 'default' | 'on' | 'off';

type FormState = {
  type: SessionType;
  airportIcao: string;
  activeRunway: string;
  arrivalRunway: string;
  customName: string;
  feedbackEnabled: boolean;
  external: ExternalMode;
};

function formFromSession(session: AdminSession): FormState {
  return {
    type: session.is_advanced_atc
      ? 'advanced_atc'
      : session.is_pfatc
        ? 'pfatc'
        : 'standard',
    airportIcao: session.airport_icao,
    activeRunway: session.active_runway || '',
    arrivalRunway: session.arrival_runway || '',
    customName: session.custom_name || '',
    feedbackEnabled: session.feedback_enabled ?? true,
    external:
      session.external_session === true
        ? 'on'
        : session.external_session === false
          ? 'off'
          : 'default',
  };
}

function diffForm(initial: FormState, form: FormState): AdminSessionUpdate {
  const patch: AdminSessionUpdate = {};
  if (form.type !== initial.type) patch.type = form.type;
  const airportChanged = form.airportIcao !== initial.airportIcao;
  if (airportChanged) patch.airportIcao = form.airportIcao;
  if (airportChanged || form.activeRunway !== initial.activeRunway) {
    patch.activeRunway = form.activeRunway;
  }
  if (airportChanged || form.arrivalRunway !== initial.arrivalRunway) {
    patch.arrivalRunway = form.arrivalRunway || null;
  }
  if (form.customName !== initial.customName) {
    patch.customName = form.customName;
  }
  if (form.feedbackEnabled !== initial.feedbackEnabled) {
    patch.feedbackEnabled = form.feedbackEnabled;
  }
  if (form.external !== initial.external) {
    patch.externalSession =
      form.external === 'on' ? true : form.external === 'off' ? false : null;
  }
  return patch;
}

const EXTERNAL_OPTIONS = [
  { value: 'default', label: 'Default (unset)' },
  { value: 'on', label: 'External ACARS on' },
  { value: 'off', label: 'External ACARS off' },
];

type AdminSessionEditorProps = {
  session: AdminSession;
  onSaved: (updated: Partial<AdminSession>) => void;
  onError: (message: string) => void;
};

export default function AdminSessionEditor({
  session,
  onSaved,
  onError,
}: AdminSessionEditorProps) {
  const initial = useMemo(() => formFromSession(session), [session]);
  const [form, setForm] = useState(initial);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initial), [initial]);

  useEffect(() => {
    fetchAirports().then(setAirports);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const typeOptions = [
    { value: 'standard', label: 'Standard' },
    { value: 'pfatc', label: 'PFATC' },
    {
      value: 'advanced_atc',
      label: 'Advanced ATC',
      disabled: initial.type !== 'advanced_atc',
    },
  ];

  const airportOptions = useMemo(() => {
    const opts = airports.map((a) => ({
      value: a.icao,
      label: `${a.icao} — ${a.name}`,
    }));
    if (!opts.some((o) => o.value === form.airportIcao)) {
      opts.unshift({ value: form.airportIcao, label: form.airportIcao });
    }
    return opts;
  }, [airports, form.airportIcao]);

  const runwayOptions = useMemo(() => {
    const runways =
      airports.find((a) => a.icao === form.airportIcao)?.runways ?? [];
    const values = new Set<string>(runways);
    if (form.airportIcao === initial.airportIcao) {
      if (initial.activeRunway) values.add(initial.activeRunway);
      if (initial.arrivalRunway) values.add(initial.arrivalRunway);
    }
    return [...values].map((r) => ({ value: r, label: r }));
  }, [airports, form.airportIcao, initial]);

  const handleAirportChange = (icao: string) => {
    if (!icao || icao === form.airportIcao) return;
    const runways = airports.find((a) => a.icao === icao)?.runways ?? [];
    setForm((f) => ({
      ...f,
      airportIcao: icao,
      activeRunway: runways.includes(f.activeRunway) ? f.activeRunway : '',
      arrivalRunway: runways.includes(f.arrivalRunway) ? f.arrivalRunway : '',
    }));
  };

  const patch = diffForm(initial, form);
  const dirty = Object.keys(patch).length > 0;
  const canSave = dirty && !!form.activeRunway && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      const updated = await updateAdminSession(session.session_id, patch);
      onSaved(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Session type</Label>
          <AdminSelect
            options={typeOptions}
            value={form.type}
            onChange={(v) => set('type', v as SessionType)}
            aria-label="Session type"
            className="sm:w-full"
          />
        </div>
        <div className="grid gap-2">
          <Label>Airport</Label>
          <AdminSelect
            options={airportOptions}
            value={form.airportIcao}
            onChange={handleAirportChange}
            searchable
            searchPlaceholder="Search airports…"
            aria-label="Airport"
            className="sm:w-full"
          />
        </div>
        <div className="grid gap-2">
          <Label>Departure runway</Label>
          <AdminSelect
            options={runwayOptions}
            value={form.activeRunway}
            onChange={(v) => set('activeRunway', v)}
            placeholder="Select runway…"
            aria-label="Departure runway"
            className="sm:w-full"
          />
        </div>
        <div className="grid gap-2">
          <Label>Arrival runway</Label>
          <AdminSelect
            options={[{ value: '', label: 'None' }, ...runwayOptions]}
            value={form.arrivalRunway}
            onChange={(v) => set('arrivalRunway', v)}
            aria-label="Arrival runway"
            className="sm:w-full"
          />
        </div>
        <AdminTextInput
          label="Custom name"
          value={form.customName}
          onChange={(v) => set('customName', v.slice(0, 50))}
          placeholder="None"
        />
        <div className="grid gap-2">
          <Label>External ACARS</Label>
          <AdminSelect
            options={EXTERNAL_OPTIONS}
            value={form.external}
            onChange={(v) => set('external', v as ExternalMode)}
            aria-label="External ACARS"
            className="sm:w-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Pilot feedback</p>
          <p className="text-sm text-muted-foreground">
            Allow pilots to leave feedback for this session
          </p>
        </div>
        <AdminToggleSwitch
          checked={form.feedbackEnabled}
          onChange={() => set('feedbackEnabled', !form.feedbackEnabled)}
          aria-label="Toggle pilot feedback"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForm(initial)}
          disabled={!dirty || saving}
        >
          <RotateCcw />
          Reset
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave}>
          <Save />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
