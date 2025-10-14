import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes/index';
import dotenv from 'dotenv';
import http from 'http';
import chalk from 'chalk';

dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });
console.log(chalk.bgBlue('NODE_ENV:'), process.env.NODE_ENV);

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
      ]
}));
app.use(cookieParser());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '..', 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
  }
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(chalk.green(`Server running on http://localhost:${PORT}`));
});