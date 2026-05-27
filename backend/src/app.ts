import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import Express from 'express';
import path from 'path';
import { setServers } from 'node:dns/promises';

import router from './routes/index';

const app = Express();

app.use(cookieParser());
const allowedOrigins = Array.from(new Set([
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    ...(process.env.FRONTEND_URL || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean),
]));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
}));

setServers(['1.1.1.1', '8.8.8.8']);

app.use(Express.json({ limit: '10mb' }));
app.use(Express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api/v1/uploads', Express.static(path.resolve(process.cwd(), 'uploads'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    immutable: process.env.NODE_ENV === 'production',
}));
app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
        const contentTypeHeader = res.getHeader('Content-Type');
        const contentType = Array.isArray(contentTypeHeader)
            ? contentTypeHeader.join(';')
            : String(contentTypeHeader || '');

        if (req.headers['x-no-compression'] || contentType.includes('text/event-stream')) {
            return false;
        }

        return compression.filter(req, res);
    },
}));

app.use('/api/v1', router);

export default app;
