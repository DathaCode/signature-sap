import { Request, Response, NextFunction } from 'express';
import { PrismaClient, OrderStatus, InventoryCategory } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { z } from 'zod';
import pricingService from '../services/pricing.service';
import comprehensivePricingService from '../services/comprehensivePricing.service';
import { CutlistOptimizer, PanelInput } from '../services/cutlistOptimizer.service';
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

const prisma = new PrismaClient();

// Validation schemas
const OrderItemSchema = z.object({
    location: z.string().min(1, 'Location is required'),
    width: z.number().int().positive('Width must be a positive number'),
    drop: z.number().int().positive('Drop must be a positive number'),
    fixing: z.string().optional(),
    bracketType: z.string().optional(),
    bracketColour: z.string().optional(),
    controlSide: z.enum(['Left', 'Right']).optional(),
    chainOrMotor: z.string().optional(),
    chainType: z.string().optional(), // "Stainless Steel" | "Plastic Pure White"
    roll: z.enum(['Front', 'Back']).optional(),
    material: z.string().optional(),
    fabricType: z.string().optional(),
    fabricColour: z.string().optional(),
    bottomRailType: z.string().optional(),
    bottomRailColour: z.string().optional(),
});

const CreateOrderSchema = z.object({
    productType: z.enum(['BLINDS', 'CURTAINS', 'SHUTTERS']),
    orderDate: z.string().optional(),
    dateRequired: z.string().optional(),
    items: z.array(OrderItemSchema).min(1, 'At least one item is required'),
    notes: z.string().optional(),
});

/**
 * Generate unique order number: SS-YYMMDD-XXXX
 */
async function generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Count orders today
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const count = await prisma.order.count({
        where: {
            createdAt: {
                gte: startOfDay,
                lt: endOfDay,
            },
        },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    return `SS-${dateStr}-${sequence}`;
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
                        chainType: item.chainType,
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
                calculatedDrop: item.drop + 150,
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
            next(new AppError(400, error.errors[0].message));
        } else {
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
            where: { id: req.params.id },
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
            where: { id: req.params.id },
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
            where: { id: req.params.id },
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
        const { status, productType, userId } = req.query;

        const orders = await prisma.order.findMany({
            where: {
                ...(status && { status: status as OrderStatus }),
                ...(productType && { productType: productType as any }),
                ...(userId && { userId: userId as string }),
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
            where: { id: req.params.id },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        if (order.status !== OrderStatus.PENDING) {
            throw new AppError(400, 'Only pending orders can be approved');
        }

        const updated = await prisma.order.update({
            where: { id: req.params.id },
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
            where: { id: req.params.id },
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
            where: { id: req.params.id },
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

    // 2. Run cutlist optimization per fabric group
    const fabricCutData: Record<string, any> = {};
    let totalFabricMm = 0;

    for (const [fabricKey, groupItems] of fabricGroups) {
        // Look up available roll length from inventory
        const { itemName: invItemName, colorVariant: invColorVariant } = parseFabricKey(fabricKey);
        const inventoryItem = await prisma.inventoryItem.findFirst({
            where: {
                category: 'FABRIC',
                itemName: invItemName,
                colorVariant: invColorVariant,
            },
        });
        const rollLength = inventoryItem ? inventoryItem.quantity.toNumber() : 10000;

        const optimizer = new CutlistOptimizer({
            stockWidth: 3000,
            stockLength: Math.min(rollLength, 10000), // Cap at 10m per sheet
        });

        const panels: PanelInput[] = groupItems.map((item: any) => ({
            width: item.width - 28,    // calculatedWidth for packing
            length: item.drop + 150,   // calculatedDrop for packing
            qty: 1,
            label: `${item.location} - ${item.width}x${item.drop}`,
            originalWidth: item.width,
            originalDrop: item.drop,
            orderItemId: item.id,
        }));

        const optimization = optimizer.optimize(panels);
        totalFabricMm += optimization.statistics.totalFabricNeeded;

        fabricCutData[fabricKey] = {
            optimization,
            items: groupItems,
        };

        // Update OrderItem records with sheet positions
        for (const sheet of optimization.sheets) {
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

    // 5. Check inventory availability
    const inventoryRequirements = buildInventoryRequirements(fabricCutData, tubeCutData);

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
 * Build inventory requirements from optimization data
 */
function buildInventoryRequirements(fabricCutData: Record<string, any>, tubeCutData: any) {
    const requirements: { category: InventoryCategory; itemName: string; colorVariant?: string; quantityNeeded: number }[] = [];

    for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
        const { itemName, colorVariant } = parseFabricKey(fabricKey);
        requirements.push({
            category: 'FABRIC',
            itemName,
            colorVariant,
            quantityNeeded: groupData.optimization.statistics.totalFabricNeeded,
        });
    }

    for (const group of tubeCutData.groups) {
        requirements.push({
            category: 'BOTTOM_BAR',
            itemName: group.bottomRailType,
            colorVariant: group.bottomRailColour,
            quantityNeeded: group.piecesToDeduct,
        });
    }

    return requirements;
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
            where: { orderId: req.params.id },
        });

        if (!worksheetData) {
            throw new AppError(404, 'No worksheet data found. Send order to production first.');
        }

        // Also check inventory availability
        const fabricCutData = worksheetData.fabricCutData as Record<string, any>;
        const tubeCutData = worksheetData.tubeCutData as any;

        const inventoryRequirements = buildInventoryRequirements(fabricCutData, tubeCutData);
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
            where: { orderId: req.params.id },
        });

        if (!worksheetData) {
            throw new AppError(404, 'No worksheet data found');
        }

        if (worksheetData.acceptedAt) {
            throw new AppError(400, 'Worksheets already accepted');
        }

        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        // Build deduction list
        const deductions: { category: InventoryCategory; itemName: string; colorVariant?: string; quantity: number; notes: string }[] = [];

        const fabricCutData = worksheetData.fabricCutData as Record<string, any>;
        const tubeCutData = worksheetData.tubeCutData as any;

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            const { itemName, colorVariant } = parseFabricKey(fabricKey);
            deductions.push({
                category: 'FABRIC',
                itemName,
                colorVariant,
                quantity: groupData.optimization.statistics.totalFabricNeeded,
                notes: `Order ${order.orderNumber} - ${groupData.optimization.statistics.usedStockSheets} sheets, ${groupData.optimization.statistics.efficiency}% efficiency`,
            });
        }

        for (const group of tubeCutData.groups) {
            deductions.push({
                category: 'BOTTOM_BAR',
                itemName: group.bottomRailType,
                colorVariant: group.bottomRailColour,
                quantity: group.piecesToDeduct,
                notes: `Order ${order.orderNumber} - ${group.totalWidth}mm total, ${group.piecesToDeduct} pieces`,
            });
        }

        // Deduct inventory
        const deductionResults = await InventoryService.deductForOrder(order.id, deductions);

        // Mark worksheets as accepted
        await prisma.worksheetData.update({
            where: { orderId: req.params.id },
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
            where: { id: req.params.id },
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
            where: { id: req.params.id },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        const worksheetData = await prisma.worksheetData.findUnique({
            where: { orderId: req.params.id },
        });

        if (!worksheetData) {
            throw new AppError(404, 'No worksheet data found');
        }

        const orderInfo = {
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            orderDate: order.orderDate,
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
                const doc = WorksheetExportService.generateFabricCutPDF(orderInfo, fabricCutData);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-fabric-cut.pdf"`);
                doc.pipe(res);
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
                const doc = WorksheetExportService.generateTubeCutPDF(orderInfo, tubeCutData);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-tube-cut.pdf"`);
                doc.pipe(res);
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
            where: { id: req.params.id },
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
