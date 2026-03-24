import { Request, Response, NextFunction } from 'express';
import { PrismaClient, OrderStatus, InventoryCategory } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { z } from 'zod';
import path from 'path';
import pricingService from '../services/pricing.service';
import comprehensivePricingService from '../services/comprehensivePricing.service';

import { FabricCutOptimizerService } from '../services/fabricCutOptimizer.service';
import { TubeCutOptimizer, TubeBlindInput } from '../services/tubeCutOptimizer.service';
import { InventoryService } from '../services/inventory.service';
import { WorksheetExportService } from '../services/worksheetExport.service';

// Motor-specific width deductions for fabric cutting
const MOTOR_DEDUCTIONS: Record<string, number> = {
    'TBS winder-32mm': 28,
    'Acmeda winder-29mm': 28,
    'Automate 1.1NM Li-Ion Quiet Motor': 29,
    'Automate 0.7NM Li-Ion Quiet Motor': 29,
    'Automate 2NM Li-Ion Quiet Motor': 29,
    'Automate 3NM Li-Ion Motor': 29,
    'Automate E6 6NM Motor': 29,
    'Alpha 1NM Battery Motor': 30,
    'Alpha 2NM Battery Motor': 30,
    'Alpha 3NM Battery Motor': 30,
    'Alpha AC 5NM Motor': 35,
};

function getMotorDeduction(motorType: string | undefined): number {
    if (!motorType) return 28;
    return MOTOR_DEDUCTIONS[motorType] || 28;
}

/**
 * Chain length (mm) to use based on blind drop.
 * Inventory chains: 500 / 900 / 1200 / 1500 / 2000 mm
 */
function getChainLength(drop: number): number {
    if (drop <= 850) return 500;
    if (drop <= 1200) return 900;
    if (drop <= 1600) return 1200;
    if (drop <= 2200) return 1500;
    return 2000;
}

/**
 * Map order-form bracketType to inventory item name.
 * Acmeda: "Acmeda {Suffix}",  TBS: "TBS {Suffix}",  MOTOR: "{Suffix}"
 */
function getBracketItemName(brand: 'ACMEDA' | 'TBS' | 'MOTOR', bracketType: string): string {
    const map: Record<string, string> = {
        'Single': 'Single Bracket set',
        'Single Extension': 'Extended Bracket set',
        'Dual Left': 'Dual Bracket set Left',
        'Dual Right': 'Dual Bracket set Right',
    };
    const suffix = map[bracketType] ?? `${bracketType} Bracket set`;
    if (brand === 'ACMEDA') return `Acmeda ${suffix}`;
    if (brand === 'TBS') return `TBS ${suffix}`;
    // MOTOR brackets: "Single Bracket set", "Extended Bracket set", "Dual Left Bracket set", "Dual Right Bracket set"
    const motorMap: Record<string, string> = {
        'Single': 'Single Bracket set',
        'Single Extension': 'Extended Bracket set',
        'Dual Left': 'Dual Left Bracket set',
        'Dual Right': 'Dual Right Bracket set',
    };
    return motorMap[bracketType] ?? `${bracketType} Bracket set`;
}

/**
 * Build per-blind hardware deduction entries.
 * Uses order item fields: chainOrMotor, bracketType, bracketColour, drop,
 * chainType, bottomRailType, bottomRailColour
 */
function buildPerBlindHardware(item: any): { category: string; itemName: string; colorVariant?: string; qty: number }[] {
    const { chainOrMotor, bracketType, bracketColour, drop, chainType, bottomRailType, bottomRailColour } = item;
    if (!chainOrMotor) return [];

    const results: { category: string; itemName: string; colorVariant?: string; qty: number }[] = [];
    const railType = bottomRailType || 'D30';  // fallback
    const railColour = bottomRailColour || undefined;

    if (chainOrMotor === 'Acmeda winder-29mm') {
        // Acmeda winder + Idler + Clutch + bracket(5 colours) + chain(type) + 2 clips(rail type+colour) + stop bolt + safety lock
        results.push({ category: 'ACMEDA', itemName: 'Acmeda winder-29mm', qty: 1 });
        results.push({ category: 'ACMEDA', itemName: 'Acmeda Idler', qty: 1 });
        results.push({ category: 'ACMEDA', itemName: 'Acmeda Clutch', qty: 1 });
        if (bracketType && bracketColour) {
            results.push({ category: 'ACMEDA', itemName: getBracketItemName('ACMEDA', bracketType), colorVariant: bracketColour, qty: 1 });
        }
        results.push({ category: 'CHAIN', itemName: `Chain ${getChainLength(drop)}mm`, colorVariant: chainType || undefined, qty: 1 });
        results.push({ category: 'BOTTOM_BAR_CLIP', itemName: `${railType} Left Clip`, colorVariant: railColour, qty: 1 });
        results.push({ category: 'BOTTOM_BAR_CLIP', itemName: `${railType} Right Clip`, colorVariant: railColour, qty: 1 });
        results.push({ category: 'ACCESSORY', itemName: 'Stop bolt', qty: 1 });
        results.push({ category: 'ACCESSORY', itemName: 'Safety lock', qty: 1 });

    } else if (chainOrMotor === 'TBS winder-32mm') {
        // TBS winder + bracket(5 colours) + chain(type) + 2 clips(rail type+colour) + stop bolt + safety lock
        // Exceptional: Dual Left/Right → also Acmeda Idler + Clutch
        results.push({ category: 'TBS', itemName: 'TBS winder-32mm', qty: 1 });
        if (bracketType === 'Dual Left' || bracketType === 'Dual Right') {
            results.push({ category: 'ACMEDA', itemName: 'Acmeda Idler', qty: 1 });
            results.push({ category: 'ACMEDA', itemName: 'Acmeda Clutch', qty: 1 });
        }
        if (bracketType && bracketColour) {
            results.push({ category: 'TBS', itemName: getBracketItemName('TBS', bracketType), colorVariant: bracketColour, qty: 1 });
        }
        results.push({ category: 'CHAIN', itemName: `Chain ${getChainLength(drop)}mm`, colorVariant: chainType || undefined, qty: 1 });
        results.push({ category: 'BOTTOM_BAR_CLIP', itemName: `${railType} Left Clip`, colorVariant: railColour, qty: 1 });
        results.push({ category: 'BOTTOM_BAR_CLIP', itemName: `${railType} Right Clip`, colorVariant: railColour, qty: 1 });
        results.push({ category: 'ACCESSORY', itemName: 'Stop bolt', qty: 1 });
        results.push({ category: 'ACCESSORY', itemName: 'Safety lock', qty: 1 });

    } else {
        // Automate / Alpha motor + Acmeda Idler + bracket(White/Black) + 2 clips(rail type+colour)
        results.push({ category: 'MOTOR', itemName: chainOrMotor, qty: 1 });
        results.push({ category: 'ACMEDA', itemName: 'Acmeda Idler', qty: 1 });
        if (bracketType && bracketColour) {
            results.push({ category: 'MOTOR', itemName: getBracketItemName('MOTOR', bracketType), colorVariant: bracketColour, qty: 1 });
        }
        results.push({ category: 'BOTTOM_BAR_CLIP', itemName: `${railType} Left Clip`, colorVariant: railColour, qty: 1 });
        results.push({ category: 'BOTTOM_BAR_CLIP', itemName: `${railType} Right Clip`, colorVariant: railColour, qty: 1 });
    }

    return results;
}

const prisma = new PrismaClient();

// Validation schemas
// Use coerce for width/drop to handle string→number from JSON
// Use string() instead of enum() for controlSide/roll to handle empty strings
const OrderItemSchema = z.object({
    location: z.string().min(1, 'Location is required'),
    width: z.coerce.number().int().positive('Width must be a positive number'),
    drop: z.coerce.number().int().positive('Drop must be a positive number'),
    fixing: z.string().optional(),
    bracketType: z.string().optional(),
    bracketColour: z.string().optional(),
    controlSide: z.string().optional(),
    chainOrMotor: z.string().optional(),
    chainType: z.string().optional().nullable(),
    roll: z.string().optional(),
    material: z.string().optional(),
    fabricType: z.string().optional(),
    fabricColour: z.string().optional(),
    bottomRailType: z.string().optional(),
    bottomRailColour: z.string().optional(),
    // Frontend may send pricing fields - accept but ignore (recalculated server-side)
    price: z.coerce.number().optional(),
    fabricGroup: z.coerce.number().optional(),
    discountPercent: z.coerce.number().optional(),
    fabricPrice: z.coerce.number().optional(),
    motorPrice: z.coerce.number().optional(),
    bracketPrice: z.coerce.number().optional(),
    chainPrice: z.coerce.number().optional(),
    clipsPrice: z.coerce.number().optional(),
    componentPrice: z.coerce.number().optional(),
});

const CreateOrderSchema = z.object({
    productType: z.enum(['BLINDS', 'CURTAINS', 'SHUTTERS']),
    orderDate: z.string().optional(),
    dateRequired: z.string().optional(),
    items: z.array(OrderItemSchema).min(1, 'At least one item is required'),
    notes: z.string().optional(),
    customerReference: z.string().max(255).optional(),
});

/**
 * Generate unique order number: YYNNNN.S (e.g. 260001.S)
 * Sequential per year, resets each calendar year.
 */
async function generateOrderNumber(): Promise<string> {
    const yy = new Date().getFullYear().toString().slice(-2); // "26"

    // Find the highest sequence number for this year
    const lastOrder = await prisma.order.findFirst({
        where: {
            orderNumber: {
                startsWith: yy,
                endsWith: '.S',
            },
        },
        orderBy: { orderNumber: 'desc' },
    });

    let sequence = 1;
    if (lastOrder) {
        const numPart = lastOrder.orderNumber.replace('.S', '').slice(2);
        const lastSeq = parseInt(numPart, 10);
        if (!isNaN(lastSeq)) sequence = lastSeq + 1;
    }

    return `${yy}${sequence.toString().padStart(4, '0')}.S`;
}

/**
 * Create new order (customer)
 */
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            throw new AppError(401, 'Authentication required');
        }

        const validatedData = CreateOrderSchema.parse(req.body);

        // Get user details
        const user = await prisma.user.findUnique({
            where: { id: authReq.user.id },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        // Generate order number
        const orderNumber = await generateOrderNumber();

        // Calculate pricing for each item
        let subtotal = 0;
        const processedItems = [];

        for (let i = 0; i < validatedData.items.length; i++) {
            const item = validatedData.items[i];

            let price = 0;
            let fabricGroup: number | null = null;
            let discountPercent = 0;
            let fabricPrice: number | null = null;
            let motorPrice: number | null = null;
            let bracketPrice: number | null = null;
            let chainPrice: number | null = null;
            let clipsPrice: number | null = null;
            let componentPrice: number | null = null;

            // Calculate comprehensive price if all required fields provided
            if (item.material && item.fabricType && item.fabricColour &&
                item.chainOrMotor && item.bracketType && item.bracketColour &&
                item.bottomRailType && item.bottomRailColour) {
                try {
                    const breakdown = await comprehensivePricingService.calculateBlindPrice({
                        width: item.width,
                        drop: item.drop,
                        material: item.material,
                        fabricType: item.fabricType,
                        fabricColour: item.fabricColour,
                        chainOrMotor: item.chainOrMotor,
                        chainType: item.chainType || undefined,
                        bracketType: item.bracketType,
                        bracketColour: item.bracketColour,
                        bottomRailType: item.bottomRailType,
                        bottomRailColour: item.bottomRailColour,
                        controlSide: item.controlSide,
                    });

                    price = breakdown.totalPrice;
                    fabricGroup = breakdown.fabricGroup;
                    discountPercent = breakdown.discountPercent;
                    fabricPrice = breakdown.fabricPrice;
                    motorPrice = breakdown.motorChainPrice;
                    bracketPrice = breakdown.bracketPrice;
                    chainPrice = breakdown.chainPrice;
                    clipsPrice = breakdown.clipsPrice;
                    componentPrice = parseFloat((
                        breakdown.idlerClutchPrice + breakdown.stopBoltSafetyLockPrice
                    ).toFixed(2));
                } catch (pricingError) {
                    // Fallback to basic pricing if comprehensive fails
                    logger.warn(`Comprehensive pricing failed for item ${i + 1}, falling back to basic pricing: ${pricingError}`);
                    const priceResult = await pricingService.calculatePrice({
                        material: item.material,
                        fabricType: item.fabricType,
                        width: item.width,
                        drop: item.drop,
                    });
                    price = priceResult.finalPrice;
                    fabricGroup = priceResult.fabricGroup;
                    discountPercent = priceResult.discountPercent;
                }
            } else if (item.material && item.fabricType) {
                // Basic pricing when not all component fields are filled
                const priceResult = await pricingService.calculatePrice({
                    material: item.material,
                    fabricType: item.fabricType,
                    width: item.width,
                    drop: item.drop,
                });
                price = priceResult.finalPrice;
                fabricGroup = priceResult.fabricGroup;
                discountPercent = priceResult.discountPercent;
            }

            const motorDeduction = getMotorDeduction(item.chainOrMotor);

            processedItems.push({
                itemNumber: i + 1,
                ...item,
                calculatedWidth: item.width - 28,
                calculatedDrop: item.drop + 200,
                fabricCutWidth: item.width - motorDeduction,
                fabricGroup,
                discountPercent,
                price,
                fabricPrice,
                motorPrice,
                bracketPrice,
                chainPrice,
                clipsPrice,
                componentPrice,
            });

            subtotal += price;
        }

        // Create order with items
        const order = await prisma.order.create({
            data: {
                orderNumber,
                userId: user.id,
                productType: validatedData.productType,
                orderDate: validatedData.orderDate ? new Date(validatedData.orderDate) : new Date(),
                dateRequired: validatedData.dateRequired ? new Date(validatedData.dateRequired) : null,
                customerName: user.name,
                customerEmail: user.email,
                customerPhone: user.phone,
                customerCompany: user.company || null,
                status: OrderStatus.PENDING,
                subtotal,
                total: subtotal,
                notes: validatedData.notes || null,
                customerReference: validatedData.customerReference || null,
                fileSource: 'WEB_FORM',
                items: {
                    create: processedItems,
                },
            },
            include: {
                items: true,
            },
        });

        logger.info(`Order created: ${orderNumber} by ${user.email}`);

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: { order },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            logger.error(`Order validation failed: ${JSON.stringify(error.errors)}`);
            next(new AppError(400, error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')));
        } else {
            logger.error(`Order creation failed: ${(error as Error).message}`, { stack: (error as Error).stack });
            next(error);
        }
    }
};

/**
 * Get user's orders (customer)
 */
export const getMyOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            throw new AppError(401, 'Authentication required');
        }

        const { status, productType } = req.query;

        const orders = await prisma.order.findMany({
            where: {
                userId: authReq.user.id,
                deletedAt: null,
                ...(status && { status: status as OrderStatus }),
                ...(productType && { productType: productType as any }),
            },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            data: { orders, count: orders.length },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single order by ID (customer or admin)
 */
export const getOrderById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            throw new AppError(401, 'Authentication required');
        }

        const order = await prisma.order.findUnique({
            where: { id: req.params.id as string },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        company: true,
                    },
                },
            },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        // Check authorization
        if (authReq.user.role !== 'ADMIN' && order.userId !== authReq.user.id) {
            throw new AppError(403, 'Access denied');
        }

        res.json({
            success: true,
            data: { order },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel order (customer - only PENDING orders)
 */
export const cancelOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            throw new AppError(401, 'Authentication required');
        }

        const order = await prisma.order.findUnique({
            where: { id: req.params.id as string },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        // Check authorization
        if (order.userId !== authReq.user.id) {
            throw new AppError(403, 'Access denied');
        }

        // Only allow cancelling PENDING orders
        if (order.status !== OrderStatus.PENDING) {
            throw new AppError(400, 'Only pending orders can be cancelled');
        }

        const updated = await prisma.order.update({
            where: { id: req.params.id as string },
            data: { status: OrderStatus.CANCELLED },
        });

        logger.info(`Order cancelled: ${order.orderNumber} by ${authReq.user.email}`);

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            data: { order: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all orders (admin)
 */
export const getAllOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = (req as AuthRequest).user;
        const { status, productType, userId, customerName, dateFrom, dateTo } = req.query;

        // Warehouse agents can only see PRODUCTION orders
        const statusFilter = user?.role === 'WAREHOUSE'
            ? 'PRODUCTION' as OrderStatus
            : status as OrderStatus | undefined;

        const orders = await prisma.order.findMany({
            where: {
                deletedAt: null, // Exclude trashed orders
                ...(statusFilter && { status: statusFilter }),
                ...(productType && { productType: productType as any }),
                ...(user?.role !== 'WAREHOUSE' && userId && { userId: userId as string }),
                ...(user?.role !== 'WAREHOUSE' && customerName && {
                    user: {
                        name: { contains: customerName as string, mode: 'insensitive' as const },
                    },
                }),
                ...((dateFrom || dateTo) && {
                    createdAt: {
                        ...(dateFrom && { gte: new Date(dateFrom as string) }),
                        ...(dateTo && { lte: new Date(new Date(dateTo as string).setHours(23, 59, 59, 999)) }),
                    },
                }),
            },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        company: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            data: { orders, count: orders.length },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Approve order (admin - PENDING → CONFIRMED)
 */
export const approveOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const { adminNotes } = req.body;

        const order = await prisma.order.findUnique({
            where: { id: req.params.id as string },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        if (order.status !== OrderStatus.PENDING) {
            throw new AppError(400, 'Only pending orders can be approved');
        }

        const updated = await prisma.order.update({
            where: { id: req.params.id as string },
            data: {
                status: OrderStatus.CONFIRMED,
                confirmedAt: new Date(),
                confirmedBy: authReq.user?.email || 'unknown',
                adminNotes: adminNotes || null,
            },
            include: {
                items: true,
            },
        });

        logger.info(`Order approved: ${order.orderNumber} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'Order approved successfully',
            data: { order: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Send order to production (admin - CONFIRMED → PRODUCTION)
 * Runs cutlist optimization and tube cut calculation
 */
export const sendToProduction = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;

        const order = await prisma.order.findUnique({
            where: { id: req.params.id as string },
            include: { items: { orderBy: { itemNumber: 'asc' } } },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        if (order.status !== OrderStatus.CONFIRMED) {
            throw new AppError(400, 'Only confirmed orders can be sent to production');
        }

        const worksheetResult = await runOptimization(order);

        // Update order status
        await prisma.order.update({
            where: { id: req.params.id as string },
            data: { status: OrderStatus.PRODUCTION },
        });

        logger.info(`Order sent to production: ${order.orderNumber} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'Order sent to production successfully',
            data: {
                worksheetData: worksheetResult.worksheetData,
                inventoryCheck: worksheetResult.inventoryCheck,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Run optimization for an order (shared by sendToProduction and recalculate)
 * Uses Genetic Algorithm for physically valid guillotine cuts with continuous stock optimization
 */
async function runOptimization(order: any) {
    const items = order.items;

    // 1. Group items by fabric (material + fabricType + fabricColour)
    const fabricGroups = new Map<string, any[]>();
    for (const item of items) {
        const key = `${item.material || 'Unknown'} - ${item.fabricType || 'Unknown'} - ${item.fabricColour || 'Unknown'}`;
        if (!fabricGroups.has(key)) fabricGroups.set(key, []);
        fabricGroups.get(key)!.push(item);
    }

    // 2. Run Genetic Algorithm fabric cut optimization per fabric group
    const fabricCutData: Record<string, any> = {};
    let totalFabricMm = 0;

    const fabricOptimizer = new FabricCutOptimizerService();

    for (const [fabricKey, groupItems] of fabricGroups) {
        const optimizationResult = await fabricOptimizer.optimizeOrder(groupItems);
        // optimizeOrder groups internally; for a single-fabric group there will be one entry
        const result = optimizationResult.values().next().value;

        if (!result) continue;

        // Convert new optimizer result to existing data shape
        // so worksheetExport, inventory logic, and frontend all keep working
        const sheets = result.sheets.map((sheet: any) => ({
            id: sheet.id,
            width: sheet.width,
            length: sheet.actualUsedLength || sheet.length,
            panels: sheet.panels.map((p: any) => ({
                id: p.id,
                x: p.x,
                y: p.y,
                width: p.width,
                length: p.length,
                rotated: p.rotated,
                label: p.label,
                blindNumber: p.blindNumber,
                location: p.location,
                originalIndex: 0,
                originalWidth: groupItems.find((it: any) => it.id === p.orderItemId)?.width,
                originalDrop: groupItems.find((it: any) => it.id === p.orderItemId)?.drop,
                orderItemId: p.orderItemId,
            })),
            freeRectangles: [],
            usedArea: sheet.usedArea,
            wastedArea: sheet.wasteArea,
            efficiency: sheet.efficiency,
            cutSequence: sheet.cutSequence || [],
        }));

        const totalPanels = sheets.reduce((sum: number, s: any) => sum + s.panels.length, 0);

        const optimization = {
            sheets,
            statistics: {
                usedStockSheets: result.statistics.totalSheets,
                stockDimensions: `3000×continuous`,
                totalUsedArea: result.statistics.totalUsedArea,
                totalWastedArea: result.statistics.totalWasteArea,
                wastePercentage: result.wastePercentage,
                efficiency: result.efficiency,
                totalCuts: totalPanels,
                totalPanels,
                totalFabricNeeded: result.totalFabricNeeded,
            },
            cuts: [],
            // Genetic algorithm metadata
            generationStats: result.generationStats,
            validation: result.validation,
            isGuillotineValid: result.isGuillotineValid,
            strategy: result.strategy,
        };

        totalFabricMm += result.totalFabricNeeded;

        fabricCutData[fabricKey] = {
            optimization,
            items: groupItems,
        };

        // Update OrderItem records with sheet positions
        for (const sheet of sheets) {
            for (const panel of sheet.panels) {
                if (panel.orderItemId) {
                    await prisma.orderItem.update({
                        where: { id: panel.orderItemId },
                        data: {
                            sheetNumber: sheet.id,
                            sheetPositionX: panel.x,
                            sheetPositionY: panel.y,
                            panelRotated: panel.rotated,
                            optimizedAt: new Date(),
                        },
                    });
                }
            }
        }
    }

    // 3. Run tube cut optimization
    const tubeBlinds: TubeBlindInput[] = items
        .filter((item: any) => item.bottomRailType && item.bottomRailColour)
        .map((item: any) => ({
            location: item.location,
            originalWidth: item.width,
            bottomRailType: item.bottomRailType,
            bottomRailColour: item.bottomRailColour,
            orderItemId: item.id,
        }));

    const tubeCutOptimizer = new TubeCutOptimizer();
    const tubeCutData = tubeCutOptimizer.optimize(tubeBlinds);

    // 4. Store worksheet data (upsert for recalculation support)
    const worksheetData = await prisma.worksheetData.upsert({
        where: { orderId: order.id },
        create: {
            orderId: order.id,
            fabricCutData: serializeFabricCutData(fabricCutData),
            tubeCutData: tubeCutData as any,
            totalFabricMm,
            totalTubePieces: tubeCutData.totalPiecesNeeded,
        },
        update: {
            fabricCutData: serializeFabricCutData(fabricCutData),
            tubeCutData: tubeCutData as any,
            totalFabricMm,
            totalTubePieces: tubeCutData.totalPiecesNeeded,
            acceptedAt: null,
            acceptedBy: null,
        },
    });

    // 5. Check inventory availability (fabric + bottom bars + per-blind hardware)
    const inventoryRequirements = buildInventoryRequirements(fabricCutData, tubeCutData, items);

    const inventoryCheck = await InventoryService.checkAvailability(inventoryRequirements);

    return { worksheetData, inventoryCheck, fabricCutData, tubeCutData };
}

/**
 * Serialize fabricCutData for JSON storage (remove circular refs from items)
 */
function serializeFabricCutData(fabricCutData: Record<string, any>): any {
    const serialized: Record<string, any> = {};
    for (const [key, data] of Object.entries(fabricCutData)) {
        serialized[key] = {
            optimization: data.optimization,
            items: data.items.map((item: any) => ({
                id: item.id,
                location: item.location,
                width: item.width,
                drop: item.drop,
                controlSide: item.controlSide,
                bracketColour: item.bracketColour,
                chainOrMotor: item.chainOrMotor,
                roll: item.roll,
                material: item.material,
                fabricType: item.fabricType,
                fabricColour: item.fabricColour,
                bottomRailType: item.bottomRailType,
                bottomRailColour: item.bottomRailColour,
            })),
        };
    }
    return serialized;
}

/**
 * Parse a fabric key ("Material - FabricType - Colour") into inventory itemName + colorVariant
 * Inventory stores: itemName = "Material - FabricType", colorVariant = "Colour"
 */
function parseFabricKey(fabricKey: string): { itemName: string; colorVariant: string } {
    const parts = fabricKey.split(' - ');
    const colorVariant = parts.pop() || '';
    const itemName = parts.join(' - ');
    return { itemName, colorVariant };
}

/**
 * Build inventory requirements from optimization data + per-blind hardware.
 */
function buildInventoryRequirements(
    fabricCutData: Record<string, any>,
    tubeCutData: any,
    orderItems: any[] = []
) {
    type Req = { category: InventoryCategory; itemName: string; colorVariant?: string; quantityNeeded: number };
    const map = new Map<string, Req>();

    const add = (category: InventoryCategory, itemName: string, colorVariant: string | undefined, qty: number) => {
        const key = `${category}:${itemName}:${colorVariant || ''}`;
        if (map.has(key)) {
            map.get(key)!.quantityNeeded += qty;
        } else {
            map.set(key, { category, itemName, colorVariant, quantityNeeded: qty });
        }
    };

    // Fabric requirements
    for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
        const { itemName, colorVariant } = parseFabricKey(fabricKey);
        add('FABRIC', itemName, colorVariant, groupData.optimization.statistics.totalFabricNeeded);
    }

    // Bottom bar requirements
    for (const group of tubeCutData.groups) {
        add('BOTTOM_BAR', group.bottomRailType, group.bottomRailColour, group.piecesToDeduct);
    }

    // Per-blind hardware requirements
    for (const item of orderItems) {
        for (const hw of buildPerBlindHardware(item)) {
            add(hw.category as InventoryCategory, hw.itemName, hw.colorVariant, hw.qty);
        }
    }

    return Array.from(map.values());
}

/**
 * Get worksheet preview data
 */
export const getWorksheetPreview = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const worksheetData = await prisma.worksheetData.findUnique({
            where: { orderId: req.params.id as string },
        });

        if (!worksheetData) {
            throw new AppError(404, 'No worksheet data found. Send order to production first.');
        }

        // Also check inventory availability (including per-blind hardware)
        const fabricCutData = worksheetData.fabricCutData as Record<string, any>;
        const tubeCutData = worksheetData.tubeCutData as any;

        const order = await prisma.order.findUnique({
            where: { id: req.params.id as string },
            include: { items: { orderBy: { itemNumber: 'asc' } } },
        });

        const inventoryRequirements = buildInventoryRequirements(fabricCutData, tubeCutData, order?.items || []);
        const inventoryCheck = await InventoryService.checkAvailability(inventoryRequirements);

        res.json({
            success: true,
            data: {
                worksheetData,
                inventoryCheck,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Accept worksheets and deduct inventory
 */
export const acceptWorksheets = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;

        const worksheetData = await prisma.worksheetData.findUnique({
            where: { orderId: req.params.id as string },
        });

        if (!worksheetData) {
            throw new AppError(404, 'No worksheet data found');
        }

        if (worksheetData.acceptedAt) {
            throw new AppError(400, 'Worksheets already accepted');
        }

        const order = await prisma.order.findUnique({
            where: { id: req.params.id as string },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        // Load order items for hardware deduction
        const orderWithItems = await prisma.order.findUnique({
            where: { id: req.params.id as string },
            include: { items: { orderBy: { itemNumber: 'asc' } } },
        });
        const orderItems = orderWithItems?.items || [];

        // Build deduction list
        type Deduction = { category: InventoryCategory; itemName: string; colorVariant?: string; quantity: number; notes: string };
        const deductionMap = new Map<string, Deduction>();

        const addDeduction = (
            category: InventoryCategory,
            itemName: string,
            colorVariant: string | undefined,
            quantity: number,
            notes: string
        ) => {
            const key = `${category}:${itemName}:${colorVariant || ''}`;
            if (deductionMap.has(key)) {
                deductionMap.get(key)!.quantity += quantity;
            } else {
                deductionMap.set(key, { category, itemName, colorVariant, quantity, notes });
            }
        };

        const fabricCutData = worksheetData.fabricCutData as Record<string, any>;
        const tubeCutData = worksheetData.tubeCutData as any;

        // Fabric deductions
        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            const { itemName, colorVariant } = parseFabricKey(fabricKey);
            addDeduction(
                'FABRIC', itemName, colorVariant,
                groupData.optimization.statistics.totalFabricNeeded,
                `Order ${order.orderNumber} - ${groupData.optimization.statistics.usedStockSheets} sheets, ${groupData.optimization.statistics.efficiency}% efficiency`
            );
        }

        // Bottom bar deductions
        for (const group of tubeCutData.groups) {
            addDeduction(
                'BOTTOM_BAR', group.bottomRailType, group.bottomRailColour,
                group.piecesToDeduct,
                `Order ${order.orderNumber} - ${group.totalWidth}mm total, ${group.piecesToDeduct} pieces`
            );
        }

        // Per-blind hardware deductions (chains, brackets, clips, accessories, motors/winders)
        for (const item of orderItems) {
            for (const hw of buildPerBlindHardware(item)) {
                addDeduction(
                    hw.category as InventoryCategory, hw.itemName, hw.colorVariant,
                    hw.qty,
                    `Order ${order.orderNumber} - blind #${item.itemNumber} (${item.location})`
                );
            }
        }

        const deductions = Array.from(deductionMap.values());

        // Deduct inventory
        const deductionResults = await InventoryService.deductForOrder(order.id, deductions);

        // Mark worksheets as accepted
        await prisma.worksheetData.update({
            where: { orderId: req.params.id as string },
            data: {
                acceptedAt: new Date(),
                acceptedBy: authReq.user?.email || 'unknown',
            },
        });

        logger.info(`Worksheets accepted for order ${order.orderNumber} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'Worksheets accepted and inventory deducted',
            data: { deductions: deductionResults },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Recalculate optimization for an order
 */
export const recalculateWorksheets = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id as string },
            include: { items: { orderBy: { itemNumber: 'asc' } } },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        if (order.status !== OrderStatus.PRODUCTION) {
            throw new AppError(400, 'Only orders in production can be recalculated');
        }

        // Check if already accepted
        const existing = await prisma.worksheetData.findUnique({
            where: { orderId: order.id },
        });

        if (existing?.acceptedAt) {
            throw new AppError(400, 'Cannot recalculate accepted worksheets');
        }

        const result = await runOptimization(order);

        res.json({
            success: true,
            message: 'Optimization recalculated',
            data: {
                worksheetData: result.worksheetData,
                inventoryCheck: result.inventoryCheck,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Download worksheet as CSV or PDF
 */
export const downloadWorksheet = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { type } = req.params; // fabric-cut-csv, fabric-cut-pdf, tube-cut-csv, tube-cut-pdf

        const order = await prisma.order.findUnique({
            where: { id: req.params.id as string },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        const worksheetData = await prisma.worksheetData.findUnique({
            where: { orderId: req.params.id as string },
        });

        if (!worksheetData) {
            throw new AppError(404, 'No worksheet data found');
        }

        const orderInfo = {
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            orderDate: order.orderDate,
            customerReference: order.customerReference ?? undefined,
            notes: order.notes ?? undefined,
        };

        const fabricCutData = worksheetData.fabricCutData as Record<string, any>;
        const tubeCutData = worksheetData.tubeCutData as any;

        switch (type) {
            case 'fabric-cut-csv': {
                const csv = WorksheetExportService.generateFabricCutCSV(orderInfo, fabricCutData);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-fabric-cut.csv"`);
                res.send(csv);
                break;
            }
            case 'fabric-cut-pdf': {
                try {
                    const fabricDoc = WorksheetExportService.generateFabricCutPDF(orderInfo, fabricCutData);
                    // Buffer entire PDF before sending — catches async errors
                    const fabricChunks: Buffer[] = [];
                    fabricDoc.on('data', (chunk: Buffer) => fabricChunks.push(chunk));
                    await new Promise<void>((resolve, reject) => {
                        fabricDoc.on('end', resolve);
                        fabricDoc.on('error', reject);
                        fabricDoc.end();
                    });
                    const fabricPdf = Buffer.concat(fabricChunks);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-fabric-cut.pdf"`);
                    res.setHeader('Content-Length', fabricPdf.length);
                    res.send(fabricPdf);
                } catch (pdfErr: any) {
                    logger.error('Fabric PDF generation error:', { message: pdfErr.message, stack: pdfErr.stack });
                    throw new AppError(500, `PDF generation failed: ${pdfErr.message}`);
                }
                break;
            }
            case 'tube-cut-csv': {
                const csv = WorksheetExportService.generateTubeCutCSV(orderInfo, tubeCutData);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-tube-cut.csv"`);
                res.send(csv);
                break;
            }
            case 'tube-cut-pdf': {
                try {
                    const tubeDoc = WorksheetExportService.generateTubeCutPDF(orderInfo, tubeCutData);
                    const tubeChunks: Buffer[] = [];
                    tubeDoc.on('data', (chunk: Buffer) => tubeChunks.push(chunk));
                    await new Promise<void>((resolve, reject) => {
                        tubeDoc.on('end', resolve);
                        tubeDoc.on('error', reject);
                        tubeDoc.end();
                    });
                    const tubePdf = Buffer.concat(tubeChunks);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-tube-cut.pdf"`);
                    res.setHeader('Content-Length', tubePdf.length);
                    res.send(tubePdf);
                } catch (pdfErr: any) {
                    logger.error('Tube PDF generation error:', { message: pdfErr.message, stack: pdfErr.stack });
                    throw new AppError(500, `PDF generation failed: ${pdfErr.message}`);
                }
                break;
            }
            default:
                throw new AppError(400, 'Invalid download type. Use: fabric-cut-csv, fabric-cut-pdf, tube-cut-csv, tube-cut-pdf');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Update order status (admin)
 */
export const updateOrderStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const { status } = req.body;

        if (!Object.values(OrderStatus).includes(status)) {
            throw new AppError(400, `Invalid status. Must be one of: ${Object.values(OrderStatus).join(', ')}`);
        }

        const updated = await prisma.order.update({
            where: { id: req.params.id as string },
            data: { status },
        });

        logger.info(`Order status updated: ${updated.orderNumber} → ${status} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'Order status updated successfully',
            data: { order: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Soft-delete (trash) an order – Admin only
 */
export const trashOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const orderId = req.params.id as string;
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new AppError(404, 'Order not found');
        if (order.deletedAt) throw new AppError(400, 'Order is already in trash');

        await prisma.order.update({
            where: { id: orderId },
            data: { deletedAt: new Date(), status: 'CANCELLED' },
        });

        logger.info(`Order ${order.orderNumber} moved to trash by ${authReq.user?.email}`);
        res.json({ success: true, message: 'Order moved to trash' });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all trashed orders – Admin only (auto-purges orders > 10 days old)
 */
export const getTrashOrders = async (
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Auto-purge orders older than 10 days
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        await prisma.order.deleteMany({
            where: { deletedAt: { lt: tenDaysAgo } },
        });

        const orders = await prisma.order.findMany({
            where: { deletedAt: { not: null } },
            include: { items: true },
            orderBy: { deletedAt: 'desc' },
        });

        res.json({ success: true, data: { orders, count: orders.length } });
    } catch (error) {
        next(error);
    }
};

/**
 * Restore an order from trash – Admin only
 */
export const restoreOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const orderId = req.params.id as string;
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new AppError(404, 'Order not found');
        if (!order.deletedAt) throw new AppError(400, 'Order is not in trash');

        await prisma.order.update({
            where: { id: orderId },
            data: { deletedAt: null, status: 'PENDING' },
        });

        res.json({ success: true, message: 'Order restored' });
    } catch (error) {
        next(error);
    }
};

/**
 * Permanently delete (purge) an order from trash – Admin only
 */
export const purgeOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const orderId = req.params.id as string;
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new AppError(404, 'Order not found');
        if (!order.deletedAt) throw new AppError(400, 'Order must be in trash before permanent deletion');

        await prisma.order.delete({ where: { id: orderId } });
        res.json({ success: true, message: 'Order permanently deleted' });
    } catch (error) {
        next(error);
    }
};

/**
 * Edit order details (items, notes, customerReference) — Admin only
 * Only allowed for PENDING or CONFIRMED orders
 */
export const editOrderDetails = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const orderId = req.params.id as string;
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });
        if (!order) throw new AppError(404, 'Order not found');
        if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
            throw new AppError(400, 'Order can only be edited when PENDING or CONFIRMED');
        }

        const EditOrderSchema = z.object({
            notes: z.string().optional(),
            customerReference: z.string().max(255).optional().nullable(),
            items: z.array(OrderItemSchema).min(1, 'At least one item is required').optional(),
        });

        const body = EditOrderSchema.parse(req.body);

        if (body.items) {
            // Delete existing items and recreate from submitted data
            await prisma.orderItem.deleteMany({ where: { orderId } });

            const newItems = body.items.map((item: any, index: number) => {
                const w = parseInt(item.width) || 0;
                const d = parseInt(item.drop) || 0;
                const motorDeduction = getMotorDeduction(item.chainOrMotor);
                return {
                    orderId,
                    itemNumber: index + 1,
                    itemType: 'blind',
                    location: item.location || '',
                    width: w,
                    drop: d,
                    fixing: item.fixing || null,
                    bracketType: item.bracketType || null,
                    bracketColour: item.bracketColour || null,
                    controlSide: item.controlSide || 'Left',
                    chainOrMotor: item.chainOrMotor || null,
                    chainType: item.chainType || null,
                    roll: item.roll || 'Front',
                    material: item.material || null,
                    fabricType: item.fabricType || null,
                    fabricColour: item.fabricColour || null,
                    bottomRailType: item.bottomRailType || null,
                    bottomRailColour: item.bottomRailColour || null,
                    calculatedWidth: w > 0 ? w - 28 : null,
                    calculatedDrop: d > 0 ? d + 200 : null,
                    fabricCutWidth: w > 0 ? w - motorDeduction : null,
                    price: item.price || 0,
                    fabricGroup: item.fabricGroup || null,
                    discountPercent: item.discountPercent || 0,
                    fabricPrice: item.fabricPrice || null,
                    motorPrice: item.motorPrice || null,
                    bracketPrice: item.bracketPrice || null,
                    chainPrice: item.chainPrice || null,
                    clipsPrice: item.clipsPrice || null,
                    componentPrice: item.componentPrice || null,
                };
            });

            await prisma.orderItem.createMany({ data: newItems });

            // Recalculate totals
            const subtotal = body.items.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    subtotal,
                    total: subtotal,
                    ...(body.notes !== undefined && { notes: body.notes }),
                    ...(body.customerReference !== undefined && { customerReference: body.customerReference }),
                },
            });
        } else {
            // Just update order-level fields
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    ...(body.notes !== undefined && { notes: body.notes }),
                    ...(body.customerReference !== undefined && { customerReference: body.customerReference }),
                },
            });
        }

        const updated = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { orderBy: { itemNumber: 'asc' } } },
        });

        res.json({ success: true, message: 'Order updated', data: { order: updated } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(400, error.errors[0].message));
        } else {
            next(error);
        }
    }
};

// ─── Winder (chain-operated) detection ───────────────────────────────────────
function isWinder(chainOrMotor: string | null | undefined): boolean {
    if (!chainOrMotor) return false;
    return chainOrMotor === 'TBS winder-32mm' || chainOrMotor === 'Acmeda winder-29mm';
}

/**
 * Download blind labels as PDF for an order (ADMIN / WAREHOUSE)
 * GET /api/web-orders/:id/labels/download
 *
 * Label format (per blind, one page each) — 62mm × 100mm (QL-800 DK roll):
 *   [Logo]                              [N of Total]
 *   ─────────────────────────────────────────────
 *   Order ref: YYNNNN.S
 *   Cx Ref: Company-customerReference
 *
 *   W: 0000   H: 0000
 *   {Location}
 *   {Fabric} - {Colour}
 *   {ControlSide} {Roll} Chain {Xmm}  ← winder
 *   {ControlSide} {Roll} {MotorName}  ← motor
 */
export const downloadLabels = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const id = req.params.id as string;

        const order = await prisma.order.findUnique({
            where: { id, deletedAt: null },
            include: {
                items: { orderBy: { itemNumber: 'asc' } },
                customer: true,
            },
        });

        if (!order) throw new AppError(404, 'Order not found');

        const PDFDocument = (await import('pdfkit' as any)).default ?? (await import('pdfkit' as any));

        // 62mm × 100mm portrait (QL-800 DK roll width = 62mm)
        const MM = 2.835; // 1mm in PDF points
        const LBL_W = 62 * MM;  // ≈ 175.8pt
        const LBL_H = 100 * MM; // ≈ 283.5pt
        const PAD = 3 * MM;     // 3mm margin on each side
        const innerW = LBL_W - PAD * 2;

        const doc = new PDFDocument({ size: [LBL_W, LBL_H], margin: 0, autoFirstPage: false });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="labels-${order.orderNumber}.pdf"`);
        doc.pipe(res);

        // Logo path — copied to backend/assets/ in Docker build
        const logoPath = path.join(__dirname, '../../assets/logo.png');

        // Customer company for Cx Ref line
        const customerCompany = (order.customer as any)?.company || (order.customer as any)?.name || order.customerName;
        const cxRefLine = order.customerReference
            ? `${customerCompany}-${order.customerReference}`
            : customerCompany;

        const total = order.items.length;

        for (let idx = 0; idx < order.items.length; idx++) {
            const item = order.items[idx];
            doc.addPage();

            const chainOrMotor = item.chainOrMotor ?? '';
            const drop = item.drop ?? 0;

            // Control line: "Left Back Chain 1200mm" or "Left Back Automate 1.1NM..."
            const controlParts = [item.controlSide ?? '', item.roll ?? ''].filter(Boolean);
            if (isWinder(chainOrMotor)) {
                controlParts.push(`Chain ${getChainLength(drop)}mm`);
            } else if (chainOrMotor) {
                controlParts.push(chainOrMotor);
            }
            const controlLine = controlParts.join(' ');

            let y = PAD;

            // ── Header: Logo (left) + "N of M" (right) ──────────────────────
            const blindNo = `${idx + 1} of ${total}`;
            const logoH = 9 * MM;
            const logoW = 22 * MM;
            try {
                doc.image(logoPath, PAD, y, { height: logoH, width: logoW, fit: [logoW, logoH] });
            } catch {
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#000')
                   .text('Signature Shades', PAD, y + 2 * MM, { width: logoW });
            }
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
               .text(blindNo, PAD, y + 2.5 * MM, { align: 'right', width: innerW });

            y += logoH + 1.5 * MM;

            // ── Separator ────────────────────────────────────────────────────
            doc.moveTo(PAD, y).lineTo(LBL_W - PAD, y).lineWidth(0.5).strokeColor('#000').stroke();
            y += 2 * MM;

            // ── Order ref ────────────────────────────────────────────────────
            doc.fontSize(7.5).font('Helvetica').fillColor('#000')
               .text(`Order ref: ${order.orderNumber}`, PAD, y, { width: innerW });
            y += 4.5 * MM;

            // ── Cx Ref ───────────────────────────────────────────────────────
            doc.fontSize(7.5).font('Helvetica')
               .text(`Cx Ref: ${cxRefLine}`, PAD, y, { width: innerW });
            y += 5.5 * MM;

            // ── W × H (large bold) ───────────────────────────────────────────
            doc.fontSize(12).font('Helvetica-Bold')
               .text(`W: ${item.width ?? 0}   H: ${item.drop ?? 0}`, PAD, y, { width: innerW });
            y += 8 * MM;

            // ── Location ─────────────────────────────────────────────────────
            doc.fontSize(9).font('Helvetica')
               .text(item.location ?? '', PAD, y, { width: innerW });
            y += 5.5 * MM;

            // ── Fabric - Colour ──────────────────────────────────────────────
            const fabricLine = [item.fabricType, item.fabricColour].filter(Boolean).join(' - ');
            doc.fontSize(9).font('Helvetica')
               .text(fabricLine, PAD, y, { width: innerW });
            y += 5.5 * MM;

            // ── Control line ─────────────────────────────────────────────────
            doc.fontSize(9).font('Helvetica')
               .text(controlLine, PAD, y, { width: innerW });
        }

        doc.end();
    } catch (error) {
        next(error);
    }
};
