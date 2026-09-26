import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AlertTriangle,
  BookOpen,
  Cable,
  FileCode2,
  Globe,
  History,
  KeyRound,
  SearchX,
} from 'lucide-react';
import type { DeveloperApiPublicSpec } from '../../types/developerApiSpec';
import { fetchDeveloperApiDocs } from '../../utils/fetch/developer';
import SettingsSection from '../../components/Settings/SettingsSection';
import SettingsGroup from '../../components/Settings/SettingsGroup';
import SettingsRow from '../../components/Settings/SettingsRow';
import { AdminLoading } from '../../components/admin/AdminStates';
import { Button } from '@/components/ui/button';
import {
  endpointAnchorId,
  endpointMatchesQuery,
  groupEndpoints,
  websocketAnchorId,
} from './docs/docsSpec';
import { CopyButton } from './docs/DocsPrimitives';
import { EndpointBlock, WebSocketBlock } from './docs/EndpointBlock';
import { DocsMobileToc, DocsToc, type TocSection } from './docs/DocsToc';
import { renderInlineCode } from './docs/highlight';

const noopSubscribe = () => () => {};

function GeneratedAt({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  return (
    <time dateTime={iso}>
      {isClient ? new Date(iso).toLocaleString() : iso.slice(0, 10)}
    </time>
  );
}

function scrollToAnchor(id: string, behavior: ScrollBehavior) {
  document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' });
}

interface DeveloperDocsProps {
  initialSpec?: DeveloperApiPublicSpec | null;
}

export default function DeveloperDocs({
  initialSpec,
}: DeveloperDocsProps = {}) {
  const [spec, setSpec] = useState<DeveloperApiPublicSpec | null>(
    initialSpec ?? null
  );
  const [loading, setLoading] = useState(!initialSpec);
  const [err, setErr] = useState<string | null>(null);
  const [endpointSearch, setEndpointSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const hashHandledRef = useRef(false);

  useEffect(() => {
    if (initialSpec) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const s = await fetchDeveloperApiDocs();
        if (!cancelled) setSpec(s);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : 'Failed to load API docs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialSpec]);

  const endpointQuery = endpointSearch.trim().toLowerCase();
  const filteredEndpoints = useMemo(() => {
    if (!spec) return [];
    if (!endpointQuery) return spec.endpoints;
    return spec.endpoints.filter((e) => endpointMatchesQuery(e, endpointQuery));
  }, [spec, endpointQuery]);

  const groups = useMemo(
    () => groupEndpoints(filteredEndpoints),
    [filteredEndpoints]
  );

  const tocSections = useMemo<TocSection[]>(() => {
    const sections: TocSection[] = [
      {
        id: 'intro',
        items: [
          { id: 'overview', label: 'Overview' },
          { id: 'auth', label: 'Authentication & limits' },
        ],
      },
      ...groups.map((g) => ({
        id: g.id,
        label: g.label,
        items: g.items.map((e) => ({
          id: endpointAnchorId(e),
          method: e.method,
          path: e.pathTemplate,
        })),
      })),
    ];
    if (spec && spec.websockets.length > 0) {
      sections.push({
        id: 'websockets',
        label: 'WebSockets',
        items: spec.websockets.map((ws) => ({
          id: websocketAnchorId(ws),
          method: 'WS',
          path: ws.path,
        })),
      });
    }
    return sections;
  }, [groups, spec]);

  const observedIds = useMemo(
    () => tocSections.flatMap((s) => s.items.map((i) => i.id)),
    [tocSections]
  );

  const goTo = (id: string) => {
    setActiveId(id);
    scrollToAnchor(id, 'smooth');
    window.history.replaceState(null, '', `#${id}`);
  };

  useEffect(() => {
    if (!spec || hashHandledRef.current) return;
    hashHandledRef.current = true;
    const id = window.location.hash.slice(1);
    const known =
      id === 'overview' ||
      id === 'auth' ||
      id === 'websockets' ||
      spec.endpoints.some((e) => endpointAnchorId(e) === id) ||
      spec.websockets.some((ws) => websocketAnchorId(ws) === id);
    if (!known) return;
    setActiveId(id);
    scrollToAnchor(id, 'auto');
  }, [spec]);

  useEffect(() => {
    if (observedIds.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((en) => en.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-104px 0px -70% 0px', threshold: 0 }
    );
    for (const id of observedIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [observedIds]);

  if (loading) return <AdminLoading label="Loading documentation…" />;

  if (err || !spec) {
    return (
      <SettingsGroup>
        <SettingsRow
          icon={<AlertTriangle className="text-amber-400" />}
          label={err ?? 'Failed to load API docs'}
          description={
            <>
              Fallback: open{' '}
              <a
                href="/developer-api-docs.json"
                className="font-mono text-blue-400 hover:underline"
              >
                /developer-api-docs.json
              </a>{' '}
              from the last build.
            </>
          }
        />
      </SettingsGroup>
    );
  }

  const noMatches = Boolean(endpointQuery) && groups.length === 0;
  const tocProps = {
    sections: tocSections,
    activeId,
    onNavigate: goTo,
    search: endpointSearch,
    onSearchChange: setEndpointSearch,
  };

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-10 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <DocsToc
        {...tocProps}
        emptyLabel={noMatches ? 'No matching endpoints.' : undefined}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <DocsMobileToc {...tocProps} />

        <div id="overview" className="scroll-mt-24">
          <SettingsSection title="Overview" icon={BookOpen}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {renderInlineCode(spec.description)}
            </p>
            <SettingsGroup>
              <SettingsRow
                icon={<Globe className="text-blue-400" />}
                label="Base URL"
                description={
                  <code className="font-mono break-all text-foreground">
                    {spec.baseUrlTemplate}
                  </code>
                }
              >
                <CopyButton text={spec.baseUrlTemplate} label="Copy base URL" />
              </SettingsRow>
              {spec.legacyBaseUrlTemplate ? (
                <SettingsRow
                  icon={<History className="text-muted-foreground" />}
                  label="Legacy base URL"
                  description={
                    <>
                      <code className="font-mono break-all text-foreground">
                        {spec.legacyBaseUrlTemplate}
                      </code>{' '}
                      serves everything except endpoints marked{' '}
                      <span className="text-emerald-400">v2+ only</span>.
                    </>
                  }
                >
                  <CopyButton
                    text={spec.legacyBaseUrlTemplate}
                    label="Copy legacy base URL"
                  />
                </SettingsRow>
              ) : null}
              <SettingsRow
                icon={<FileCode2 className="text-blue-400" />}
                label={`Spec v${spec.specVersion}`}
                description={
                  <>
                    Generated <GeneratedAt iso={spec.generatedAt} />
                  </>
                }
              />
            </SettingsGroup>
          </SettingsSection>
        </div>

        <div id="auth" className="scroll-mt-24">
          <SettingsSection title="Authentication & limits" icon={KeyRound}>
            <SettingsGroup>
              <SettingsRow
                label="API key"
                description={renderInlineCode(spec.authentication.description)}
              />
              {spec.authentication.headers.map((h) => (
                <SettingsRow
                  key={h.name}
                  label={<code className="font-mono">{h.name}</code>}
                  description={renderInlineCode(h.description)}
                />
              ))}
            </SettingsGroup>
            <SettingsGroup>
              <SettingsRow
                label={`${spec.rateLimiting.defaultPerMinute} requests per minute by default`}
                description={spec.rateLimiting.description}
              />
            </SettingsGroup>
          </SettingsSection>
        </div>

        {noMatches ? (
          <SettingsGroup>
            <SettingsRow
              icon={<SearchX className="text-muted-foreground" />}
              label={`No endpoints match "${endpointSearch.trim()}"`}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEndpointSearch('')}
              >
                Clear search
              </Button>
            </SettingsRow>
          </SettingsGroup>
        ) : (
          groups.map((g) => (
            <div key={g.id} id={`group-${g.id}`} className="scroll-mt-24">
              <SettingsSection
                title={g.label}
                icon={g.icon}
                actions={
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {g.items.length}
                  </span>
                }
              >
                {g.items.map((e) => {
                  const id = endpointAnchorId(e);
                  return <EndpointBlock key={id} e={e} anchorId={id} />;
                })}
              </SettingsSection>
            </div>
          ))
        )}

        {spec.websockets.length > 0 ? (
          <div id="websockets" className="scroll-mt-24">
            <SettingsSection
              title="WebSockets"
              icon={Cable}
              actions={
                <span className="text-sm text-muted-foreground tabular-nums">
                  {spec.websockets.length}
                </span>
              }
            >
              {spec.websockets.map((ws) => {
                const id = websocketAnchorId(ws);
                return <WebSocketBlock key={id} ws={ws} anchorId={id} />;
              })}
            </SettingsSection>
          </div>
        ) : null}
      </div>
    </div>
  );
}
