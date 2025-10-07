import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes/index.js';
import dotenv from 'dotenv';
import http from 'http';
import jwt from 'jsonwebtoken'
import { setupChatWebsocket } from './websockets/chatWebsocket.js';
import { setupSessionUsersWebsocket } from './websockets/sessionUsersWebsocket.js';
import { setupFlightsWebsocket } from './websockets/flightsWebsocket.js';
import { setupOverviewWebsocket } from './websockets/overviewWebsocket.js';
import { setupArrivalsWebsocket } from './websockets/arrivalsWebsocket.js';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
const cors_origin = process.env.NODE_ENV === 'production'
    ? ['https://control.pfconnect.online', 'https://test.pfconnect.online']
    : ['http://localhost:9901', 'http://localhost:5173', 'https://control.pfconnect.online'];
dotenv.config({ path: envFile });
console.log('NODE_ENV:', process.env.NODE_ENV);

const requiredEnv = [
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_REDIRECT_URI',
    'FRONTEND_URL',
    'JWT_SECRET',
    'POSTGRES_DB_URL',
    'PORT'
];
const missingEnv = requiredEnv.filter((key) => !process.env[key] || process.env[key] === '');
if (missingEnv.length > 0) {
    console.error('Missing required environment variables:', missingEnv.join(', '));
    process.exit(1);
}

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 9900 : 9901);
if (!PORT || PORT === '' || PORT == undefined) {
    console.error('PORT is not defined');
    process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(cors({
    origin: cors_origin,
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname, '../public')));

app.use(
    express.static(path.join(__dirname, "..", "dist"), {
        setHeaders: (res, path) => {
            if (path.endsWith(".js")) {
                res.setHeader("Content-Type", "application/javascript");
            }
        },
    })
);

app.get('/{*any}', (req, res) => {
    res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

const server = http.createServer(app);
const sessionUsersIO = setupSessionUsersWebsocket(server);
setupChatWebsocket(server, sessionUsersIO);
setupFlightsWebsocket(server);
setupOverviewWebsocket(server, sessionUsersIO);
setupArrivalsWebsocket(server);

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});