import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildDeveloperApiPublicSpec } from '../server/developer/apiDocumentation.js';
import type {
  DeveloperApiDocEndpoint,
  DeveloperApiPublicSpec,
} from '../server/developer/apiDocumentation.js';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

const publicOutputPath = path.join(
  repoRoot,
  'public',
  'developer-api-docs.json'
);
const markdownOutputPath = path.join(
  repoRoot,
  'docs',
  'developer-api.generated.md'
);

function renderParams(
  title: string,
  params:
    | {
        name: string;
        required?: boolean;
        description: string;
        example?: string;
      }[]
    | undefined
): string {
  if (!params?.length) return '';

  const lines = [`**${title}**`, ''];
  for (const param of params) {
    const required =
      param.required === undefined
        ? ''
        : param.required
          ? ' (required)'
          : ' (optional)';
    const example = param.example ? ` e.g. \`${param.example}\`` : '';
    lines.push(
      `- \`${param.name}\`${required}${example}: ${param.description}`
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function renderEndpoint(endpoint: DeveloperApiDocEndpoint): string {
  const sections = [
    `### ${endpoint.title}`,
    '',
    `**Scope:** \`${endpoint.scopeId}\`  `,
    '',
    `- **${endpoint.method}** \`${endpoint.pathTemplate}\``,
    `- **Response:** ${endpoint.responseContentType} — ${endpoint.responseSummary}`,
    '',
    renderParams('Path parameters', endpoint.pathParams),
    renderParams('Query parameters', endpoint.queryParams),
  ];

  if (endpoint.requestBodySummary || endpoint.requestBodyExampleJson) {
    sections.push('**Request body**', '');
    if (endpoint.requestBodySummary)
      sections.push(endpoint.requestBodySummary, '');
    if (endpoint.requestBodyExampleJson) {
      sections.push('```json', endpoint.requestBodyExampleJson, '```', '');
    }
  }

  sections.push('**Example**', '', '```bash', endpoint.exampleCurl, '```', '');
  return sections.filter((section) => section !== '').join('\n');
}

function renderMarkdown(spec: DeveloperApiPublicSpec): string {
  const lines = [
    '# Developer API (generated)',
    '',
    `> Generated at **${spec.generatedAt}**. Do not edit by hand - run \`npm run generate:developer-docs\` or \`npm run build\`.`,
    '',
    '## Overview',
    '',
    spec.description,
    '',
    `- **Base URL pattern:** \`${spec.baseUrlTemplate}\``,
    '',
    '## Authentication',
    '',
    spec.authentication.description,
    '',
    ...spec.authentication.headers.map(
      (header) =>
        `- **${header.name}** (${header.required ? 'required' : 'optional'}): ${header.description}`
    ),
    '',
    '## Rate limiting',
    '',
    spec.rateLimiting.description,
    '',
    `- Default: **${spec.rateLimiting.defaultPerMinute}** requests/minute per key`,
    `- Configure: \`${spec.rateLimiting.envVar}\``,
    '',
    '## Endpoints',
    '',
    ...spec.endpoints.map(renderEndpoint),
  ];

  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

async function main(): Promise<void> {
  const spec = buildDeveloperApiPublicSpec();

  await Promise.all([
    mkdir(path.dirname(publicOutputPath), { recursive: true }),
    mkdir(path.dirname(markdownOutputPath), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(publicOutputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8'),
    writeFile(markdownOutputPath, renderMarkdown(spec), 'utf8'),
  ]);

  console.log(
    '[generate-developer-api-docs] Wrote public/developer-api-docs.json'
  );
  console.log(
    '[generate-developer-api-docs] Wrote docs/developer-api.generated.md'
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
