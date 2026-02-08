import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';

// Existing routes
import orderRoutes from './routes/orderRoutes';
import inventoryRoutes from './routes/inventoryRoutes';

// New routes for Order Management System
import authRoutes from './routes/authRoutes';
import webOrderRoutes from './routes/webOrderRoutes';
import pricingRoutes from './routes/pricingRoutes';
import userRoutes from './routes/userRoutes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (for serving uploads if needed)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        query: req.query,
        ip: req.ip,
    });
    next();
});

// ============================================================================
// ROUTES
// ============================================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Existing API Routes (Excel upload + Inventory)
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);

// New API Routes (Order Management System)
app.use('/api/auth', authRoutes);
app.use('/api/web-orders', webOrderRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/users', userRoutes);

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
