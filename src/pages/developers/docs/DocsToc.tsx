import { useEffect, useRef } from 'react';
import AdminSearchInput from '../../../components/admin/AdminSearchInput';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MethodLabel } from './DocsPrimitives';

export interface TocItem {
  id: string;
  label?: string;
  method?: string;
  path?: string;
}

export interface TocSection {
  id: string;
  label?: string;
  items: TocItem[];
}

interface TocProps {
  sections: TocSection[];
  activeId: string | null;
  onNavigate: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  emptyLabel?: string;
}

function TocSearch({
  search,
  onSearchChange,
}: Pick<TocProps, 'search' | 'onSearchChange'>) {
  return (
    <AdminSearchInput
      value={search}
      onChange={onSearchChange}
      placeholder="Search endpoints…"
      aria-label="Search API endpoints"
      grow={false}
      className="sm:w-full"
    />
  );
}

export function DocsToc({
  sections,
  activeId,
  onNavigate,
  search,
  onSearchChange,
  emptyLabel,
}: TocProps) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !activeId) return;
    const el = nav.querySelector<HTMLElement>(
      `[data-toc-id="${CSS.escape(activeId)}"]`
    );
    if (!el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < nav.scrollTop || bottom > nav.scrollTop + nav.clientHeight) {
      nav.scrollTo({ top: top - nav.clientHeight / 3 });
    }
  }, [activeId]);

  return (
    <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] flex-col gap-4 self-start lg:flex">
      <TocSearch search={search} onSearchChange={onSearchChange} />
      <nav
        ref={navRef}
        aria-label="API reference"
        className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1 pb-6"
      >
        {sections.map((s, i) => (
          <div key={s.id} className="flex flex-col gap-1">
            {s.label ? (
              <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">
                {s.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {s.items.map((item) => {
                const active = activeId === item.id;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      data-toc-id={item.id}
                      aria-current={active ? 'location' : undefined}
                      onClick={(ev) => {
                        ev.preventDefault();
                        onNavigate(item.id);
                      }}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      {item.method ? (
                        <>
                          <MethodLabel
                            method={item.method}
                            className="w-12 text-[11px]"
                          />
                          <span className="min-w-0 flex-1 truncate font-mono text-xs">
                            {item.path}
                          </span>
                        </>
                      ) : (
                        item.label
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
            {i === 0 && emptyLabel ? (
              <p className="px-2.5 pt-4 text-sm text-muted-foreground">
                {emptyLabel}
              </p>
            ) : null}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function DocsMobileToc({
  sections,
  activeId,
  onNavigate,
  search,
  onSearchChange,
}: TocProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
      <TocSearch search={search} onSearchChange={onSearchChange} />
      <Select value={activeId ?? ''} onValueChange={onNavigate}>
        <SelectTrigger className="w-full min-w-0" aria-label="Jump to section">
          <SelectValue placeholder="Jump to…" />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          {sections.map((s) => (
            <SelectGroup key={s.id}>
              {s.label ? <SelectLabel>{s.label}</SelectLabel> : null}
              {s.items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.method ? (
                    <>
                      <MethodLabel method={item.method} className="w-12" />
                      <span className="truncate font-mono text-xs">
                        {item.path}
                      </span>
                    </>
                  ) : (
                    item.label
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
