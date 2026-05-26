import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import Express from 'express';
import { setServers } from 'node:dns/promises';

import router from './routes/index';

const app = Express();

app.use(cookieParser());
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    ...(process.env.FRONTEND_URL || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean),
];

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
