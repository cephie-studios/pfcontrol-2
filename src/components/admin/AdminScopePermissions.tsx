import { useMemo } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type {
  AdminDeveloperKeyRow,
  AdminScopeCatalogEntry,
} from '../../utils/fetch/adminDevelopers';

export type ScopeAccess = 'off' | 'allowed' | 'all';

function scopeAccess(
  id: string,
  allowed: Set<string>,
  allKeys: Set<string>
): ScopeAccess {
  if (allKeys.has(id)) return 'all';
  if (allowed.has(id)) return 'allowed';
  return 'off';
}

const ACCESS_HELP: {
  value: ScopeAccess;
  label: string;
  help: string;
  dot: string;
  active: string;
}[] = [
  {
    value: 'off',
    label: 'Off',
    help: 'No key can use it.',
    dot: 'bg-red-500',
    active:
      'data-[spacing=0]:data-[state=on]:bg-red-600 data-[spacing=0]:data-[state=on]:hover:bg-red-600 data-[spacing=0]:data-[state=on]:hover:text-white dark:data-[spacing=0]:data-[state=on]:hover:bg-red-500 data-[spacing=0]:data-[state=on]:font-semibold data-[spacing=0]:data-[state=on]:text-white data-[spacing=0]:data-[state=on]:shadow-md dark:data-[spacing=0]:data-[state=on]:bg-red-500',
  },
  {
    value: 'allowed',
    label: 'Allowed',
    help: 'Can be turned on per key (Keys tab, or by the developer).',
    dot: 'bg-emerald-500',
    active:
      'data-[spacing=0]:data-[state=on]:bg-emerald-600 data-[spacing=0]:data-[state=on]:hover:bg-emerald-600 data-[spacing=0]:data-[state=on]:hover:text-white dark:data-[spacing=0]:data-[state=on]:hover:bg-emerald-500 data-[spacing=0]:data-[state=on]:font-semibold data-[spacing=0]:data-[state=on]:text-white data-[spacing=0]:data-[state=on]:shadow-md dark:data-[spacing=0]:data-[state=on]:bg-emerald-500',
  },
  {
    value: 'all',
    label: 'All keys',
    help: 'Every key has it automatically, including keys created later.',
    dot: 'bg-blue-500',
    active:
      'data-[spacing=0]:data-[state=on]:bg-blue-600 data-[spacing=0]:data-[state=on]:hover:bg-blue-600 data-[spacing=0]:data-[state=on]:hover:text-white dark:data-[spacing=0]:data-[state=on]:hover:bg-blue-500 data-[spacing=0]:data-[state=on]:font-semibold data-[spacing=0]:data-[state=on]:text-white data-[spacing=0]:data-[state=on]:shadow-md dark:data-[spacing=0]:data-[state=on]:bg-blue-500',
  },
];

function groupLabel(group: string) {
  const text = group.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Props = {
  catalog: AdminScopeCatalogEntry[];
  allowed: Set<string>;
  allKeys: Set<string>;
  savedAllowed: Set<string>;
  savedAllKeys: Set<string>;
  keys: AdminDeveloperKeyRow[];
  onChange: (allowed: Set<string>, allKeys: Set<string>) => void;
  disabled?: boolean;
};

export default function AdminScopePermissions({
  catalog,
  allowed,
  allKeys,
  savedAllowed,
  savedAllKeys,
  keys,
  onChange,
  disabled,
}: Props) {
  const activeKeys = useMemo(
    () => keys.filter((k) => k.status === 'active' && !k.revokedAt),
    [keys]
  );

  const groups = useMemo(() => {
    const m = new Map<string, AdminScopeCatalogEntry[]>();
    for (const c of [...catalog].sort((a, b) => a.id.localeCompare(b.id))) {
      const g = c.id.split('.')[0] ?? 'other';
      m.set(g, [...(m.get(g) ?? []), c]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const setAccess = (id: string, next: ScopeAccess) => {
    const a = new Set(allowed);
    const all = new Set(allKeys);
    a.delete(id);
    all.delete(id);
    if (next !== 'off') a.add(id);
    if (next === 'all') all.add(id);
    onChange(a, all);
  };

  const keysWith = (id: string) =>
    activeKeys.filter((k) => k.scopes.includes(id)).length;

  function usageText(id: string, access: ScopeAccess) {
    const total = activeKeys.length;
    if (access === 'all')
      return total === 1 ? 'on the 1 key' : `on all ${total} keys`;
    if (access === 'off') return null;
    const n = keysWith(id);
    return `on ${n} of ${total} key${total === 1 ? '' : 's'}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-xs sm:grid-cols-3">
        {ACCESS_HELP.map((a) => (
          <div key={a.value} className="grid gap-0.5">
            <dt className="flex items-center gap-1.5 font-medium text-foreground">
              <span className={cn('size-2 rounded-full', a.dot)} aria-hidden />
              {a.label}
            </dt>
            <dd className="text-muted-foreground">{a.help}</dd>
          </div>
        ))}
      </dl>

      {groups.map(([group, entries]) => (
        <section key={group} className="grid gap-1">
          <h3 className="px-1 text-xs font-medium text-muted-foreground">
            {groupLabel(group)}
          </h3>
          <ul className="grid gap-2 lg:grid-cols-2">
            {entries.map((c) => {
              const access = scopeAccess(c.id, allowed, allKeys);
              const saved = scopeAccess(c.id, savedAllowed, savedAllKeys);
              const changed = access !== saved;
              const losing = access === 'off' ? keysWith(c.id) : 0;
              const usage = usageText(c.id, access);
              return (
                <li
                  key={c.id}
                  className={cn(
                    '@container rounded-xl border',
                    changed && 'border-amber-500/40 bg-amber-500/5'
                  )}
                >
                  <div className="flex h-full flex-col gap-2 px-3 py-2.5 @sm:flex-row @sm:items-center @sm:gap-3">
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {c.label}
                        </span>
                        {c.hidden ? (
                          <Badge variant="outline" className="gap-1">
                            <ShieldCheck aria-hidden />
                            Admin-only
                          </Badge>
                        ) : null}
                        {changed ? (
                          <Badge variant="secondary">Unsaved</Badge>
                        ) : null}
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {c.id}
                      </p>
                      {c.hidden ? (
                        <p className="text-xs text-muted-foreground">
                          Developers can&apos;t turn this on. Add it per key on
                          the Keys tab, or use All keys.
                        </p>
                      ) : null}
                      {losing > 0 ? (
                        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3" aria-hidden />
                          Will be removed from {losing} key
                          {losing === 1 ? '' : 's'}
                        </p>
                      ) : usage ? (
                        <p className="text-xs text-muted-foreground">{usage}</p>
                      ) : null}
                    </div>
                    <ToggleGroup
                      type="single"
                      value={access}
                      disabled={disabled}
                      onValueChange={(v) => {
                        if (v) setAccess(c.id, v as ScopeAccess);
                      }}
                      aria-label={`Access for ${c.label}`}
                      className="w-full shrink-0 @sm:w-auto"
                    >
                      {ACCESS_HELP.map((a) => (
                        <ToggleGroupItem
                          key={a.value}
                          value={a.value}
                          className={cn('text-xs', a.active)}
                        >
                          {c.hidden && a.value === 'allowed'
                            ? 'Per key'
                            : a.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
