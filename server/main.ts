import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync } from 'fs';
import express from 'express';
import type { RequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes/index.js';
import dotenv from 'dotenv';
import http from 'http';
import chalk from 'chalk';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

import { setupSessionUsersWebsocket } from './websockets/sessionUsersWebsocket.js';
import { setupChatWebsocket } from './websockets/chatWebsocket.js';
import { setupGlobalChatWebsocket } from './websockets/globalChatWebsocket.js';
import { setupFlightsWebsocket } from './websockets/flightsWebsocket.js';
import { setupOverviewWebsocket } from './websockets/overviewWebsocket.js';
import { setupArrivalsWebsocket } from './websockets/arrivalsWebsocket.js';
import { setupSectorControllerWebsocket } from './websockets/sectorControllerWebsocket.js';
import { setupVoiceChatWebsocket } from './websockets/voiceChatWebsocket.js';
import { setupNotificationsWebsocket } from './websockets/notificationsWebsocket.js';

import { startStatsFlushing } from './utils/statisticsCache.js';
import { updateLeaderboard } from './db/leaderboard.js';
import { startFlightLogsCleanup } from './db/flightLogs.js';
import { apiLogger, cleanupOldApiLogs } from './middleware/apiLogger.js';
import { httpErrorHandler } from './middleware/httpErrorHandler.js';
import { updateAppVersion } from './db/version.js';
import { readFileSync } from 'fs';
import { cleanupOldDeveloperUsage } from './db/developer.js';
import posthogClient, { initTelemetry } from './utils/posthog.js';
import { setupExpressErrorHandler } from 'posthog-node';

dotenv.config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env.development',
});
initTelemetry();
console.log(chalk.bgBlue('NODE_ENV:'), process.env.NODE_ENV);
const requiredEnv = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'FRONTEND_URL',
  'JWT_SECRET',
  'POSTGRES_DB_URL',
  'REDIS_URL',
  'PORT',
];
const missingEnv = requiredEnv.filter(
  (key) => !process.env[key] || process.env[key] === ''
);
if (missingEnv.length > 0) {
  console.error(
    'Missing required environment variables:',
    missingEnv.join(', ')
  );
  process.exit(1);
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 9901;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const astroEntryCandidates = [
  path.join(__dirname, '../astro/dist/server/entry.mjs'),
  path.join(__dirname, '../../astro/dist/server/entry.mjs'),
];
const astroEntryPath = astroEntryCandidates.find((p) => existsSync(p)) ?? null;
const astroClientDir = astroEntryPath
  ? path.resolve(path.dirname(astroEntryPath), '..', 'client')
  : null;

let astroHandler: RequestHandler | null = null;
if (astroEntryPath) {
  try {
    const { handler } = (await import(pathToFileURL(astroEntryPath).href)) as {
      handler: RequestHandler;
    };
    astroHandler = handler;
    console.log(
      chalk.green.bold('[Astro] SSR enabled'),
      chalk.green('— middleware loaded from'),
      chalk.cyan(path.relative(process.cwd(), astroEntryPath) || astroEntryPath)
    );
    if (astroClientDir && existsSync(astroClientDir)) {
      console.log(
        chalk.green.bold('[Astro] Static assets'),
        chalk.green('—'),
        chalk.cyan(
          path.relative(process.cwd(), astroClientDir) || astroClientDir
        )
      );
    } else if (astroClientDir) {
      console.warn(
        chalk.yellow('[Astro] Expected client bundle missing (no styles?) at'),
        chalk.yellow(astroClientDir)
      );
    }
  } catch (err) {
    console.warn(
      chalk.yellow.bold('[Astro] SSR disabled'),
      chalk.yellow('— failed to import handler:'),
      err
    );
  }
} else {
  console.warn(
    chalk.yellow.bold('[Astro] SSR disabled'),
    chalk.yellow('— no build at astro/dist/server/entry.mjs (run'),
    chalk.cyan('npm run build:astro'),
    chalk.yellow('). Checked:')
  );
  for (const p of astroEntryCandidates) {
    console.warn(chalk.gray('   ·'), p);
  }
  console.warn(
    chalk.gray(
      'Use the API port (e.g. http://localhost:9901/) for SSR pages — Vite on :5173 always serves the React SPA.'
    )
  );
}

const app = express();

app.set('trust proxy', 1);
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://pfcontrol.com', 'https://canary.pfcontrol.com']
        : ['http://localhost:9901', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Api-Key',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Allow-Credentials',
    ],
  })
);

const developerApiCorsOrigins = (process.env.DEVELOPER_API_CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (developerApiCorsOrigins.length > 0) {
  app.use(
    '/api/ext',
    cors({
      origin: developerApiCorsOrigins,
      credentials: false,
      methods: ['GET', 'HEAD', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'X-Api-Key', 'Content-Type', 'Accept'],
    })
  );
}
app.use(cookieParser());
app.use(express.json());

app.use(apiLogger());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname, '../public')));
app.use(
  express.static(path.join(__dirname, '..', '..', 'dist'), {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js'))
        res.setHeader('Content-Type', 'application/javascript');
    },
  })
);

if (astroClientDir && existsSync(astroClientDir)) {
  app.use(
    express.static(astroClientDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css'))
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
        if (filePath.endsWith('.js'))
          res.setHeader(
            'Content-Type',
            'application/javascript; charset=utf-8'
          );
      },
    })
  );
}

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!req.path.startsWith('/_astro/')) return next();
  res
    .status(404)
    .type('text/plain')
    .send(
      'Astro client chunk not found. Try a hard refresh (Ctrl+Shift+R) or clear site data for this host — your page may reference an old deploy.'
    );
});

if (astroHandler) {
  app.use((req, res, next) => {
    if (req.query['tutorial'] === 'true') return next();
    astroHandler!(req, res, next);
  });
}

app.get('/{*any}', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
});

setupExpressErrorHandler(posthogClient, app);
app.use(httpErrorHandler);

const server = http.createServer(app);
server.setMaxListeners(25);

// Redis pub/sub adapter to join sessions locally that are connected to different server instances e.g. production
const pubClient = new Redis(process.env.REDIS_URL!);
const subClient = pubClient.duplicate();

const sessionUsersIO = setupSessionUsersWebsocket(server);
sessionUsersIO.adapter(createAdapter(pubClient, subClient));

const chatIO = setupChatWebsocket(server, sessionUsersIO);
chatIO.adapter(createAdapter(pubClient, subClient));

const globalChatIO = setupGlobalChatWebsocket(server, sessionUsersIO);
globalChatIO.adapter(createAdapter(pubClient, subClient));

const flightsIO = setupFlightsWebsocket(server);
flightsIO.adapter(createAdapter(pubClient, subClient));

const overviewIO = setupOverviewWebsocket(server, sessionUsersIO);
overviewIO.adapter(createAdapter(pubClient, subClient));

const arrivalsIO = setupArrivalsWebsocket(server);
arrivalsIO.adapter(createAdapter(pubClient, subClient));

const sectorControllerIO = setupSectorControllerWebsocket(
  server,
  sessionUsersIO
);
sectorControllerIO.adapter(createAdapter(pubClient, subClient));

const voiceChatIO = setupVoiceChatWebsocket(server);
voiceChatIO.adapter(createAdapter(pubClient, subClient));

const notificationsIO = setupNotificationsWebsocket(server);
notificationsIO.adapter(createAdapter(pubClient, subClient));

try {
  const versionFile = readFileSync(
    new URL('../../VERSION', import.meta.url),
    'utf-8'
  ).trim();
  updateAppVersion(versionFile, 'system').catch((err) =>
    console.warn('[version] Failed to sync version on startup:', err)
  );
} catch {
  console.warn('[version] VERSION file not found, skipping sync');
}
startStatsFlushing();
startFlightLogsCleanup();
updateLeaderboard();
setInterval(updateLeaderboard, 12 * 60 * 60 * 1000);
setInterval(
  () => {
    cleanupOldApiLogs(1);
  },
  60 * 60 * 1000
);

setInterval(
  () => {
    void cleanupOldDeveloperUsage(
      Number(process.env.DEVELOPER_API_USAGE_RETENTION_DAYS) > 0
        ? Number(process.env.DEVELOPER_API_USAGE_RETENTION_DAYS)
        : 90
    );
  },
  24 * 60 * 60 * 1000
);

server.listen(PORT, () => {
  console.log(chalk.green(`Server running on http://localhost:${PORT}`));
});