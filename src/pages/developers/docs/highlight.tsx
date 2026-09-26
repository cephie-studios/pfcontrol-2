import type { ReactNode } from 'react';

function tokenize(
  source: string,
  regex: RegExp,
  classes: (string | undefined)[]
): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source))) {
    if (m.index > last) parts.push(source.slice(last, m.index));
    const group = m.findIndex((g, i) => i > 0 && g !== undefined);
    parts.push(
      <span key={key++} className={classes[group - 1]}>
        {m[0]}
      </span>
    );
    last = regex.lastIndex;
  }
  if (last < source.length) parts.push(source.slice(last));
  return parts;
}

export function highlightBash(cmd: string): ReactNode[] {
  return tokenize(cmd, /("(?:[^"\\]|\\.)*")|(\s-{1,2}[A-Za-z-]+)|(^curl\b)/g, [
    'text-emerald-400',
    'text-blue-400',
    'font-medium text-purple-400',
  ]);
}

export function highlightJson(json: string): ReactNode[] {
  return tokenize(
    json,
    /("(?:[^"\\]|\\.)*"(?=\s*:))|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?)/g,
    ['text-blue-300', 'text-emerald-400', 'text-purple-400', 'text-amber-400']
  );
}

export function renderInlineCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
      <code key={i} className="font-mono text-[0.9em] text-foreground">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    )
  );
}
