// server.js
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes/index.js';
import dotenv from 'dotenv';
import http from 'http';

import { setupChatWebsocket } from './websockets/chatWebsocket.js';

// check environment
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
const cors_origin = process.env.NODE_ENV === 'production' ? ['https://control.pfconnect.online'] : ['http://localhost:5000', 'http://localhost:5173', 'https://control.pfconnect.online'];
dotenv.config({ path: envFile });

const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
    origin: cors_origin,
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname, '../public')));

// start logic
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
setupChatWebsocket(server);

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});