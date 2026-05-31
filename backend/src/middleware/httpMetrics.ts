import { Request, Response, NextFunction } from 'express';
import { httpRequestDurationSeconds, normaliseRoute } from '../config/metrics';

export function httpMetrics(req: Request, res: Response, next: NextFunction): void {
    const startNs = process.hrtime.bigint();

    res.on('finish', () => {
        const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1e9;

        // Prefer the matched Express route pattern (already uses :param placeholders).
        // Fall back to normalising the raw path so UUIDs and numeric IDs collapse to :id.
        const routePattern = req.route?.path as string | undefined;
        const baseUrl = req.baseUrl ?? '';
        const route = routePattern
            ? normaliseRoute(baseUrl + routePattern)
            : normaliseRoute(req.path);

        httpRequestDurationSeconds.observe(
            {
                method: req.method,
                route,
                statusCode: String(res.statusCode),
            },
            durationSeconds
        );
    });

    next();
}
