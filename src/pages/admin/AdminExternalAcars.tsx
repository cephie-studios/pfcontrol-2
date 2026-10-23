import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader2, Pencil, Plus, Radio, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminSection from '../../components/admin/AdminSection';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { minDuration } from '@/lib/minDuration';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import {
  deleteExternalAcarsProvider,
  fetchExternalAcarsProviders,
  saveExternalAcarsProvider,
  type ExternalAcarsProvider,
} from '../../utils/fetch/admin/externalAcarsProviders';

type FormState = Omit<ExternalAcarsProvider, 'hasHandoffApiKey'> & {
  handoffApiKey: string;
  hasHandoffApiKey: boolean;
};

const emptyForm = (): FormState => ({
  id: '',
  displayName: '',
  apiBaseUrl: '',
  tokenHeader: 'X-Flight-Token',
  handoffUrl: '',
  handoffApiKey: '',
  enabled: true,
  isDefault: false,
  hasHandoffApiKey: false,
});

const formFrom = (provider: ExternalAcarsProvider): FormState => ({
  ...provider,
  handoffApiKey: '',
});

const byName = (a: ExternalAcarsProvider, b: ExternalAcarsProvider) =>
  a.displayName.localeCompare(b.displayName);

function Field({
  id,
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={title}
      />
    </div>
  );
}

export default function AdminExternalAcars() {
  const [providers, setProviders] = useState<ExternalAcarsProvider[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { confirm, confirmDialog } = useAdminConfirm();

  const editing = providers.some((item) => item.id === form.id);

  const load = useCallback(async () => {
    try {
      setProviders((await fetchExternalAcarsProviders()).providers);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load providers'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { provider } = await minDuration(saveExternalAcarsProvider(form));
      setProviders((current) =>
        [...current.filter((item) => item.id !== provider.id), provider].sort(
          byName
        )
      );
      setForm(formFrom(provider));
      toast.success('Provider saved');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save provider'
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (provider: ExternalAcarsProvider) => {
    const deleted = await confirm({
      title: `Delete ${provider.displayName}?`,
      description:
        'Sessions claimed for this provider will fall back to the native ACARS terminal.',
      confirmText: 'Delete',
      destructive: true,
      action: () =>
        deleteExternalAcarsProvider(provider.id).catch((error) => {
          toast.error(
            error instanceof Error ? error.message : 'Could not delete provider'
          );
          throw error;
        }),
    });
    if (!deleted) return;
    setProviders((current) =>
      current.filter((item) => item.id !== provider.id)
    );
    if (form.id === provider.id) setForm(emptyForm());
    toast.success('Provider deleted');
  };

  return (
    <AdminLayout>
      <AdminPage
        title="External ACARS"
        icon={Radio}
        description="Register trusted ACARS providers. PFControl proxies pilot requests to the selected provider, so no browser CORS setup is needed."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_34rem]">
          <AdminSection
            title="Registered providers"
            description="The default provider serves newly claimed sessions."
            actions={
              <Button
                variant="ghost"
                size="sm"
                className={SIGNATURE_TONES.blue}
                onClick={() => setForm(emptyForm())}
              >
                <Plus />
                Add provider
              </Button>
            }
          >
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading providers…
              </div>
            ) : providers.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No provider is configured yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {providers.map((provider) => (
                  <li
                    key={provider.id}
                    className="flex items-center gap-3 rounded-3xl border-2 border-zinc-800 bg-zinc-900 px-4 py-3"
                  >
                    <Radio className="size-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium text-zinc-300">
                        {provider.displayName}
                        {provider.isDefault && (
                          <span className="text-xs font-normal text-blue-400">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="truncate font-mono text-xs text-zinc-500">
                        {provider.id} ·{' '}
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={SIGNATURE_TONES.blue}
                      onClick={() => setForm(formFrom(provider))}
                    >
                      <Pencil />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${provider.displayName}`}
                      title="Delete"
                      className={SIGNATURE_TONES.red}
                      onClick={() => void remove(provider)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </AdminSection>

          <AdminSection
            title={
              editing
                ? `Configure ${form.displayName || form.id}`
                : 'Add provider'
            }
            description="The handoff key is encrypted at rest. Leave it blank when editing to keep the stored key."
          >
            <form onSubmit={save} className="grid gap-4">
              <Field
                id="provider-id"
                label="Provider ID"
                hint="Stable URL identifier. It cannot be changed after saving."
                value={form.id}
                onChange={(event) =>
                  update('id', event.target.value.toLowerCase())
                }
                pattern="[a-z0-9][a-z0-9\-]{0,31}"
                placeholder="external-acars"
                disabled={editing}
                required
              />
              <Field
                id="provider-name"
                label="Display name"
                value={form.displayName}
                onChange={(event) => update('displayName', event.target.value)}
                placeholder="External ACARS"
                maxLength={80}
                required
              />
              <Field
                id="provider-api"
                label="Provider API base URL"
                type="url"
                value={form.apiBaseUrl}
                onChange={(event) => update('apiBaseUrl', event.target.value)}
                placeholder="https://provider.example"
                required
              />
              <Field
                id="provider-header"
                label="Flight token header"
                value={form.tokenHeader}
                onChange={(event) => update('tokenHeader', event.target.value)}
                required
              />
              <Field
                id="provider-handoff"
                label="Handoff URL"
                type="url"
                value={form.handoffUrl}
                onChange={(event) => update('handoffUrl', event.target.value)}
                placeholder="https://provider.example/api/v1/pilot/acars-panel/"
                required
              />
              <Field
                id="provider-key"
                label="Handoff API key"
                type="password"
                value={form.handoffApiKey}
                onChange={(event) =>
                  update('handoffApiKey', event.target.value)
                }
                placeholder={
                  form.hasHandoffApiKey
                    ? 'Stored. Enter a value to replace it'
                    : 'Optional'
                }
                autoComplete="new-password"
              />
              <ToggleRow
                title="Enabled"
                description="Disabled providers cannot receive ACARS traffic."
                checked={form.enabled}
                onCheckedChange={(value) => update('enabled', value)}
              />
              <ToggleRow
                title="Default provider"
                description="Used when an API client claims a session without selecting a provider."
                checked={form.isDefault}
                onCheckedChange={(value) => update('isDefault', value)}
              />
              <Button
                type="submit"
                variant="ghost"
                disabled={saving}
                className={SIGNATURE_TONES.blue}
              >
                {saving && <Loader2 className="animate-spin" />}
                Save provider
              </Button>
            </form>
          </AdminSection>
        </div>
      </AdminPage>
      {confirmDialog}
    </AdminLayout>
  );
}
