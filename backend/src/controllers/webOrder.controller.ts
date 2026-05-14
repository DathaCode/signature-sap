import { Request, Response, NextFunction } from 'express';
import { PrismaClient, OrderStatus, InventoryCategory } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { z } from 'zod';
import path from 'path';
import pricingService from '../services/pricing.service';
import comprehensivePricingService from '../services/comprehensivePricing.service';
import { sheerCurtainPricingService } from '../services/sheerCurtainPricing.service';

import { FabricCutOptimizerService } from '../services/fabricCutOptimizer.service';
import { TubeCutOptimizer, TubeBlindInput } from '../services/tubeCutOptimizer.service';
import { InventoryService } from '../services/inventory.service';
import { WorksheetExportService } from '../services/worksheetExport.service';

/**
 * Determine supplier key from chainOrMotor string for customer discount lookup.
 */
function getSupplierKey(chainOrMotor?: string): 'acmeda' | 'tbs' | 'motorised' {
    if (!chainOrMotor) return 'acmeda';
    const lower = chainOrMotor.toLowerCase();
    if (lower.includes('tbs')) return 'tbs';
    if (lower.includes('acmeda')) return 'acmeda';
    return 'motorised';
}

/**
 * Get customer discount for a fabric group + supplier from user's stored discounts.
 */
async function getCustomerDiscount(
    userId: string | undefined,
    fabricGroup: number,
    chainOrMotor?: string
): Promise<number | null> {
    if (!userId) return null;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { discounts: true },
    });
    const discounts = user?.discounts as Record<string, { acmeda: number; tbs: number; motorised: number }> | null;
    if (!discounts) return null;
    const groupKey = `G${fabricGroup}`;
    const supplierKey = getSupplierKey(chainOrMotor);
    const val = discounts[groupKey]?.[supplierKey];
    return typeof val === 'number' ? val : null;
}

// Motor-specific width deductions for fabric cutting
const MOTOR_DEDUCTIONS: Record<string, number> = {
    'TBS winder-32mm': 32,
    'Acmeda winder-29mm': 29,
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

/**
 * Middleware: resolve :id param — accepts UUID or orderNumber (e.g. "260031.S").
 * If it's an orderNumber, replaces req.params.id with the actual UUID.
 */
export const resolveOrderId = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const param = req.params.id as string;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
        if (!isUuid) {
            const order = await prisma.order.findUnique({
                where: { orderNumber: param },
                select: { id: true },
            });
            if (!order) {
                throw new AppError(404, 'Order not found');
            }
            (req.params as any).id = order.id;
        }
        next();
    } catch (error) {
        next(error);
    }
};

// Validation schemas
// Use coerce for width/drop to handle string→number from JSON
// Use string() instead of enum() for controlSide/roll to handle empty strings
const OrderItemSchema = z.object({
    location: z.string().min(1, 'Location is required'),
    width: z.coerce.number().int().min(350, 'Width must be at least 350mm').max(2950, 'Width must be at most 2950mm'),
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
    // Pelmet section (also available for blinds)
    requiresPelmet: z.boolean().optional(),
    pelmetType: z.string().optional(),
    pelmetColor: z.string().optional(),
    pelmetSize: z.string().optional(),
    pelmetCustomSize: z.coerce.number().optional(),
});

// Curtain order item schema
const CurtainOrderItemSchema = z.object({
    location: z.string().min(1, 'Location is required'),
    width: z.coerce.number().int().positive('Width must be a positive number'),
    drop: z.coerce.number().int().positive('Drop must be a positive number'),

    // Curtain configuration
    curtainType: z.string().optional(),
    hem: z.coerce.number().optional(),
    fabric: z.string().optional(),
    fabricColour: z.string().optional(),
    installation: z.string().optional(),
    bracketType: z.string().optional(),
    trackColour: z.string().optional(),
    openingType: z.string().optional(),
    wandSize: z.coerce.number().optional(),
    fullness: z.coerce.number().optional(),

    // Track Type section
    requiresTracks: z.boolean().optional(),
    trackType: z.string().optional(),
    motorType: z.string().optional(),
    trackControlSide: z.string().optional(),
    remotes: z.string().optional(),
    chargerHub: z.array(z.string()).optional(),
    trackColor: z.string().optional(),

    // Drop deduction
    requiresDropDeduction: z.boolean().optional(),
    dropDeductionValue: z.coerce.number().optional(),

    // Bend section
    requiresBentTracks: z.boolean().optional(),
    bendType: z.string().optional(),
    bendQty: z.coerce.number().optional(),
    bendFilePath: z.string().optional(),

    // Pelmet section
    requiresPelmet: z.boolean().optional(),
    pelmetType: z.string().optional(),
    pelmetColor: z.string().optional(),
    pelmetSize: z.string().optional(),
    pelmetCustomSize: z.coerce.number().optional(),

    // Frontend may send calculated/pricing fields - accept but recalculate server-side
    fabricGroup: z.string().optional(),
    price: z.coerce.number().optional(),
    deductedDrop: z.coerce.number().optional(),
    hookCount: z.coerce.number().optional(),
    leftHooks: z.coerce.number().optional(),
    rightHooks: z.coerce.number().optional(),
    bracketCount: z.coerce.number().optional(),
    wandCount: z.coerce.number().optional(),
    fabricLength: z.coerce.number().optional(),
    fabricMeters: z.coerce.number().optional(),
    dropSurcharge: z.coerce.number().optional(),
    fabricCost: z.coerce.number().optional(),
    hookCost: z.coerce.number().optional(),
    bracketCost: z.coerce.number().optional(),
    wandCost: z.coerce.number().optional(),
    subtotal: z.coerce.number().optional(),
    gst: z.coerce.number().optional(),
    total: z.coerce.number().optional(),
});

const CreateOrderSchema = z.object({
    productType: z.enum(['BLINDS', 'CURTAINS', 'SHUTTERS']),
    orderDate: z.string().optional(),
    dateRequired: z.string().optional(),
    items: z.array(z.any()).min(1, 'At least one item is required'),
    notes: z.string().optional(),
    customerReference: z.string().max(255).optional(),
    siteAddress: z.string().optional(),
    contactNumber: z.string().max(50).optional(),
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

        if (validatedData.productType === 'CURTAINS') {
            // ================================================================
            // CURTAIN ORDER PROCESSING
            // ================================================================
            for (let i = 0; i < validatedData.items.length; i++) {
                const item = validatedData.items[i] as z.infer<typeof CurtainOrderItemSchema>;

                const w = Number(item.width);
                const d = Number(item.drop);
                if (!w || w < 100 || w > 6000) {
                    throw new AppError(400, `Item ${i + 1}: Width must be between 100mm and 6000mm`);
                }
                if (!d || d < 100) {
                    throw new AppError(400, `Item ${i + 1}: Drop must be at least 100mm`);
                }
                item.width = w;
                item.drop = d;

                let price = 0;
                let curtainCalc: any = null;

                // Calculate curtain pricing if required fields are present
                if (item.fabric && item.openingType && item.fullness && item.bracketType && item.fabricGroup) {
                    try {
                        curtainCalc = await sheerCurtainPricingService.calculateCurtainMetrics({
                            width: item.width,
                            drop: item.drop,
                            openingType: item.openingType,
                            fullness: item.fullness,
                            bracketType: item.bracketType,
                            fabric: item.fabric,
                            fabricGroup: item.fabricGroup,
                            requiresDropDeduction: item.requiresDropDeduction !== false,
                            dropDeductionValue: item.dropDeductionValue ? Number(item.dropDeductionValue) : 35,
                            requiresTracks: item.requiresTracks,
                            trackType: item.trackType,
                            motorType: item.motorType,
                            remotes: item.remotes,
                            chargerHub: item.chargerHub,
                            userId: authReq.user?.id,
                        });
                        price = curtainCalc.total;
                    } catch (pricingError) {
                        logger.warn(`Curtain pricing failed for item ${i + 1}: ${pricingError}`);
                    }
                }

                processedItems.push({
                    itemNumber: i + 1,
                    itemType: 'curtain',
                    location: item.location,
                    width: item.width,
                    drop: item.drop,

                    // Curtain configuration fields
                    curtainType: item.curtainType || 'S Fold',
                    hem: Number(item.hem) || 70,
                    fabricColour: item.fabricColour || null,
                    material: item.fabric || null, // Store fabric name in material field
                    installation: item.installation || null,
                    bracketType: item.bracketType || null,
                    trackColour: item.trackColour || null,
                    openingType: item.openingType || null,
                    wandSize: Number(item.wandSize) || 1250,
                    fullness: item.fullness ? Number(item.fullness) : null,

                    // Track Type section
                    requiresTracks: item.requiresTracks || false,
                    trackType: item.trackType || null,
                    motorType: item.motorType || null,
                    trackControlSide: item.trackControlSide || null,
                    remotes: item.remotes || null,
                    chargerHub: item.chargerHub?.length ? JSON.stringify(item.chargerHub) : null,
                    trackColor: item.trackColor || null,

                    // Drop deduction
                    requiresDropDeduction: item.requiresDropDeduction !== false,
                    dropDeductionValue: item.dropDeductionValue ? Number(item.dropDeductionValue) : 35,

                    // Bend section
                    requiresBentTracks: item.requiresBentTracks || false,
                    bendType: item.bendType || null,
                    bendQty: item.bendQty || null,
                    bendFilePath: item.bendFilePath || null,

                    // Pelmet section
                    requiresPelmet: item.requiresPelmet || false,
                    pelmetType: item.pelmetType || null,
                    pelmetColor: item.pelmetColor || null,
                    pelmetSize: item.pelmetSize || null,
                    pelmetCustomSize: item.pelmetCustomSize || null,

                    // Calculated fields
                    deductedDrop: curtainCalc?.deductedDrop || null,
                    hookCount: curtainCalc?.hookCount || null,
                    leftHooks: curtainCalc?.leftHooks || null,
                    rightHooks: curtainCalc?.rightHooks || null,
                    bracketCount: curtainCalc?.bracketCount || null,
                    wandCount: curtainCalc?.wandCount || null,
                    fabricLength: curtainCalc?.fabricLength || null,
                    dropSurcharge: curtainCalc?.dropSurcharge || 0,

                    // Pricing
                    price,
                    fabricPrice: curtainCalc?.fabricCost || null,
                    bracketPrice: null,
                    // hookCost repurposed: stores fullness surcharge for curtain items
                    hookCost: curtainCalc?.fullnessSurcharge ?? null,
                    wandCost: null,
                    // Reuse blind price columns for curtain motor/remote/charger costs
                    motorPrice: curtainCalc?.motorCost || null,
                    chainPrice: curtainCalc?.remoteCost || null,
                    clipsPrice: curtainCalc?.chargerCost || null,
                    discountPercent: 0,
                });

                subtotal += price;
            }
        } else {
            // ================================================================
            // BLIND ORDER PROCESSING (existing logic)
            // ================================================================
            for (let i = 0; i < validatedData.items.length; i++) {
                const item = validatedData.items[i];

            let price = 0;
            let fabricGroup: number | null = null;
            let discountPercent = 0;
            let fabricBasePrice: number | null = null;
            let fabricPrice: number | null = null;
            let motorPrice: number | null = null;
            let bracketPrice: number | null = null;
            // Chain, clips, componentPrice are no longer charged
            const chainPrice: number | null = null;
            const clipsPrice: number | null = null;
            const componentPrice: number | null = null;

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
                    fabricBasePrice = breakdown.fabricBasePrice;
                    fabricPrice = breakdown.fabricPrice;
                    motorPrice = breakdown.motorChainPrice;
                    bracketPrice = breakdown.bracketPrice;
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
                    fabricBasePrice = priceResult.basePrice;
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
                fabricBasePrice = priceResult.basePrice;
            }

            // Apply customer-specific discount override if configured by admin
            if (fabricGroup !== null && fabricBasePrice !== null) {
                const customDiscount = await getCustomerDiscount(
                    authReq.user?.id,
                    fabricGroup,
                    item.chainOrMotor
                );
                if (customDiscount !== null) {
                    const newFabricPrice = parseFloat((fabricBasePrice * (1 - customDiscount / 100)).toFixed(2));
                    if (fabricPrice !== null && motorPrice !== null) {
                        // Comprehensive pricing: total = fabric + motor + bracket only
                        fabricPrice = newFabricPrice;
                        price = parseFloat((
                            newFabricPrice +
                            (motorPrice || 0) +
                            (bracketPrice || 0)
                        ).toFixed(2));
                    } else {
                        // Basic pricing: fabric is the only component
                        price = newFabricPrice;
                    }
                    discountPercent = customDiscount;
                }
            }

            const motorDeduction = getMotorDeduction(item.chainOrMotor);

            processedItems.push({
                itemNumber: i + 1,
                ...item,
                calculatedWidth: item.width - motorDeduction,
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
                siteAddress: validatedData.siteAddress || null,
                contactNumber: validatedData.contactNumber || null,
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

        const param = req.params.id as string;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
        const whereClause = isUuid ? { id: param } : { orderNumber: param };

        const order = await prisma.order.findUnique({
            where: whereClause,
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

        // Check authorization — ADMIN and WAREHOUSE can view any order
        if (authReq.user.role !== 'ADMIN' && authReq.user.role !== 'WAREHOUSE' && order.userId !== authReq.user.id) {
            throw new AppError(403, 'Access denied');
        }

        // WAREHOUSE can only view PRODUCTION, COMPLETED, CANCELLED orders
        if (authReq.user.role === 'WAREHOUSE' && !['PRODUCTION', 'COMPLETED', 'CANCELLED'].includes(order.status)) {
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
        const { status, productType, userId, customerName, search, dateFrom, dateTo } = req.query;

        // Warehouse agents can only see PRODUCTION, COMPLETED, CANCELLED orders
        const warehouseStatuses: OrderStatus[] = ['PRODUCTION', 'COMPLETED', 'CANCELLED'];
        let statusFilter: OrderStatus | undefined;
        let statusIn: OrderStatus[] | undefined;

        if (user?.role === 'WAREHOUSE') {
            if (status && warehouseStatuses.includes(status as OrderStatus)) {
                statusFilter = status as OrderStatus;
            } else {
                // No specific status or invalid status — show all allowed
                statusIn = warehouseStatuses;
            }
        } else {
            statusFilter = status as OrderStatus | undefined;
        }

        const orders = await prisma.order.findMany({
            where: {
                deletedAt: null, // Exclude trashed orders
                ...(statusFilter && { status: statusFilter }),
                ...(statusIn && !statusFilter && { status: { in: statusIn } }),
                ...(productType && { productType: productType as any }),
                ...(user?.role !== 'WAREHOUSE' && userId && { userId: userId as string }),
                ...(user?.role !== 'WAREHOUSE' && (customerName || search) && {
                    OR: [
                        { user: { name: { contains: (search || customerName) as string, mode: 'insensitive' as const } } },
                        { customerReference: { contains: (search || customerName) as string, mode: 'insensitive' as const } },
                        { orderNumber: { contains: (search || customerName) as string, mode: 'insensitive' as const } },
                    ],
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

        const worksheetResult = order.productType === 'CURTAINS'
            ? await runCurtainWorksheet(order)
            : await runOptimization(order);

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
                stockDimensions: `2950×continuous`,
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
            chainOrMotor: item.chainOrMotor,
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
 * Generate curtain worksheet data (replaces blind optimization for CURTAINS orders)
 */
async function runCurtainWorksheet(order: any) {
    const items = order.items;

    type CurtainRow = {
        itemNumber: number;
        location: string;
        width: number;
        deductedDrop: number;
        openingType: string;
        fullness: number;
        fabric: string;
        fabricColour: string;
        singleHooks: number | null;
        leftHooks: number | null;
        rightHooks: number | null;
        fabricMeters: number;
        bracketType: string;
        bracketCount: number;
        wandCount: number;
        trackColour: string;
        // Track type details
        requiresTracks: boolean;
        trackType: string | null;
        motorType: string | null;
        remotes: string | null;
        chargerHub: string | null;
        // Bend details
        requiresBentTracks: boolean;
        bendType: string | null;
        bendQty: number | null;
    };

    const rows: CurtainRow[] = [];
    let totalHooks = 0;
    let totalWands = 0;
    let totalBracketsStandard = 0;
    let totalBracketsExtended = 0;
    let totalBracketsCeiling = 0;
    let totalFabricMeters = 0;

    for (const item of items) {
        const deductionMm = item.requiresDropDeduction !== false ? (item.dropDeductionValue ?? 35) : 0;
        const deductedDrop = item.drop - deductionMm;

        const fullness = item.fullness ?? 120;
        const openingType = item.openingType ?? 'Single Open';
        const lookup = sheerCurtainPricingService.lookupBreakpoints(item.width, openingType, fullness);
        const bracketCount = sheerCurtainPricingService.getBracketCount(item.width);
        const wandCount = (openingType === 'Centre Open' || openingType === 'Free Fold') ? 2 : 1;

        rows.push({
            itemNumber: item.itemNumber,
            location: item.location,
            width: item.width,
            deductedDrop,
            openingType,
            fullness,
            fabric: item.material ?? '',           // curtain fabric name stored in material field
            fabricColour: item.fabricColour ?? '',
            singleHooks: openingType !== 'Centre Open' ? lookup.hookCount : null,
            leftHooks: lookup.leftHooks ?? null,
            rightHooks: lookup.rightHooks ?? null,
            fabricMeters: lookup.fabricMeters,
            bracketType: item.bracketType ?? 'Standard',
            bracketCount,
            wandCount,
            trackColour: item.trackColor ?? item.trackColour ?? '',
            requiresTracks: item.requiresTracks ?? false,
            trackType: item.trackType ?? null,
            motorType: item.motorType ?? null,
            remotes: item.remotes ?? null,
            chargerHub: item.chargerHub ? (() => { try { return JSON.parse(item.chargerHub!).join(', '); } catch { return item.chargerHub; } })() : null,
            requiresBentTracks: item.requiresBentTracks ?? false,
            bendType: item.bendType ?? null,
            bendQty: item.bendQty ?? null,
        });

        totalHooks += lookup.hookCount;
        totalWands += wandCount;
        if ((item.bracketType ?? 'Standard') === 'Extended') {
            totalBracketsExtended += bracketCount;
        } else if (item.bracketType === 'Ceiling') {
            totalBracketsCeiling += bracketCount;
        } else {
            totalBracketsStandard += bracketCount;
        }
        totalFabricMeters += lookup.fabricMeters;
    }

    const curtainData = {
        type: 'CURTAINS' as const,
        rows,
        totals: {
            totalHooks,
            totalWands,
            totalBracketsStandard,
            totalBracketsExtended,
            totalBracketsCeiling,
            totalFabricMeters: Math.round(totalFabricMeters * 1000) / 1000,
        },
    };

    // Build inventory requirements for curtain order
    type Req = { category: InventoryCategory; itemName: string; colorVariant?: string; quantityNeeded: number };
    const invReqs: Req[] = [];

    if (totalHooks > 0) {
        invReqs.push({ category: 'SHEER_HOOK', itemName: 'S-Fold Hook', colorVariant: undefined, quantityNeeded: totalHooks });
    }
    if (totalBracketsStandard > 0) {
        invReqs.push({ category: 'SHEER_BRACKET', itemName: 'Standard Bracket', colorVariant: undefined, quantityNeeded: totalBracketsStandard });
    }
    if (totalBracketsExtended > 0) {
        invReqs.push({ category: 'SHEER_BRACKET', itemName: 'Extended Bracket', colorVariant: undefined, quantityNeeded: totalBracketsExtended });
    }
    if (totalBracketsCeiling > 0) {
        invReqs.push({ category: 'SHEER_BRACKET', itemName: 'Ceiling Bracket', colorVariant: undefined, quantityNeeded: totalBracketsCeiling });
    }
    if (totalWands > 0) {
        invReqs.push({ category: 'SHEER_WAND', itemName: 'Wand 1250mm', colorVariant: undefined, quantityNeeded: totalWands });
    }

    // Fabric per fabric+colour group
    const fabricMap = new Map<string, number>();
    for (const row of rows) {
        const key = `${row.fabric}::${row.fabricColour}`;
        fabricMap.set(key, (fabricMap.get(key) ?? 0) + row.fabricMeters);
    }
    for (const [key, meters] of fabricMap) {
        const sepIdx = key.indexOf('::');
        const fabricName = key.slice(0, sepIdx);
        const colour = key.slice(sepIdx + 2);
        invReqs.push({ category: 'SHEER_FABRIC', itemName: fabricName, colorVariant: colour || undefined, quantityNeeded: Math.ceil(meters * 10) / 10 });
    }

    const inventoryCheck = await InventoryService.checkAvailability(invReqs);

    const worksheetData = await prisma.worksheetData.upsert({
        where: { orderId: order.id },
        create: {
            orderId: order.id,
            fabricCutData: curtainData as any,
            tubeCutData: { groups: [], totalPiecesNeeded: 0 } as any,
            totalFabricMm: Math.round(totalFabricMeters * 1000),
            totalTubePieces: 0,
        },
        update: {
            fabricCutData: curtainData as any,
            tubeCutData: { groups: [], totalPiecesNeeded: 0 } as any,
            totalFabricMm: Math.round(totalFabricMeters * 1000),
            totalTubePieces: 0,
            acceptedAt: null,
            acceptedBy: null,
        },
    });

    return { worksheetData, inventoryCheck };
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
                bracketType: item.bracketType,
                fabricCutWidth: item.width - getMotorDeduction(item.chainOrMotor),
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
 * Build and check inventory requirements for curtain orders
 */
async function buildCurtainInventoryCheck(curtainData: any) {
    type Req = { category: InventoryCategory; itemName: string; colorVariant?: string; quantityNeeded: number };
    const reqs: Req[] = [];
    const t = curtainData.totals;

    if (t.totalHooks > 0)
        reqs.push({ category: 'SHEER_HOOK', itemName: 'S-Fold Hook', quantityNeeded: t.totalHooks });
    if (t.totalBracketsStandard > 0)
        reqs.push({ category: 'SHEER_BRACKET', itemName: 'Standard Bracket', quantityNeeded: t.totalBracketsStandard });
    if (t.totalBracketsExtended > 0)
        reqs.push({ category: 'SHEER_BRACKET', itemName: 'Extended Bracket', quantityNeeded: t.totalBracketsExtended });
    if (t.totalBracketsCeiling > 0)
        reqs.push({ category: 'SHEER_BRACKET', itemName: 'Ceiling Bracket', quantityNeeded: t.totalBracketsCeiling });
    if (t.totalWands > 0)
        reqs.push({ category: 'SHEER_WAND', itemName: 'Wand 1250mm', quantityNeeded: t.totalWands });

    const fabricMap = new Map<string, number>();
    for (const row of curtainData.rows) {
        const key = `${row.fabric}::${row.fabricColour}`;
        fabricMap.set(key, (fabricMap.get(key) ?? 0) + row.fabricMeters);
    }
    for (const [key, meters] of fabricMap) {
        const sepIdx = key.indexOf('::');
        const fabricName = key.slice(0, sepIdx);
        const colour = key.slice(sepIdx + 2);
        reqs.push({ category: 'SHEER_FABRIC', itemName: fabricName, colorVariant: colour || undefined, quantityNeeded: Math.ceil(meters * 10) / 10 });
    }

    return InventoryService.checkAvailability(reqs);
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

        const fabricCutData = worksheetData.fabricCutData as Record<string, any>;
        const tubeCutData = worksheetData.tubeCutData as any;

        const order = await prisma.order.findUnique({
            where: { id: req.params.id as string },
            include: { items: { orderBy: { itemNumber: 'asc' } } },
        });

        let inventoryCheck;
        if ((fabricCutData as any).type === 'CURTAINS') {
            inventoryCheck = await buildCurtainInventoryCheck(fabricCutData as any);
        } else {
            const inventoryRequirements = buildInventoryRequirements(fabricCutData, tubeCutData, order?.items || []);
            inventoryCheck = await InventoryService.checkAvailability(inventoryRequirements);
        }

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
 * Build curtain worksheet preview data without saving to DB (for CONFIRMED orders)
 */
async function buildCurtainPreview(order: any) {
    const items = order.items;
    let totalHooks = 0, totalWands = 0, totalBracketsStandard = 0;
    let totalBracketsExtended = 0, totalBracketsCeiling = 0, totalFabricMeters = 0;
    const rows: any[] = [];

    for (const item of items) {
        const deductionMm = item.requiresDropDeduction !== false ? (item.dropDeductionValue ?? 35) : 0;
        const fullness = item.fullness ?? 120;
        const openingType = item.openingType ?? 'Single Open';
        const lookup = sheerCurtainPricingService.lookupBreakpoints(item.width, openingType, fullness);
        const bracketCount = sheerCurtainPricingService.getBracketCount(item.width);
        const wandCount = (openingType === 'Centre Open' || openingType === 'Free Fold') ? 2 : 1;

        rows.push({
            itemNumber: item.itemNumber,
            location: item.location,
            width: item.width,
            deductedDrop: item.drop - deductionMm,
            openingType,
            fullness,
            fabric: item.material ?? '',
            fabricColour: item.fabricColour ?? '',
            singleHooks: openingType !== 'Centre Open' ? lookup.hookCount : null,
            leftHooks: lookup.leftHooks ?? null,
            rightHooks: lookup.rightHooks ?? null,
            fabricMeters: lookup.fabricMeters,
            bracketType: item.bracketType ?? 'Standard',
            bracketCount,
            wandCount,
            trackColour: item.trackColor ?? item.trackColour ?? '',
            requiresTracks: item.requiresTracks ?? false,
            trackType: item.trackType ?? null,
            motorType: item.motorType ?? null,
            remotes: item.remotes ?? null,
            chargerHub: item.chargerHub ? (() => { try { return JSON.parse(item.chargerHub!).join(', '); } catch { return item.chargerHub; } })() : null,
            requiresBentTracks: item.requiresBentTracks ?? false,
            bendType: item.bendType ?? null,
            bendQty: item.bendQty ?? null,
        });

        totalHooks += lookup.hookCount;
        totalWands += wandCount;
        const bt = item.bracketType ?? 'Standard';
        if (bt === 'Extended') totalBracketsExtended += bracketCount;
        else if (bt === 'Ceiling') totalBracketsCeiling += bracketCount;
        else totalBracketsStandard += bracketCount;
        totalFabricMeters += lookup.fabricMeters;
    }

    const curtainData = {
        type: 'CURTAINS' as const,
        rows,
        totals: {
            totalHooks, totalWands,
            totalBracketsStandard, totalBracketsExtended, totalBracketsCeiling,
            totalFabricMeters: Math.round(totalFabricMeters * 1000) / 1000,
        },
    };

    // Build inventory requirements
    type Req = { category: InventoryCategory; itemName: string; colorVariant?: string; quantityNeeded: number };
    const invReqs: Req[] = [];
    if (totalHooks > 0) invReqs.push({ category: 'SHEER_HOOK', itemName: 'S-Fold Hook', quantityNeeded: totalHooks });
    if (totalBracketsStandard > 0) invReqs.push({ category: 'SHEER_BRACKET', itemName: 'Standard Bracket', quantityNeeded: totalBracketsStandard });
    if (totalBracketsExtended > 0) invReqs.push({ category: 'SHEER_BRACKET', itemName: 'Extended Bracket', quantityNeeded: totalBracketsExtended });
    if (totalWands > 0) invReqs.push({ category: 'SHEER_WAND', itemName: 'Wand 1250mm', quantityNeeded: totalWands });
    const fabricMap = new Map<string, number>();
    for (const row of rows) {
        const key = `${row.fabric}::${row.fabricColour}`;
        fabricMap.set(key, (fabricMap.get(key) ?? 0) + row.fabricMeters);
    }
    for (const [key, meters] of fabricMap) {
        const sep = key.indexOf('::');
        invReqs.push({ category: 'SHEER_FABRIC', itemName: key.slice(0, sep), colorVariant: key.slice(sep + 2) || undefined, quantityNeeded: Math.ceil(meters * 10) / 10 });
    }

    const inventoryCheck = await InventoryService.checkAvailability(invReqs);

    return {
        worksheetData: {
            fabricCutData: curtainData as any,
            tubeCutData: { groups: [], totalPiecesNeeded: 0 },
            totalFabricMm: Math.round(totalFabricMeters * 1000),
            totalTubePieces: 0,
        },
        inventoryCheck,
        isPreview: true,
    };
}

/**
 * Preview worksheets for a CONFIRMED order (runs optimization without saving)
 */
export const previewWorksheets = async (
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

        if (order.status !== OrderStatus.CONFIRMED) {
            throw new AppError(400, 'Preview is only available for confirmed orders');
        }

        // Handle CURTAINS separately — no cut optimization needed
        if (order.productType === 'CURTAINS') {
            const curtainResult = await buildCurtainPreview(order);
            res.json({
                success: true,
                data: curtainResult,
                isPreview: true,
            });
            return;
        }

        const items = order.items;

        // 1. Group items by fabric
        const fabricGroups = new Map<string, any[]>();
        for (const item of items) {
            const key = `${item.material || 'Unknown'} - ${item.fabricType || 'Unknown'} - ${item.fabricColour || 'Unknown'}`;
            if (!fabricGroups.has(key)) fabricGroups.set(key, []);
            fabricGroups.get(key)!.push(item);
        }

        // 2. Run fabric cut optimization (without saving to DB)
        const fabricCutData: Record<string, any> = {};
        let totalFabricMm = 0;
        const fabricOptimizer = new FabricCutOptimizerService();

        for (const [fabricKey, groupItems] of fabricGroups) {
            const optimizationResult = await fabricOptimizer.optimizeOrder(groupItems);
            const result = optimizationResult.values().next().value;
            if (!result) continue;

            const sheets = result.sheets.map((sheet: any) => ({
                id: sheet.id,
                width: sheet.width,
                length: sheet.actualUsedLength || sheet.length,
                panels: sheet.panels.map((p: any) => ({
                    id: p.id, x: p.x, y: p.y,
                    width: p.width, length: p.length,
                    rotated: p.rotated, label: p.label,
                    blindNumber: p.blindNumber, location: p.location,
                    originalIndex: 0,
                    originalWidth: groupItems.find((it: any) => it.id === p.orderItemId)?.width,
                    originalDrop: groupItems.find((it: any) => it.id === p.orderItemId)?.drop,
                    orderItemId: p.orderItemId,
                })),
                freeRectangles: [],
                usedArea: sheet.usedArea, wastedArea: sheet.wasteArea,
                efficiency: sheet.efficiency, cutSequence: sheet.cutSequence || [],
            }));

            const totalPanels = sheets.reduce((sum: number, s: any) => sum + s.panels.length, 0);

            fabricCutData[fabricKey] = {
                optimization: {
                    sheets,
                    statistics: {
                        usedStockSheets: result.statistics.totalSheets,
                        stockDimensions: `2950×continuous`,
                        totalUsedArea: result.statistics.totalUsedArea,
                        totalWastedArea: result.statistics.totalWasteArea,
                        wastePercentage: result.wastePercentage,
                        efficiency: result.efficiency,
                        totalCuts: totalPanels, totalPanels,
                        totalFabricNeeded: result.totalFabricNeeded,
                    },
                    cuts: [],
                    generationStats: result.generationStats,
                    validation: result.validation,
                    isGuillotineValid: result.isGuillotineValid,
                    strategy: result.strategy,
                },
                items: groupItems,
            };

            totalFabricMm += result.totalFabricNeeded;
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
                chainOrMotor: item.chainOrMotor,
            }));

        const tubeCutOptimizer = new TubeCutOptimizer();
        const tubeCutData = tubeCutOptimizer.optimize(tubeBlinds);

        // 4. Check inventory availability
        const inventoryRequirements = buildInventoryRequirements(fabricCutData, tubeCutData, items);
        const inventoryCheck = await InventoryService.checkAvailability(inventoryRequirements);

        // Return preview data (NOT saved to DB)
        res.json({
            success: true,
            data: {
                worksheetData: {
                    fabricCutData: serializeFabricCutData(fabricCutData),
                    tubeCutData: tubeCutData as any,
                    totalFabricMm,
                    totalTubePieces: tubeCutData.totalPiecesNeeded,
                },
                inventoryCheck,
                isPreview: true,
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

        if ((fabricCutData as any).type === 'CURTAINS') {
            // Curtain inventory deductions from stored curtain worksheet data
            const curtainData = fabricCutData as any;
            const t = curtainData.totals;
            if (t.totalHooks > 0) {
                addDeduction('SHEER_HOOK', 'S-Fold Hook', undefined, t.totalHooks, `Order ${order.orderNumber} - ${t.totalHooks} hooks`);
            }
            if (t.totalBracketsStandard > 0) {
                addDeduction('SHEER_BRACKET', 'Standard Bracket', undefined, t.totalBracketsStandard, `Order ${order.orderNumber}`);
            }
            if (t.totalBracketsExtended > 0) {
                addDeduction('SHEER_BRACKET', 'Extended Bracket', undefined, t.totalBracketsExtended, `Order ${order.orderNumber}`);
            }
            if (t.totalBracketsCeiling > 0) {
                addDeduction('SHEER_BRACKET', 'Ceiling Bracket', undefined, t.totalBracketsCeiling, `Order ${order.orderNumber}`);
            }
            if (t.totalWands > 0) {
                addDeduction('SHEER_WAND', 'Wand 1250mm', undefined, t.totalWands, `Order ${order.orderNumber}`);
            }
            // Fabric by name+colour
            const fabricMap = new Map<string, number>();
            for (const row of curtainData.rows) {
                const key = `${row.fabric}::${row.fabricColour}`;
                fabricMap.set(key, (fabricMap.get(key) ?? 0) + row.fabricMeters);
            }
            for (const [key, meters] of fabricMap) {
                const sepIdx = key.indexOf('::');
                const fabricName = key.slice(0, sepIdx);
                const colour = key.slice(sepIdx + 2);
                addDeduction('SHEER_FABRIC', fabricName, colour || undefined, Math.ceil(meters * 10) / 10, `Order ${order.orderNumber}`);
            }
        } else {
            // Blind deductions
            for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
                const { itemName, colorVariant } = parseFabricKey(fabricKey);
                addDeduction(
                    'FABRIC', itemName, colorVariant,
                    groupData.optimization.statistics.totalFabricNeeded,
                    `Order ${order.orderNumber} - ${groupData.optimization.statistics.usedStockSheets} sheets, ${groupData.optimization.statistics.efficiency}% efficiency`
                );
            }

            for (const group of tubeCutData.groups) {
                addDeduction(
                    'BOTTOM_BAR', group.bottomRailType, group.bottomRailColour,
                    group.piecesToDeduct,
                    `Order ${order.orderNumber} - ${group.totalWidth}mm total, ${group.piecesToDeduct} pieces`
                );
            }

            for (const item of orderItems) {
                for (const hw of buildPerBlindHardware(item)) {
                    addDeduction(
                        hw.category as InventoryCategory, hw.itemName, hw.colorVariant,
                        hw.qty,
                        `Order ${order.orderNumber} - blind #${item.itemNumber} (${item.location})`
                    );
                }
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

        // Update OrderItem fields with correct motor-specific deductions
        for (const item of order.items) {
            const motorDeduction = getMotorDeduction(item.chainOrMotor || undefined);
            await prisma.orderItem.update({
                where: { id: item.id },
                data: {
                    fabricCutWidth: item.width - motorDeduction,
                    calculatedWidth: item.width - motorDeduction,
                    calculatedDrop: item.drop + 200,
                },
            });
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
            case 'curtain-csv': {
                const curtainData = fabricCutData as any;
                if (curtainData?.type !== 'CURTAINS') {
                    throw new AppError(400, 'No curtain worksheet data found');
                }
                const rows: any[] = curtainData.rows ?? [];
                const totals = curtainData.totals ?? {};
                const headers = ['No', 'Location', 'Width (mm)', 'Deducted Drop (mm)', 'Opening Type', 'Fabric Material', 'Colour', 'Single Hooks', 'Left Side Hooks', 'Right Side Hooks', 'Fabric (m)'];
                const csvLines = [
                    headers.join(','),
                    ...rows.map((r: any) => [
                        r.itemNumber,
                        `"${r.location}"`,
                        r.width,
                        r.deductedDrop,
                        `"${r.openingType}"`,
                        `"${r.fabric}"`,
                        `"${r.fabricColour}"`,
                        r.singleHooks ?? '',
                        r.leftHooks ?? '',
                        r.rightHooks ?? '',
                        r.fabricMeters?.toFixed(3) ?? '',
                    ].join(',')),
                    '',
                    `"TOTALS"`,
                    `"Total Hooks",${totals.totalHooks ?? 0}`,
                    `"Total Wands",${totals.totalWands ?? 0}`,
                    `"Standard Brackets",${totals.totalBracketsStandard ?? 0}`,
                    `"Extended Brackets",${totals.totalBracketsExtended ?? 0}`,
                    `"Total Fabric (m)",${totals.totalFabricMeters?.toFixed(3) ?? 0}`,
                ];
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-curtain.csv"`);
                res.send(csvLines.join('\n'));
                break;
            }
            case 'curtain-pdf': {
                try {
                    const curtainData = fabricCutData as any;
                    if (curtainData?.type !== 'CURTAINS') throw new AppError(400, 'No curtain worksheet data found');
                    const PDFDocument = require('pdfkit');
                    const path = require('path');
                    const LOGO_PATH = path.join(__dirname, '../assets/logo.png');
                    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, autoFirstPage: true });
                    const chunks: Buffer[] = [];
                    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

                    // ── Header box (same style as blind worksheet) ──────────────
                    const HDR_X = 30, HDR_Y = 20, HDR_W = 781, HDR_H = 80;
                    const LOGO_BOX_W = 155, MID_BOX_W = 380;
                    const RIGHT_BOX_W = HDR_W - LOGO_BOX_W - MID_BOX_W;
                    doc.lineWidth(1).strokeColor('#333').rect(HDR_X, HDR_Y, HDR_W, HDR_H).stroke();
                    doc.lineWidth(0.5).strokeColor('#777')
                        .moveTo(HDR_X + LOGO_BOX_W, HDR_Y).lineTo(HDR_X + LOGO_BOX_W, HDR_Y + HDR_H).stroke();
                    doc.lineWidth(0.5).strokeColor('#777')
                        .moveTo(HDR_X + LOGO_BOX_W + MID_BOX_W, HDR_Y).lineTo(HDR_X + LOGO_BOX_W + MID_BOX_W, HDR_Y + HDR_H).stroke();
                    try { doc.image(LOGO_PATH, HDR_X + 4, HDR_Y + 6, { fit: [LOGO_BOX_W - 8, 60] }); }
                    catch { doc.fontSize(10).font('Helvetica-Bold').fillColor('#1B2B3A').text('SIGNATURE SHADES', HDR_X + 4, HDR_Y + 28, { width: LOGO_BOX_W - 8, lineBreak: false }); }
                    doc.fontSize(6.5).font('Helvetica').fillColor('#666').text('Blinds | Curtains | Shutters', HDR_X + 4, HDR_Y + 65, { lineBreak: false });

                    const MID_X = HDR_X + LOGO_BOX_W + 6;
                    const cxRef = order.customerReference ? `${order.customerName}-${order.customerReference}` : order.customerName;
                    const midRows: [string, string][] = [
                        ['Order #:', order.orderNumber],
                        ['Cx Ref:', cxRef],
                        ['Ord Rec\'d:', new Date(order.orderDate).toLocaleDateString('en-AU')],
                        ['Date Printed:', new Date().toLocaleDateString('en-AU')],
                        ['Remarks:', (order as any).notes || ''],
                    ];
                    midRows.forEach(([label, val], idx) => {
                        const ry = HDR_Y + 8 + idx * 13.5;
                        doc.fontSize(7).font('Helvetica-Bold').fillColor('#444').text(label, MID_X, ry, { lineBreak: false });
                        doc.fontSize(7).font('Helvetica').fillColor('#000').text(val, MID_X + 72, ry, { lineBreak: false });
                    });

                    const RGT_X = HDR_X + LOGO_BOX_W + MID_BOX_W + 6;
                    const RGT_W = RIGHT_BOX_W - 8;
                    const BAY_SPLIT_Y = HDR_Y + Math.round(HDR_H * 0.52);
                    doc.lineWidth(0.5).strokeColor('#777').moveTo(HDR_X + LOGO_BOX_W + MID_BOX_W, BAY_SPLIT_Y).lineTo(HDR_X + HDR_W, BAY_SPLIT_Y).stroke();
                    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#444').text('Customer Name', RGT_X, HDR_Y + 5, { lineBreak: false });
                    doc.fontSize(8).font('Helvetica').fillColor('#000').text(order.customerName, RGT_X, HDR_Y + 16, { width: RGT_W, lineBreak: false });
                    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#444').text('BAY', RGT_X, BAY_SPLIT_Y + 4, { lineBreak: false });
                    doc.lineWidth(0.5).strokeColor('#aaa').rect(RGT_X + 22, BAY_SPLIT_Y + 2, RGT_W - 24, 22).stroke();

                    // ── Section title ───────────────────────────────────────────
                    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1B2B3A')
                        .text('Curtain Worksheet — Detail Table', 30, HDR_Y + HDR_H + 8, { align: 'center' });

                    // ── Table ───────────────────────────────────────────────────
                    // 11 cols summing to 781pt (full usable width)
                    const colWidths = [28, 100, 58, 68, 80, 90, 68, 58, 58, 58, 55];
                    const colHeaders = ['No', 'Location', 'Width (mm)', 'Ded. Drop', 'Opening Type', 'Fabric Material', 'Colour', 'Single Hooks', 'L Side Hooks', 'R Side Hooks', 'Fabric (m)'];
                    const TABLE_LEFT = 30;
                    const TABLE_W = colWidths.reduce((a, b) => a + b, 0);
                    const ROW_H = 16;
                    let ty = HDR_Y + HDR_H + 28;

                    // Header row
                    doc.fillColor('#DBEAFE').rect(TABLE_LEFT, ty, TABLE_W, ROW_H).fill();
                    doc.lineWidth(0.5).strokeColor('#888').rect(TABLE_LEFT, ty, TABLE_W, ROW_H).stroke();
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1E3A5F');
                    let tx = TABLE_LEFT;
                    colHeaders.forEach((h, i) => {
                        doc.lineWidth(0.3).strokeColor('#aaa').moveTo(tx, ty).lineTo(tx, ty + ROW_H).stroke();
                        doc.text(h, tx + 2, ty + 4, { width: colWidths[i] - 4, align: 'center', lineBreak: false });
                        tx += colWidths[i];
                    });
                    ty += ROW_H;

                    // Data rows
                    const rows: any[] = curtainData.rows ?? [];
                    doc.font('Helvetica').fontSize(8);
                    rows.forEach((row: any, idx: number) => {
                        if (ty > 480) { doc.addPage(); ty = 30; }
                        if (idx % 2 === 1) { doc.fillColor('#F9FAFB').rect(TABLE_LEFT, ty, TABLE_W, ROW_H).fill(); }
                        else { doc.fillColor('#FFFFFF').rect(TABLE_LEFT, ty, TABLE_W, ROW_H).fill(); }
                        doc.lineWidth(0.3).strokeColor('#D1D5DB').rect(TABLE_LEFT, ty, TABLE_W, ROW_H).stroke();
                        const cells = [
                            String(row.itemNumber), row.location, String(row.width), String(row.deductedDrop),
                            row.openingType, row.fabric, row.fabricColour,
                            row.singleHooks != null ? String(row.singleHooks) : '—',
                            row.leftHooks != null ? String(row.leftHooks) : '—',
                            row.rightHooks != null ? String(row.rightHooks) : '—',
                            row.fabricMeters != null ? Number(row.fabricMeters).toFixed(3) : '',
                        ];
                        tx = TABLE_LEFT;
                        cells.forEach((cell, i) => {
                            doc.lineWidth(0.3).strokeColor('#E5E7EB').moveTo(tx, ty).lineTo(tx, ty + ROW_H).stroke();
                            doc.fillColor('#111827').text(cell, tx + 2, ty + 4, { width: colWidths[i] - 4, align: i <= 1 ? 'left' : 'center', lineBreak: false });
                            tx += colWidths[i];
                        });
                        ty += ROW_H;
                    });

                    // ── Totals box ──────────────────────────────────────────────
                    const totals = curtainData.totals ?? {};
                    ty += 10;
                    const totalItems: [string, string][] = [
                        ['S-Fold Hooks', String(totals.totalHooks ?? 0)],
                        ['Wands (1250mm)', String(totals.totalWands ?? 0)],
                        ['Std Brackets', String(totals.totalBracketsStandard ?? 0)],
                        ['Ext Brackets', String(totals.totalBracketsExtended ?? 0)],
                        ['Ceiling Brackets', String(totals.totalBracketsCeiling ?? 0)],
                        ['Total Fabric', `${Number(totals.totalFabricMeters ?? 0).toFixed(3)} m`],
                    ];
                    const TCOL_W = 110;
                    const TCOL_H = 22;
                    const TOTALS_W = totalItems.length * TCOL_W;
                    const TOTALS_X = TABLE_LEFT;
                    doc.lineWidth(1).strokeColor('#374151').rect(TOTALS_X, ty, TOTALS_W, TCOL_H * 2).stroke();
                    let ttx = TOTALS_X;
                    // Label row
                    totalItems.forEach(([label], i) => {
                        if (i > 0) doc.lineWidth(0.5).strokeColor('#6B7280').moveTo(ttx, ty).lineTo(ttx, ty + TCOL_H * 2).stroke();
                        doc.fillColor('#1E3A5F').rect(ttx, ty, TCOL_W, TCOL_H).fill();
                        doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF').text(label, ttx + 3, ty + 7, { width: TCOL_W - 6, align: 'center', lineBreak: false });
                        ttx += TCOL_W;
                    });
                    // Value row
                    ttx = TOTALS_X;
                    doc.lineWidth(0.5).strokeColor('#D1D5DB').moveTo(TOTALS_X, ty + TCOL_H).lineTo(TOTALS_X + TOTALS_W, ty + TCOL_H).stroke();
                    totalItems.forEach(([, val]) => {
                        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(val, ttx + 3, ty + TCOL_H + 4, { width: TCOL_W - 6, align: 'center', lineBreak: false });
                        ttx += TCOL_W;
                    });

                    await new Promise<void>((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); doc.end(); });
                    const pdf = Buffer.concat(chunks);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-curtain.pdf"`);
                    res.setHeader('Content-Length', pdf.length);
                    res.send(pdf);
                } catch (pdfErr: any) {
                    logger.error('Curtain PDF generation error:', { message: pdfErr.message, stack: pdfErr.stack });
                    throw new AppError(500, `PDF generation failed: ${pdfErr.message}`);
                }
                break;
            }
            default:
                throw new AppError(400, 'Invalid download type. Use: fabric-cut-csv, fabric-cut-pdf, tube-cut-csv, tube-cut-pdf, curtain-csv, curtain-pdf');
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

        // Warehouse can only mark PRODUCTION → COMPLETED
        if (authReq.user?.role === 'WAREHOUSE') {
            const existing = await prisma.order.findUnique({ where: { id: req.params.id as string } });
            if (!existing || existing.status !== 'PRODUCTION' || status !== 'COMPLETED') {
                throw new AppError(403, 'Warehouse users can only mark production orders as completed');
            }
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

            // Recalculate prices for each item using comprehensive pricing
            const newItems = [];
            for (let index = 0; index < body.items.length; index++) {
                const item: any = body.items[index];
                const w = parseInt(item.width) || 0;
                const d = parseInt(item.drop) || 0;
                const motorDeduction = getMotorDeduction(item.chainOrMotor);

                let price = item.price || 0;
                let fabricGroup = item.fabricGroup || null;
                let discountPercent = item.discountPercent || 0;
                let fabricPrice = item.fabricPrice || null;
                let motorPrice = item.motorPrice || null;
                let bracketPrice = item.bracketPrice || null;
                // Chain, clips, componentPrice are no longer charged
                const chainPrice: number | null = null;
                const clipsPrice: number | null = null;
                const componentPrice: number | null = null;

                // Recalculate price if required fields are present
                if (w > 0 && d > 0 && item.material && item.fabricType && item.fabricColour && item.chainOrMotor && item.bracketType && item.bracketColour && item.bottomRailType && item.bottomRailColour) {
                    try {
                        const breakdown = await comprehensivePricingService.calculateBlindPrice({
                            width: w,
                            drop: d,
                            material: item.material,
                            fabricType: item.fabricType,
                            fabricColour: item.fabricColour,
                            chainOrMotor: item.chainOrMotor,
                            chainType: item.chainType || undefined,
                            bracketType: item.bracketType,
                            bracketColour: item.bracketColour,
                            bottomRailType: item.bottomRailType,
                            bottomRailColour: item.bottomRailColour,
                        });
                        price = breakdown.totalPrice;
                        fabricGroup = breakdown.fabricGroup;
                        discountPercent = breakdown.discountPercent;
                        fabricPrice = breakdown.fabricPrice;
                        motorPrice = breakdown.motorChainPrice;
                        bracketPrice = breakdown.bracketPrice;
                    } catch (err) {
                        logger.warn(`Price recalc failed for item ${index + 1}: ${err}`);
                        // Keep submitted price as fallback
                    }
                }

                newItems.push({
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
                    calculatedWidth: w > 0 ? w - motorDeduction : null,
                    calculatedDrop: d > 0 ? d + 200 : null,
                    fabricCutWidth: w > 0 ? w - motorDeduction : null,
                    price,
                    fabricGroup,
                    discountPercent,
                    fabricPrice,
                    motorPrice,
                    bracketPrice,
                    chainPrice,
                    clipsPrice,
                    componentPrice,
                });
            }

            await prisma.orderItem.createMany({ data: newItems });

            // Recalculate totals from recalculated prices
            const subtotal = newItems.reduce((sum, item) => sum + (item.price || 0), 0);
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

/**
 * Toggle fabricOrdered flag on an order (Admin only)
 * PATCH /api/web-orders/:id/fabric-ordered
 */
export const toggleFabricOrdered = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const orderId = req.params.id as string;
        const { fabricOrdered } = req.body;

        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new AppError(404, 'Order not found');

        const updated = await prisma.order.update({
            where: { id: orderId },
            data: { fabricOrdered: typeof fabricOrdered === 'boolean' ? fabricOrdered : !order.fabricOrdered },
        });

        res.json({ success: true, data: { order: updated } });
    } catch (error) {
        next(error);
    }
};

/**
 * Update order label and/or admin notes
 * PATCH /api/web-orders/:id/admin-fields
 */
export const updateAdminFields = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const orderId = req.params.id as string;
        const { label, adminNotes } = req.body;

        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new AppError(404, 'Order not found');

        const data: any = {};
        if (label !== undefined) data.label = label || null;
        if (adminNotes !== undefined) data.adminNotes = adminNotes || null;

        const updated = await prisma.order.update({
            where: { id: orderId },
            data,
            include: { items: { orderBy: { itemNumber: 'asc' } } },
        });

        res.json({ success: true, data: { order: updated } });
    } catch (error) {
        next(error);
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
            },
        });

        if (!order) throw new AppError(404, 'Order not found');

        const PDFDocument = (await import('pdfkit' as any)).default ?? (await import('pdfkit' as any));

        // 100mm × 62mm landscape (QL-800 DK roll width = 62mm)
        const MM = 2.835; // 1mm in PDF points
        const LBL_W = 100 * MM; // ≈ 283.5pt (landscape width)
        const LBL_H = 62 * MM;  // ≈ 175.8pt (landscape height)
        const PAD = 3 * MM;     // 3mm margin on each side
        const innerW = LBL_W - PAD * 2;

        const doc = new PDFDocument({ size: [LBL_W, LBL_H], margin: 0, autoFirstPage: false });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="labels-${order.orderNumber}.pdf"`);
        doc.pipe(res);

        // Logo path — copied to backend/assets/ in Docker build
        const logoPath = path.join(__dirname, '../../assets/logo.png');

        // Customer company for Cx Ref line
        const customerCompany = order.customerCompany || order.customerName;
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

            // ── Header: Logo (left) + "N OF M" (right) ───────────────────────
            const blindNo = `${idx + 1} OF ${total}`;
            const logoH = 9 * MM;
            const logoW = 22 * MM;
            try {
                doc.image(logoPath, PAD, y, { height: logoH, width: logoW, fit: [logoW, logoH] });
            } catch {
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
                   .text('SIGNATURE SHADES', PAD, y + 2 * MM, { width: logoW });
            }
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
               .text(blindNo, PAD, y + 2.5 * MM, { align: 'right', width: innerW });

            y += logoH + 1.5 * MM;

            // ── Separator ────────────────────────────────────────────────────
            doc.moveTo(PAD, y).lineTo(LBL_W - PAD, y).lineWidth(0.5).strokeColor('#000').stroke();
            y += 2 * MM;

            // Build all label lines to calculate fit
            const orderRefText = `ORDER REF: ${order.orderNumber.toUpperCase()}`;
            const cxRefText = `CX REF: ${cxRefLine.toUpperCase()}`;
            const dimText = `W: ${item.width ?? 0}   H: ${item.drop ?? 0}`;
            const locationText = (item.location ?? '').toUpperCase();
            const matFabric = [item.material, item.fabricType].filter(Boolean).join(' ');
            const fabricLine = matFabric
                ? `${matFabric}${item.fabricColour ? ` - ${item.fabricColour}` : ''}`
                : (item.fabricColour ?? '');
            const fabricText = fabricLine.toUpperCase();
            const controlText = controlLine.toUpperCase();

            // Calculate font size: check if all content fits within label height
            const availableH = LBL_H - y - PAD;
            // Estimate lines needed (some lines may wrap with long motor names)
            const allLines = [orderRefText, cxRefText, dimText, locationText, fabricText, controlText];
            const longestLine = Math.max(...allLines.map(l => l.length));
            // Base font size 11, scale down if content is long
            let labelFontSize = 11;
            if (longestLine > 40) labelFontSize = 10;
            if (longestLine > 50) labelFontSize = 9;
            // Also check vertical fit: ~6 lines + gaps, each line ~(fontSize*1.2 + 1mm)
            const estLineH = labelFontSize * 1.2 + 1 * MM;
            const estTotalH = estLineH * 7 + 5 * MM; // 6 lines + spacing
            if (estTotalH > availableH) labelFontSize = Math.max(8, labelFontSize - 1);

            const lineGap = 0.8 * MM;

            // Line 1 — ORDER REF
            doc.fontSize(labelFontSize).font('Helvetica-Bold').fillColor('#000')
               .text(orderRefText, PAD, y, { width: innerW });
            y = doc.y + lineGap;

            // Line 2 — CX REF
            doc.fontSize(labelFontSize).font('Helvetica-Bold')
               .text(cxRefText, PAD, y, { width: innerW });
            y = doc.y + 3 * MM;

            // Line 3 — W / H
            doc.fontSize(labelFontSize).font('Helvetica-Bold')
               .text(dimText, PAD, y, { width: innerW });
            y = doc.y + lineGap;

            // Line 4 — Location
            doc.fontSize(labelFontSize).font('Helvetica-Bold')
               .text(locationText, PAD, y, { width: innerW });
            y = doc.y + lineGap;

            // Line 5 — Material FabricType - Colour
            doc.fontSize(labelFontSize).font('Helvetica-Bold')
               .text(fabricText, PAD, y, { width: innerW });
            y = doc.y + lineGap;

            // Line 6 — Control (may wrap for long motor names)
            doc.fontSize(labelFontSize).font('Helvetica-Bold')
               .text(controlText, PAD, y, { width: innerW });
        }

        doc.end();
    } catch (error) {
        next(error);
    }
};
