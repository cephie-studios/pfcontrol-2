import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type {
  DeveloperApiDocEndpoint,
  DeveloperApiDocWebsocket,
} from '../../../types/developerApiSpec';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CodeBlock,
  CopyButton,
  DocsTable,
  MethodLabel,
} from './DocsPrimitives';
import { renderInlineCode } from './highlight';

const EXAMPLE_HOST = 'https://your-host.example.com';

function BlockHeader({
  title,
  scopeId,
  method,
  path,
  badge,
  children,
}: {
  title: string;
  scopeId: string;
  method: string;
  path: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <code className="font-mono text-xs text-muted-foreground">
          {scopeId}
        </code>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <MethodLabel method={method} />
        <code className="min-w-0 font-mono text-sm font-medium break-all">
          {path}
        </code>
        <CopyButton text={path} label="Copy path" />
        {badge}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

function RequiredLabel({ required }: { required: boolean }) {
  return required ? (
    <span className="text-xs text-amber-400">Required</span>
  ) : (
    <span className="text-xs text-muted-foreground">Optional</span>
  );
}

function ParamIn({ value }: { value: string }) {
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

function ParamName({ name }: { name: string }) {
  return <code className="font-mono text-xs text-foreground">{name}</code>;
}

function withExample(description: string, example?: string): ReactNode {
  return (
    <>
      {renderInlineCode(description)}
      {example ? (
        <>
          {' '}
          e.g. <code className="font-mono text-foreground">{example}</code>
        </>
      ) : null}
    </>
  );
}

export function EndpointBlock({
  e,
  anchorId,
}: {
  e: DeveloperApiDocEndpoint;
  anchorId: string;
}) {
  const base = import.meta.env.VITE_SERVER_URL || EXAMPLE_HOST;
  const curl = e.exampleCurl.replace(EXAMPLE_HOST, base);

  const paramRows = [
    ...(e.pathParams ?? []).map((p) => ({
      key: `path:${p.name}`,
      cells: [
        <ParamName name={p.name} />,
        <ParamIn value="path" />,
        <RequiredLabel required />,
        withExample(p.description, p.example),
      ],
    })),
    ...(e.queryParams ?? []).map((q) => ({
      key: `query:${q.name}`,
      cells: [
        <ParamName name={q.name} />,
        <ParamIn value="query" />,
        <RequiredLabel required={q.required} />,
        withExample(q.description, q.example),
      ],
    })),
    ...e.requestHeaders.map((h) => ({
      key: `header:${h.name}`,
      cells: [
        <ParamName name={h.name} />,
        <ParamIn value="header" />,
        <RequiredLabel required={h.required} />,
        renderInlineCode(h.description),
      ],
    })),
  ];

  return (
    <article
      id={anchorId}
      className="scroll-mt-24 divide-y overflow-hidden rounded-2xl border bg-card"
    >
      <BlockHeader
        title={e.title}
        scopeId={e.scopeId}
        method={e.method}
        path={e.pathTemplate}
        badge={
          e.availableSince > 1 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default text-xs text-emerald-400">
                  v{e.availableSince}+ only
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Not available on the legacy base URL
              </TooltipContent>
            </Tooltip>
          ) : null
        }
      >
        {renderInlineCode(e.responseSummary)} Returns{' '}
        <code className="font-mono text-foreground">
          {e.responseContentType}
        </code>
        .
      </BlockHeader>

      {paramRows.length > 0 ? (
        <DocsTable
          columns={['Parameter', 'In', 'Required', 'Description']}
          rows={paramRows}
        />
      ) : null}

      <div className="flex flex-col gap-3 px-5 py-4">
        {e.requestBodySummary ? (
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-medium">Request body</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {renderInlineCode(e.requestBodySummary)}
            </p>
          </div>
        ) : null}
        {e.requestBodyExampleJson ? (
          <CodeBlock
            label="Request body"
            code={e.requestBodyExampleJson}
            language="json"
          />
        ) : null}
        <CodeBlock label="cURL" code={curl} language="bash" />
      </div>
    </article>
  );
}

export function WebSocketBlock({
  ws,
  anchorId,
}: {
  ws: DeveloperApiDocWebsocket;
  anchorId: string;
}) {
  const eventRows = ws.events.map((ev) => {
    const toClient = ev.direction === 'server-to-client';
    const Icon = toClient ? ArrowDownLeft : ArrowUpRight;
    return {
      key: ev.name,
      cells: [
        <ParamName name={ev.name} />,
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5 text-blue-400" aria-hidden />
          {toClient ? 'Server to client' : 'Client to server'}
        </span>,
        renderInlineCode(ev.description),
      ],
    };
  });

  return (
    <article
      id={anchorId}
      className="scroll-mt-24 divide-y overflow-hidden rounded-2xl border bg-card"
    >
      <BlockHeader
        title={ws.title}
        scopeId={ws.scopeId}
        method="WS"
        path={ws.path}
      >
        {renderInlineCode(ws.description)}
      </BlockHeader>

      <div className="flex flex-col gap-1 px-5 py-4">
        <h4 className="text-sm font-medium">Authentication</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {renderInlineCode(ws.authentication)}
        </p>
      </div>

      <DocsTable
        columns={['Event', 'Direction', 'Description']}
        rows={eventRows}
      />

      <div className="px-5 py-4">
        <CodeBlock
          label="Node / socket.io-client"
          code={ws.exampleCode}
          language="text"
        />
      </div>
    </article>
  );
}
