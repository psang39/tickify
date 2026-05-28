import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import Express from 'express';
import path from 'path';
import { setServers } from 'node:dns/promises';

import router from './routes/index';

const app = Express();

app.use(cookieParser());
const normalizeOrigin = (origin: string) => origin.trim().replace(/\/$/, '');

const allowedOrigins = Array.from(new Set([
    // Production domain
    'https://tickify.tech',
    'https://www.tickify.tech',

    // Keep HTTP while the domain is not fully switched to SSL yet.
    // After HTTPS works, you can remove these two lines.
    'http://tickify.tech',
    'http://www.tickify.tech',

    // Local development / Vite preview
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    'http://127.0.0.1:3000',

    ...(process.env.FRONTEND_URL || '')
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean),
    ...(process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean),
]));

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Allow requests without Origin, e.g. mobile app, Postman, curl, server-to-server webhook.
        if (!origin) {
            return callback(null, true);
        }

        const requestOrigin = normalizeOrigin(origin);
        if (allowedOrigins.includes(requestOrigin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-checkout-token', 'x-sync-key'],
};

app.use(cors(corsOptions));

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
