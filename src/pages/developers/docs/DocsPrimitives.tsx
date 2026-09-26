import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { highlightBash, highlightJson } from './highlight';
import { methodTextClass } from './docsSpec';

export function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          className={cn(
            'text-muted-foreground hover:text-foreground',
            className
          )}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            // Radix closes the tooltip on click unless the event is prevented.
            e.preventDefault();
            void copy();
          }}
        >
          {copied ? <Check className="text-emerald-400" /> : <Copy />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied' : label}</TooltipContent>
    </Tooltip>
  );
}

export function MethodLabel({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'shrink-0 font-mono text-xs font-semibold',
        methodTextClass(method),
        className
      )}
    >
      {method.toUpperCase()}
    </span>
  );
}

function prettyJson(code: string): string {
  try {
    return JSON.stringify(JSON.parse(code), null, 2);
  } catch {
    return code;
  }
}

export function CodeBlock({
  label,
  code,
  language,
}: {
  label: string;
  code: string;
  language: 'bash' | 'json' | 'text';
}) {
  const shown = language === 'json' ? prettyJson(code) : code;
  const highlighted =
    language === 'json'
      ? highlightJson(shown)
      : language === 'bash'
        ? highlightBash(shown)
        : shown;
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-muted/50">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 pr-2 pl-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <CopyButton text={shown} />
      </div>
      <pre
        className={cn(
          'overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground/90 sm:text-[13px]',
          language === 'bash'
            ? 'break-all whitespace-pre-wrap'
            : 'whitespace-pre'
        )}
      >
        <code>{highlighted}</code>
      </pre>
    </div>
  );
}

export function DocsTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  if (rows.length === 0) return null;
  return (
    <Table className="min-w-[36rem]">
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          {columns.map((c) => (
            <TableHead
              key={c}
              className="h-10 px-3 text-xs font-medium text-muted-foreground first:pl-5 last:pr-5"
            >
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key} className="hover:bg-muted/30">
            {row.cells.map((cell, i) => (
              <TableCell
                key={i}
                className={cn(
                  'px-3 py-3 align-top first:pl-5 last:pr-5',
                  i === row.cells.length - 1
                    ? 'w-full min-w-64 whitespace-normal text-muted-foreground'
                    : 'whitespace-nowrap'
                )}
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
