import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

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

// Validation schemas (reuse from webOrder.controller.ts)
const QuoteItemSchema = z.object({
    location: z.string().min(1, 'Location is required'),
    width: z.number().min(100, 'Width must be at least 100mm'),
    drop: z.number().min(100, 'Drop must be at least 100mm'),
    fixing: z.string().optional(),
    bracketType: z.string().optional(),
    bracketColour: z.string().optional(),
    controlSide: z.string().optional(),
    chainOrMotor: z.string().optional(),
    chainType: z.string().optional(),
    roll: z.string().optional(),
    material: z.string().optional(),
    fabricType: z.string().optional(),
    fabricColour: z.string().optional(),
    bottomRailType: z.string().optional(),
    bottomRailColour: z.string().optional(),
    price: z.number().optional(),
    fabricGroup: z.number().optional(),
    discountPercent: z.number().optional(),
});

const CreateQuoteSchema = z.object({
    productType: z.enum(['BLINDS', 'CURTAINS', 'SHUTTERS']),
    items: z.array(QuoteItemSchema).min(1, 'At least one item is required'),
    notes: z.string().optional(),
});

/**
 * Generate unique quote number: QT-YYMMDD-XXXX
 */
async function generateQuoteNumber(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `QT-${yy}${mm}${dd}`;

    // Find the last quote number for today
    const lastQuote = await prisma.quote.findFirst({
        where: {
            quoteNumber: {
                startsWith: datePrefix,
            },
        },
        orderBy: {
            quoteNumber: 'desc',
        },
    });

    let sequence = 1;
    if (lastQuote) {
        const lastSequence = parseInt(lastQuote.quoteNumber.split('-').pop() || '0');
        sequence = lastSequence + 1;
    }

    return `${datePrefix}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Create new quote
 */
export const createQuote = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = (req as AuthRequest).user;
        if (!user) {
            throw new AppError(401, 'User not authenticated');
        }

        const validatedData = CreateQuoteSchema.parse(req.body);

        // Calculate totals
        const subtotal = validatedData.items.reduce((sum, item) => sum + (item.price || 0), 0);
        const total = subtotal; // Could add taxes, fees, etc.

        // Generate quote number
        const quoteNumber = await generateQuoteNumber();

        // Set expiry: 30 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Create quote
        const quote = await prisma.quote.create({
            data: {
                quoteNumber,
                userId: user.id,
                productType: validatedData.productType,
                items: validatedData.items,
                subtotal,
                total,
                notes: validatedData.notes,
                expiresAt,
            },
        });

        res.status(201).json({
            message: 'Quote created successfully',
            quote: {
                id: quote.id,
                quoteNumber: quote.quoteNumber,
                productType: quote.productType,
                items: quote.items,
                subtotal: parseFloat(quote.subtotal.toString()),
                total: parseFloat(quote.total.toString()),
                notes: quote.notes,
                expiresAt: quote.expiresAt,
                createdAt: quote.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user's quotes
 */
export const getMyQuotes = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = (req as AuthRequest).user;
        if (!user) {
            throw new AppError(401, 'User not authenticated');
        }

        const quotes = await prisma.quote.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                quoteNumber: true,
                productType: true,
                subtotal: true,
                total: true,
                expiresAt: true,
                convertedToOrder: true,
                createdAt: true,
            },
        });

        res.json({
            quotes: quotes.map(q => ({
                ...q,
                subtotal: parseFloat(q.subtotal.toString()),
                total: parseFloat(q.total.toString()),
            })),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single quote by ID
 */
export const getQuoteById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = (req as AuthRequest).user;
        if (!user) {
            throw new AppError(401, 'User not authenticated');
        }

        const id = req.params.id as string;

        const quote = await prisma.quote.findUnique({
            where: { id },
        });

        if (!quote) {
            throw new AppError(404, 'Quote not found');
        }

        // Ensure user owns this quote
        if (quote.userId !== user.id) {
            throw new AppError(403, 'Access denied');
        }

        res.json({
            quote: {
                ...quote,
                subtotal: parseFloat(quote.subtotal.toString()),
                total: parseFloat(quote.total.toString()),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Convert quote to order
 */
export const convertQuoteToOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = (req as AuthRequest).user;
        if (!user) {
            throw new AppError(401, 'User not authenticated');
        }

        const id = req.params.id as string;

        const quote = await prisma.quote.findUnique({
            where: { id },
        });

        if (!quote) {
            throw new AppError(404, 'Quote not found');
        }

        if (quote.userId !== user.id) {
            throw new AppError(403, 'Access denied');
        }

        if (quote.convertedToOrder) {
            throw new AppError(400, 'Quote has already been converted to an order');
        }

        // Check if expired
        if (new Date() > quote.expiresAt) {
            throw new AppError(400, 'Quote has expired');
        }

        // Generate order number (same logic as webOrder.controller.ts)
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const datePrefix = `SS-${yy}${mm}${dd}`;

        const lastOrder = await prisma.order.findFirst({
            where: {
                orderNumber: {
                    startsWith: datePrefix,
                },
            },
            orderBy: {
                orderNumber: 'desc',
            },
        });

        let sequence = 1;
        if (lastOrder) {
            const lastSequence = parseInt(lastOrder.orderNumber.split('-').pop() || '0');
            sequence = lastSequence + 1;
        }

        const orderNumber = `${datePrefix}-${String(sequence).padStart(4, '0')}`;

        // Get full user details for order
        const fullUser = await prisma.user.findUnique({ where: { id: user.id } });

        // Create order from quote
        const items = quote.items as any[];
        const subtotal = parseFloat(quote.subtotal.toString());
        const total = parseFloat(quote.total.toString());

        const order = await prisma.order.create({
            data: {
                orderNumber,
                userId: user.id,
                customerName: fullUser?.name || user.name || user.email,
                customerEmail: fullUser?.email || user.email,
                customerPhone: fullUser?.phone || '',
                customerCompany: fullUser?.company || null,
                productType: quote.productType,
                status: 'PENDING',
                subtotal,
                total,
                orderDate: new Date(),
                fileSource: 'WEB_FORM',
                notes: quote.notes ? `Converted from quote ${quote.quoteNumber}: ${quote.notes}` : `Converted from quote ${quote.quoteNumber}`,
                items: {
                    create: items.map((item: any, index: number) => {
                        const w = parseInt(item.width) || 0;
                        const d = parseInt(item.drop) || 0;
                        const motorDeduction = getMotorDeduction(item.chainOrMotor);
                        return {
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
                            calculatedDrop: d > 0 ? d + 150 : null,
                            fabricCutWidth: w > 0 ? w - motorDeduction : null,
                            fabricGroup: item.fabricGroup || null,
                            discountPercent: item.discountPercent || 0,
                            price: item.price || 0,
                            fabricPrice: item.fabricPrice || null,
                            motorPrice: item.motorPrice || null,
                            bracketPrice: item.bracketPrice || null,
                            chainPrice: item.chainPrice || null,
                            clipsPrice: item.clipsPrice || null,
                            componentPrice: item.componentPrice || null,
                        };
                    }),
                },
            },
            include: {
                items: true,
            },
        });

        // Update quote with conversion info
        await prisma.quote.update({
            where: { id },
            data: {
                convertedToOrder: order.id,
            },
        });

        res.json({
            message: 'Quote converted to order successfully',
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                status: order.status,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete quote
 */
export const deleteQuote = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = (req as AuthRequest).user;
        if (!user) {
            throw new AppError(401, 'User not authenticated');
        }

        const id = req.params.id as string;

        const quote = await prisma.quote.findUnique({
            where: { id },
        });

        if (!quote) {
            throw new AppError(404, 'Quote not found');
        }

        if (quote.userId !== user.id) {
            throw new AppError(403, 'Access denied');
        }

        await prisma.quote.delete({
            where: { id },
        });

        res.json({
            message: 'Quote deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};
