import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { apiErrorsTotal, normaliseRoute } from '../config/metrics';

export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public isOperational = true
    ) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    const isProduction = process.env.NODE_ENV === 'production';

    // Log error — omit stack in production to avoid leaking internals
    logger.error('Error occurred:', {
        message: err.message,
        ...(isProduction ? {} : { stack: err.stack }),
        path: req.path,
        method: req.method,
    });

    const routePattern = req.route?.path as string | undefined;
    const errorRoute = routePattern
        ? normaliseRoute((req.baseUrl ?? '') + routePattern)
        : normaliseRoute(req.path);

    // Handle known operational errors
    if (err instanceof AppError) {
        apiErrorsTotal.inc({ route: errorRoute, statusCode: String(err.statusCode) });
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
        });
    }

    // Handle unexpected errors — never leak details in production
    apiErrorsTotal.inc({ route: errorRoute, statusCode: '500' });
    return res.status(500).json({
        status: 'error',
        message: 'An unexpected error occurred',
    });
};
