import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import apiRoutes from './routes/index.js';

import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
    origin: ['http://localhost:5000', 'http://localhost:5173', 'https://control.pfconnect.online'],
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

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
