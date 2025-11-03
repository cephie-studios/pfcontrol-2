import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
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
import { setupFlightsWebsocket } from './websockets/flightsWebsocket.js';
import { setupOverviewWebsocket } from './websockets/overviewWebsocket.js';
import { setupArrivalsWebsocket } from './websockets/arrivalsWebsocket.js';
import { setupSectorControllerWebsocket } from './websockets/sectorControllerWebsocket.js';

import { startStatsFlushing } from './utils/statisticsCache.js';
import { updateLeaderboard } from './db/leaderboard.js';
import { startFlightLogsCleanup } from './db/flightLogs.js';

dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });
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

const app = express();

app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://control.pfconnect.online', 'https://test.pfconnect.online']
    : [
        'http://localhost:9901',
        'http://localhost:5173',
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Allow-Credentials']
}));
app.use(cookieParser());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '..', '..', 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
  }
}));

app.get('/{*any}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', "..", "dist", "index.html"));
});

const server = http.createServer(app);

// Redis pub/sub adapter to join sessions locally that are connected to different server instances e.g. production
const pubClient = new Redis(process.env.REDIS_URL!);
const subClient = pubClient.duplicate();

const sessionUsersIO = setupSessionUsersWebsocket(server);
sessionUsersIO.adapter(createAdapter(pubClient, subClient));

const chatIO = setupChatWebsocket(server, sessionUsersIO);
chatIO.adapter(createAdapter(pubClient, subClient));

const flightsIO = setupFlightsWebsocket(server);
flightsIO.adapter(createAdapter(pubClient, subClient));

const overviewIO = setupOverviewWebsocket(server, sessionUsersIO);
overviewIO.adapter(createAdapter(pubClient, subClient));

const arrivalsIO = setupArrivalsWebsocket(server);
arrivalsIO.adapter(createAdapter(pubClient, subClient));

const sectorControllerIO = setupSectorControllerWebsocket(server, sessionUsersIO);
sectorControllerIO.adapter(createAdapter(pubClient, subClient));

startStatsFlushing();
startFlightLogsCleanup();
updateLeaderboard();
setInterval(updateLeaderboard, 12 * 60 * 60 * 1000); // 12h

server.listen(PORT, () => {
  console.log(chalk.green(`Server running on http://localhost:${PORT}`));
});