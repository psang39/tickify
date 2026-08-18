import type { NextFunction, Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { recordRequestMetric, runtimeMetricsEnabled } from '../services/runtime-metrics.service';

export const runtimeMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!runtimeMetricsEnabled()) {
        next();
        return;
    }

    const startedAt = performance.now();
    res.on('finish', () => {
        const routePath = req.route?.path || req.path;
        recordRequestMetric(req.method, routePath, performance.now() - startedAt, res.statusCode);
    });
    next();
};
