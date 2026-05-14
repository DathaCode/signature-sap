import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import pricingService from '../services/pricing.service';
import comprehensivePricingService from '../services/comprehensivePricing.service';
import { sheerCurtainPricingService } from '../services/sheerCurtainPricing.service';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * Determine supplier key from chainOrMotor string.
 * - 'tbs'       → TBS winder
 * - 'acmeda'    → Acmeda winder
 * - 'motorised' → all Automate / Alpha motors
 */
function getSupplierKey(chainOrMotor?: string): 'acmeda' | 'tbs' | 'motorised' {
    if (!chainOrMotor) return 'acmeda';
    const lower = chainOrMotor.toLowerCase();
    if (lower.includes('tbs')) return 'tbs';
    if (lower.includes('acmeda')) return 'acmeda';
    return 'motorised';
}

/**
 * Get customer discount for a fabric group + supplier from user's stored discounts
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



// Validation schemas
const calculatePriceSchema = z.object({
    material: z.string().min(1, 'Material is required'),
    fabricType: z.string().min(1, 'Fabric type is required'),
    width: z.number().int().positive('Width must be a positive number'),
    drop: z.number().int().positive('Drop must be a positive number'),
    chainOrMotor: z.string().optional(),
});

const updatePriceSchema = z.object({
    price: z.number().positive('Price must be a positive number'),
});

const calculateBlindPriceSchema = z.object({
    width: z.number().int().positive('Width must be a positive number'),
    drop: z.number().int().positive('Drop must be a positive number'),
    material: z.string().min(1, 'Material is required'),
    fabricType: z.string().min(1, 'Fabric type is required'),
    fabricColour: z.string().min(1, 'Fabric colour is required'),
    chainOrMotor: z.string().min(1, 'Chain or motor is required'),
    chainType: z.string().optional(),
    bracketType: z.string().min(1, 'Bracket type is required'),
    bracketColour: z.string().min(1, 'Bracket colour is required'),
    bottomRailType: z.string().min(1, 'Bottom rail type is required'),
    bottomRailColour: z.string().min(1, 'Bottom rail colour is required'),
    controlSide: z.string().optional(),
});

/**
 * Get pricing matrix for a specific fabric group
 */
export const getPricingMatrix = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const fabricGroup = parseInt(req.params.fabricGroup as string);

        if (isNaN(fabricGroup) || fabricGroup < 1 || fabricGroup > 5) {
            throw new AppError(400, 'Invalid fabric group. Must be 1-5');
        }

        const pricing = await pricingService.getPricingMatrixByGroup(fabricGroup);

        res.json({
            success: true,
            data: { pricing, fabricGroup },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Calculate price for a single item (used in real-time price calculation)
 */
export const calculateItemPrice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = calculatePriceSchema.parse(req.body);

        const priceResult = await pricingService.calculatePrice({
            material: validatedData.material,
            fabricType: validatedData.fabricType,
            width: validatedData.width,
            drop: validatedData.drop,
        });

        // Override discount with customer-specific discount if configured
        const customDiscount = await getCustomerDiscount(
            authReq.user?.id,
            priceResult.fabricGroup,
            validatedData.chainOrMotor
        );

        if (customDiscount !== null) {
            const discountAmount = parseFloat((priceResult.basePrice * customDiscount / 100).toFixed(2));
            priceResult.discountPercent = customDiscount;
            priceResult.discountAmount = discountAmount;
            priceResult.finalPrice = parseFloat((priceResult.basePrice - discountAmount).toFixed(2));
        }

        res.json({
            success: true,
            data: priceResult,
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
 * Update pricing in the matrix (admin only)
 */
export const updatePricingMatrix = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const fabricGroup = parseInt(req.params.fabricGroup as string);
        const width = parseInt(req.params.width as string);
        const drop = parseInt(req.params.drop as string);

        if (isNaN(fabricGroup) || fabricGroup < 1 || fabricGroup > 5) {
            throw new AppError(400, 'Invalid fabric group. Must be 1-5');
        }

        if (isNaN(width) || width <= 0) {
            throw new AppError(400, 'Invalid width');
        }

        if (isNaN(drop) || drop <= 0) {
            throw new AppError(400, 'Invalid drop');
        }

        const validatedData = updatePriceSchema.parse(req.body);

        const updatedPrice = await pricingService.updatePrice(
            fabricGroup,
            width,
            drop,
            validatedData.price,
            authReq.user?.email || 'unknown'
        );

        res.json({
            success: true,
            message: 'Pricing updated successfully',
            data: updatedPrice,
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
 * Calculate comprehensive blind price with all components
 */
export const calculateBlindPrice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = calculateBlindPriceSchema.parse(req.body);

        const priceBreakdown = await comprehensivePricingService.calculateBlindPrice({
            width: validatedData.width,
            drop: validatedData.drop,
            material: validatedData.material,
            fabricType: validatedData.fabricType,
            fabricColour: validatedData.fabricColour,
            chainOrMotor: validatedData.chainOrMotor,
            chainType: validatedData.chainType,
            bracketType: validatedData.bracketType,
            bracketColour: validatedData.bracketColour,
            bottomRailType: validatedData.bottomRailType,
            bottomRailColour: validatedData.bottomRailColour,
            controlSide: validatedData.controlSide,
        });

        // Apply customer-specific discount override if configured
        const customDiscount = await getCustomerDiscount(
            authReq.user?.id,
            priceBreakdown.fabricGroup,
            validatedData.chainOrMotor
        );

        if (customDiscount !== null) {
            const newFabricPrice = parseFloat((priceBreakdown.fabricBasePrice * (1 - customDiscount / 100)).toFixed(2));
            priceBreakdown.discountPercent = customDiscount;
            priceBreakdown.fabricPrice = newFabricPrice;
            priceBreakdown.totalPrice = parseFloat((newFabricPrice + priceBreakdown.motorChainPrice + priceBreakdown.bracketPrice).toFixed(2));
        }

        res.json({
            success: true,
            data: priceBreakdown,
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
 * Get all component prices (for admin management)
 */
export const getAllComponentPrices = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const category = req.query.category as string | undefined;
        const components = await comprehensivePricingService.getAllComponentPrices(category);

        res.json({
            success: true,
            data: { components, total: components.length },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update component price (admin only)
 */
export const updateComponentPrice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const itemId = req.params.id as string;
        const validatedData = updatePriceSchema.parse(req.body);

        const updated = await comprehensivePricingService.updateComponentPrice(
            itemId,
            validatedData.price,
            authReq.user?.email || 'unknown'
        );

        res.json({
            success: true,
            message: 'Component price updated successfully',
            data: updated,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(400, error.errors[0].message));
        } else {
            next(error);
        }
    }
};

// ============================================================================
// SHEER CURTAIN PRICING
// ============================================================================

const calculateCurtainPriceSchema = z.object({
    width: z.number().int().positive('Width must be a positive number'),
    drop: z.number().int().positive('Drop must be a positive number'),
    openingType: z.enum(['Single Open', 'Centre Open', 'Free Fold']),
    fullness: z.number().refine(val => [120, 130, 140, 150].includes(val), 'Fullness must be 120, 130, 140, or 150'),
    bracketType: z.string().min(1, 'Bracket type is required'),
    fabric: z.string().min(1, 'Fabric is required'),
    fabricGroup: z.string().min(1, 'Fabric group is required'),
    requiresDropDeduction: z.boolean().optional(),
    dropDeductionValue: z.number().int().optional(),
    // Track type (motorised pricing)
    requiresTracks: z.boolean().optional(),
    trackType: z.string().optional(),
    motorType: z.string().optional(),
    remotes: z.string().optional(),
    chargerHub: z.array(z.string()).optional(),
});

/**
 * Calculate sheer curtain price with all components
 * POST /api/pricing/calculate-curtain
 */
export const calculateCurtainPrice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = calculateCurtainPriceSchema.parse(req.body);

        const calculation = await sheerCurtainPricingService.calculateCurtainMetrics({
            ...validatedData,
            userId: authReq.user?.id,
        });

        res.json({
            success: true,
            calculation,
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
 * Get sheer fabric pricing for a group (admin)
 * GET /api/pricing/sheer-fabric/:group
 */
export const getSheerFabricPricing = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const group = req.params.group as string;
        const userId = (req.query.userId as string) || undefined;

        const pricing = await prisma.sheerFabricPricing.findMany({
            where: {
                fabricGroup: group,
                userId: userId ?? null,
            },
            orderBy: { fabricName: 'asc' },
        });

        res.json({
            success: true,
            data: { pricing },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all default sheer fabrics across all groups (used by curtain order form)
 * GET /api/pricing/sheer-fabrics/all
 */
export const getAllSheerFabrics = async (
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const fabrics = await prisma.sheerFabricPricing.findMany({
            where: { userId: null },
            orderBy: [{ fabricGroup: 'asc' }, { fabricName: 'asc' }],
        });
        res.json({ success: true, data: { fabrics } });
    } catch (error) {
        next(error);
    }
};

/**
 * Add a new sheer fabric to a group (admin)
 * POST /api/pricing/sheer-fabric/:group
 */
export const addSheerFabric = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const group = req.params.group as string;
        const { fabricName, pricePerMeter } = req.body;

        if (!fabricName || typeof fabricName !== 'string' || !fabricName.trim()) {
            throw new AppError(400, 'Fabric name is required');
        }
        if (!pricePerMeter || pricePerMeter <= 0) {
            throw new AppError(400, 'Price per meter must be a positive number');
        }

        const created = await prisma.sheerFabricPricing.create({
            data: {
                fabricGroup: group,
                fabricName: fabricName.trim(),
                pricePerMeter,
                userId: null,
            },
        });

        res.json({ success: true, data: { fabric: created } });
    } catch (error: any) {
        if (error.code === 'P2002') {
            next(new AppError(409, 'A fabric with this name already exists in this group'));
        } else {
            next(error);
        }
    }
};

/**
 * Delete a sheer fabric (admin) - removes default + all customer overrides
 * DELETE /api/pricing/sheer-fabric/:group/:fabricName
 */
export const deleteSheerFabric = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const group = req.params.group as string;
        const fabricName = decodeURIComponent(req.params.fabricName as string);

        await prisma.sheerFabricPricing.deleteMany({
            where: { fabricGroup: group, fabricName },
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};

/**
 * Update sheer fabric pricing (admin)
 * PUT /api/pricing/sheer-fabric/:group/:fabricName
 */
export const updateSheerFabricPricing = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Express already URL-decodes path params
        const group = req.params.group as string;
        const fabricName = req.params.fabricName as string;
        const { pricePerMeter, userId } = req.body;

        if (!pricePerMeter || Number(pricePerMeter) <= 0) {
            throw new AppError(400, 'Price per meter must be a positive number');
        }

        const effectiveUserId = userId || null;
        const price = Number(pricePerMeter);

        // Use find + update/create to avoid Prisma composite-null unique constraint issues
        const existing = await prisma.sheerFabricPricing.findFirst({
            where: { fabricGroup: group, fabricName, userId: effectiveUserId },
        });

        let updated;
        if (existing) {
            updated = await prisma.sheerFabricPricing.update({
                where: { id: existing.id },
                data: { pricePerMeter: price },
            });
        } else {
            updated = await prisma.sheerFabricPricing.create({
                data: { fabricGroup: group, fabricName, pricePerMeter: price, userId: effectiveUserId },
            });
        }

        res.json({
            success: true,
            data: { pricing: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get drop surcharge settings for all sheer fabric groups (admin)
 * GET /api/pricing/sheer-group-settings
 */
export const getSheerGroupSettings = async (
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const settings = await prisma.sheerGroupSettings.findMany({
            orderBy: { fabricGroup: 'asc' },
        });
        res.json({ success: true, data: { settings } });
    } catch (error) {
        next(error);
    }
};

/**
 * Update drop surcharge for a sheer fabric group (admin)
 * PUT /api/pricing/sheer-group-settings/:group
 */
export const updateSheerGroupSettings = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const group = decodeURIComponent(req.params.group as string);
        const { dropSurchargePerM, fullness130Surcharge, fullness140Surcharge, fullness150Surcharge } = req.body;

        const updateData: Record<string, any> = {};
        if (dropSurchargePerM !== undefined) {
            if (dropSurchargePerM < 0) throw new AppError(400, 'dropSurchargePerM must be non-negative');
            updateData.dropSurchargePerM = dropSurchargePerM;
        }
        if (fullness130Surcharge !== undefined) updateData.fullness130Surcharge = fullness130Surcharge;
        if (fullness140Surcharge !== undefined) updateData.fullness140Surcharge = fullness140Surcharge;
        if (fullness150Surcharge !== undefined) updateData.fullness150Surcharge = fullness150Surcharge;

        if (Object.keys(updateData).length === 0) {
            throw new AppError(400, 'No fields to update');
        }

        const updated = await prisma.sheerGroupSettings.upsert({
            where: { fabricGroup: group },
            update: updateData,
            create: {
                fabricGroup: group,
                dropSurchargePerM: dropSurchargePerM ?? 60,
                fullness130Surcharge: fullness130Surcharge ?? 15,
                fullness140Surcharge: fullness140Surcharge ?? 25,
                fullness150Surcharge: fullness150Surcharge ?? 45,
            },
        });

        res.json({ success: true, data: { settings: updated } });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// SHEER MOTOR PRICING (by width range)
// ============================================================================

/**
 * GET /api/pricing/sheer-motor — returns all motor pricing rows for admin UI
 */
export const getSheerMotorPricing = async (
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const rows = await prisma.sheerMotorPricing.findMany({
            orderBy: [{ motorType: 'asc' }, { widthFrom: 'asc' }],
        });
        res.json({ success: true, data: { rows } });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/pricing/sheer-motor/:motorType/:widthFrom — update one cell
 */
export const updateSheerMotorPricing = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const motorType = decodeURIComponent(req.params.motorType as string);
        const widthFrom = parseInt(req.params.widthFrom as string, 10);
        const { price } = req.body;

        if (typeof price !== 'number' || price < 0) {
            throw new AppError(400, 'price must be a non-negative number');
        }

        const updated = await prisma.sheerMotorPricing.update({
            where: { motorType_widthFrom: { motorType, widthFrom } },
            data: { price },
        });

        res.json({ success: true, data: { row: updated } });
    } catch (error) {
        next(error);
    }
};
