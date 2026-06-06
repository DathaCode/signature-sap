/**
 * AWS Embedded Metric Format (EMF) instrumentation.
 *
 * Metrics are emitted to stdout as structured EMF JSON and collected by the
 * CloudWatch Agent from the Docker container logs. There is no HTTP /metrics
 * endpoint and no in-process registry — every metric is flushed immediately.
 *
 * Environment selection (set via AWS_EMF_ENVIRONMENT in ./metricsEnv):
 *   - NODE_ENV=production → "Lambda" environment: serialises structured EMF JSON
 *     to stdout (no TCP agent endpoint required) so the CloudWatch Agent can
 *     scrape it from the Docker container logs. (The library has no "CloudWatch"
 *     environment; "Lambda" is the stdout-EMF-JSON sink.)
 *   - development          → "Local" environment, plain EMF JSON to stdout.
 *
 * Namespace:  SignatureShades/API
 * Dimensions: { Environment: "production" } (default on every metric)
 *
 * All emit* helpers are async and self-contained: they create a fresh metrics
 * logger, set dimensions, put a single metric, and flush. Callers should treat
 * them as fire-and-forget — `emitX(...).catch(() => {})` — so a metrics failure
 * never affects request handling.
 */
// IMPORTANT: must be imported before `aws-embedded-metrics` so the EMF
// environment (output sink) is selected before the library resolves it.
import './metricsEnv';
import { createMetricsLogger, Unit, Configuration } from 'aws-embedded-metrics';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

const NAMESPACE = 'SignatureShades/API';
const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

// Set the default namespace globally. The output sink (Lambda in production,
// Local in development) is selected by ./metricsEnv via AWS_EMF_ENVIRONMENT,
// which must be set before aws-embedded-metrics is loaded.
Configuration.namespace = NAMESPACE;

/**
 * Create a metrics logger pre-configured with the default namespace and the
 * Environment dimension.
 */
function newLogger() {
    const metrics = createMetricsLogger();
    metrics.setNamespace(NAMESPACE);
    metrics.setDimensions({ Environment: ENVIRONMENT });
    return metrics;
}

// ============================================================================
// EVENT METRICS (Unit.Count)
// ============================================================================

export async function emitOrderCreated(productType: string): Promise<void> {
    const metrics = newLogger();
    metrics.setDimensions({ Environment: ENVIRONMENT, ProductType: productType });
    metrics.putMetric('OrdersCreated', 1, Unit.Count);
    await metrics.flush();
}

export async function emitOrderStatusChanged(fromStatus: string, toStatus: string): Promise<void> {
    const metrics = newLogger();
    metrics.setDimensions({ Environment: ENVIRONMENT, FromStatus: fromStatus, ToStatus: toStatus });
    metrics.putMetric('OrdersStatusChanged', 1, Unit.Count);
    await metrics.flush();
}

export async function emitAuthAttempt(outcome: 'success' | 'failure'): Promise<void> {
    const metrics = newLogger();
    metrics.setDimensions({ Environment: ENVIRONMENT, Outcome: outcome });
    metrics.putMetric('AuthAttempts', 1, Unit.Count);
    await metrics.flush();
}

export async function emitWorksheetAccepted(): Promise<void> {
    const metrics = newLogger();
    metrics.putMetric('WorksheetsAccepted', 1, Unit.Count);
    await metrics.flush();
}

export async function emitInventoryDeduction(category: string): Promise<void> {
    const metrics = newLogger();
    metrics.setDimensions({ Environment: ENVIRONMENT, Category: category });
    metrics.putMetric('InventoryDeductions', 1, Unit.Count);
    await metrics.flush();
}

export async function emitQuoteCreated(): Promise<void> {
    const metrics = newLogger();
    metrics.putMetric('QuotesCreated', 1, Unit.Count);
    await metrics.flush();
}

export async function emitQuoteConverted(): Promise<void> {
    const metrics = newLogger();
    metrics.putMetric('QuotesConverted', 1, Unit.Count);
    await metrics.flush();
}

export async function emitApiError(route: string, statusCode: number): Promise<void> {
    const metrics = newLogger();
    metrics.setDimensions({ Environment: ENVIRONMENT, Route: route, StatusCode: String(statusCode) });
    metrics.putMetric('ApiErrors', 1, Unit.Count);
    await metrics.flush();
}

// ============================================================================
// DURATION METRICS (Unit.Milliseconds)
// ============================================================================

export async function emitHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number
): Promise<void> {
    const metrics = newLogger();
    metrics.setDimensions({
        Environment: ENVIRONMENT,
        Method: method,
        Route: route,
        StatusCode: String(statusCode),
    });
    metrics.putMetric('HttpRequestDuration', durationMs, Unit.Milliseconds);
    await metrics.flush();
}

export async function emitWorksheetGeneration(orderType: string, durationMs: number): Promise<void> {
    const metrics = newLogger();
    metrics.setDimensions({ Environment: ENVIRONMENT, OrderType: orderType });
    metrics.putMetric('WorksheetGeneration', durationMs, Unit.Milliseconds);
    await metrics.flush();
}

// ============================================================================
// PERIODIC GAUGE REFRESH
// ============================================================================

/**
 * Emit current inventory quantities and active-order counts every 60 seconds.
 * Each record is flushed independently so a single bad row can't drop the batch.
 */
async function refreshGauges(): Promise<void> {
    // Inventory quantities per item.
    const items = await prisma.inventoryItem.findMany({
        select: { itemName: true, category: true, colorVariant: true, quantity: true },
    });

    for (const item of items) {
        try {
            const metrics = newLogger();
            metrics.setDimensions({
                Environment: ENVIRONMENT,
                ItemName: item.itemName,
                Category: String(item.category),
                ColorVariant: item.colorVariant || 'N/A',
            });
            metrics.putMetric('InventoryQuantity', Number(item.quantity), Unit.Count);
            await metrics.flush();
        } catch (err) {
            logger.error('Failed to emit InventoryQuantity metric', { error: (err as Error).message });
        }
    }

    // Active orders grouped by status.
    const statusCounts = await prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
    });

    for (const row of statusCounts) {
        try {
            const metrics = newLogger();
            metrics.setDimensions({ Environment: ENVIRONMENT, Status: String(row.status) });
            metrics.putMetric('ActiveOrders', row._count._all, Unit.Count);
            await metrics.flush();
        } catch (err) {
            logger.error('Failed to emit ActiveOrders metric', { error: (err as Error).message });
        }
    }
}

/**
 * Start the periodic gauge refresh loop (called once from server.ts).
 */
export function startMetricsRefresh(): void {
    const run = () => {
        refreshGauges().catch((err) => {
            logger.error('Metrics gauge refresh failed', { error: (err as Error).message });
        });
    };

    // Kick off immediately, then every 60 seconds.
    run();
    setInterval(run, 60_000);

    logger.info('📈 EMF metrics gauge refresh started (60s interval)');
}
