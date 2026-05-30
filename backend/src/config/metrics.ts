import {
    Registry,
    collectDefaultMetrics,
    Counter,
    Histogram,
    Gauge,
} from 'prom-client';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

export const register = new Registry();

collectDefaultMetrics({ register });

// ── Counters ────────────────────────────────────────────────────────────────

export const ordersCreatedTotal = new Counter({
    name: 'orders_created_total',
    help: 'Total number of orders created',
    labelNames: ['productType'] as const,
    registers: [register],
});

export const ordersStatusChangedTotal = new Counter({
    name: 'orders_status_changed_total',
    help: 'Total number of order status transitions',
    labelNames: ['fromStatus', 'toStatus'] as const,
    registers: [register],
});

export const authAttemptsTotal = new Counter({
    name: 'auth_attempts_total',
    help: 'Total number of login attempts',
    labelNames: ['outcome'] as const,
    registers: [register],
});

export const worksheetAcceptedTotal = new Counter({
    name: 'worksheet_accepted_total',
    help: 'Total number of worksheets accepted',
    registers: [register],
});

export const inventoryDeductionsTotal = new Counter({
    name: 'inventory_deductions_total',
    help: 'Total number of inventory deduction operations',
    labelNames: ['category'] as const,
    registers: [register],
});

export const quotesCreatedTotal = new Counter({
    name: 'quotes_created_total',
    help: 'Total number of quotes created',
    registers: [register],
});

export const quotesConvertedTotal = new Counter({
    name: 'quotes_converted_total',
    help: 'Total number of quotes converted to orders',
    registers: [register],
});

export const apiErrorsTotal = new Counter({
    name: 'api_errors_total',
    help: 'Total number of API error responses',
    labelNames: ['route', 'statusCode'] as const,
    registers: [register],
});

// ── Histograms ───────────────────────────────────────────────────────────────

export const httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'statusCode'] as const,
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register],
});

export const worksheetGenerationSeconds = new Histogram({
    name: 'worksheet_generation_seconds',
    help: 'Duration of worksheet generation (cut-list optimisation) in seconds',
    labelNames: ['orderType'] as const,
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [register],
});

export const dbQueryDurationSeconds = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database query operations in seconds',
    labelNames: ['operation'] as const,
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3],
    registers: [register],
});

// ── Gauges ───────────────────────────────────────────────────────────────────

export const inventoryQuantityGauge = new Gauge({
    name: 'inventory_quantity',
    help: 'Current stock quantity for each inventory item',
    labelNames: ['itemName', 'category', 'colorVariant'] as const,
    registers: [register],
});

export const activeOrdersGauge = new Gauge({
    name: 'active_orders',
    help: 'Number of non-deleted orders grouped by status',
    labelNames: ['status'] as const,
    registers: [register],
});

// ── Route normalisation (shared with httpMetrics and errorHandler) ───────────

export function normaliseRoute(path: string, routePattern?: string): string {
    const base = routePattern ?? path;
    return base
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
        .replace(/\/\d+(?=\/|$)/g, '/:id');
}

// ── Background gauge refresh ─────────────────────────────────────────────────

async function refreshGauges(): Promise<void> {
    try {
        const items = await prisma.inventoryItem.findMany({
            select: { itemName: true, category: true, colorVariant: true, quantity: true },
        });

        inventoryQuantityGauge.reset();
        for (const item of items) {
            inventoryQuantityGauge.set(
                {
                    itemName: item.itemName,
                    category: String(item.category),
                    colorVariant: item.colorVariant ?? '',
                },
                item.quantity
            );
        }

        const counts = await prisma.order.groupBy({
            by: ['status'],
            where: { deletedAt: null },
            _count: { status: true },
        });

        activeOrdersGauge.reset();
        for (const row of counts) {
            activeOrdersGauge.set({ status: row.status }, row._count.status);
        }
    } catch (err) {
        logger.error('Metrics gauge refresh failed', { error: (err as Error).message });
    }
}

export function startMetricsRefresh(): void {
    // Run immediately then every 60 s
    refreshGauges().catch(() => undefined);
    setInterval(() => refreshGauges().catch(() => undefined), 60_000);
}
