import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';

// Existing routes
import inventoryRoutes from './routes/inventoryRoutes';

// New routes for Order Management System
import authRoutes from './routes/authRoutes';
import webOrderRoutes from './routes/webOrderRoutes';
import pricingRoutes from './routes/pricingRoutes';
import userRoutes from './routes/userRoutes';
import quoteRoutes from './routes/quoteRoutes';
import adminWorksheetRoutes from './routes/adminWorksheetRoutes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Trust first proxy (nginx) — required for rate limiting to use real client IP
app.set('trust proxy', 1);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security — strict Helmet config for production
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            frameAncestors: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
}));

// CORS — explicit origin, no wildcard
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing — size limits to prevent DoS
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Static files — protected with auth
import { authenticateToken } from './middleware/auth';
app.use('/uploads', authenticateToken, express.static(path.join(__dirname, '../uploads')));

// Request logging
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        query: req.query,
        ip: req.ip,
    });
    next();
});

// ============================================================================
// ROUTES
// ============================================================================

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});

// Existing API Routes (Inventory)
app.use('/api/inventory', inventoryRoutes);

// New API Routes (Order Management System)
app.use('/api/auth', authRoutes);
app.use('/api/web-orders', webOrderRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/admin/worksheets', adminWorksheetRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use(errorHandler);

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
    logger.info(`🚀 Signature Shades API Server running on port ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
