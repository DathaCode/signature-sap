import { PrismaClient } from '@prisma/client';
import { getFabricGroup } from '../data/fabrics';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

// Width tiers (mm)
const WIDTH_TIERS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];

// Drop tiers (mm)
const DROP_TIERS = [1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];

// Fabric group discount rates
// G1: 20%, G2: 25%, G3: 30%
// Only groups 1-3 are applicable (G4/G5 fabrics do not exist)
const FABRIC_GROUP_DISCOUNTS: Record<number, number> = {
    1: 20,
    2: 25,
    3: 30,
};

export interface BlindItemData {
    material: string;
    fabricType: string;
    width: number;  // mm
    drop: number;   // mm
}

export interface PriceResult {
    basePrice: number;
    discountPercent: number;
    discountAmount: number;
    finalPrice: number;
    fabricGroup: number;
    roundedWidth: number;
    roundedDrop: number;
}

export class PricingService {
    /**
     * Calculate price for a blind item
     */
    async calculatePrice(item: BlindItemData): Promise<PriceResult> {
        try {
            // Get fabric group
            const fabricGroup = getFabricGroup(item.material, item.fabricType);
            if (fabricGroup === null) {
                throw new AppError(400, `Unknown fabric: ${item.material} - ${item.fabricType}`);
            }

            // Round to nearest tier
            const roundedWidth = this.roundToTier(item.width, WIDTH_TIERS);
            const roundedDrop = this.roundToTier(item.drop, DROP_TIERS);

            // Get base price from matrix
            const basePrice = await this.getPriceFromMatrix(fabricGroup, roundedWidth, roundedDrop);

            // Apply fabric group discount
            const discountPercent = FABRIC_GROUP_DISCOUNTS[fabricGroup] || 0;
            const discountAmount = parseFloat((basePrice * discountPercent / 100).toFixed(2));
            const finalPrice = parseFloat((basePrice - discountAmount).toFixed(2));

            logger.info(`Price calculated: ${item.material} ${item.fabricType} (G${fabricGroup}) ${item.width}x${item.drop} → Base: $${basePrice.toFixed(2)}, Discount: ${discountPercent}%, Final: $${finalPrice.toFixed(2)}`);

            return {
                basePrice: parseFloat(basePrice.toFixed(2)),
                discountPercent,
                discountAmount,
                finalPrice,
                fabricGroup,
                roundedWidth,
                roundedDrop,
            };
        } catch (error) {
            logger.error(`Pricing calculation error: ${error}`);
            throw error;
        }
    }

    /**
     * Get price from pricing matrix (nearest match)
     */
    private async getPriceFromMatrix(
        fabricGroup: number,
        width: number,
        drop: number
    ): Promise<number> {
        // Try exact match first
        const exactPrice = await prisma.pricingMatrix.findUnique({
            where: {
                fabricGroup_width_drop: {
                    fabricGroup,
                    width,
                    drop,
                },
            },
        });

        if (exactPrice) {
            return parseFloat(exactPrice.price.toString());
        }

        // If no exact match, find nearest available price
        // This is a fallback - in production, all combinations should exist
        const nearestPrice = await prisma.pricingMatrix.findFirst({
            where: {
                fabricGroup,
            },
            orderBy: [
                { width: 'asc' },
                { drop: 'asc' },
            ],
        });

        if (!nearestPrice) {
            throw new AppError(500, `No pricing data found for fabric group ${fabricGroup}`);
        }

        logger.warn(`No exact price match for G${fabricGroup} ${width}x${drop}, using nearest: ${nearestPrice.width}x${nearestPrice.drop}`);
        return parseFloat(nearestPrice.price.toString());
    }

    /**
     * Round value to nearest tier (round up if exactly in middle)
     * Matches SAMPLE.html logic: find closest by absolute difference, prefer higher on tie
     */
    private roundToTier(value: number, tiers: number[]): number {
        // If value is less than or equal to smallest tier, use smallest tier
        if (value <= tiers[0]) {
            return tiers[0];
        }

        // If value is greater than or equal to largest tier, use largest tier
        if (value >= tiers[tiers.length - 1]) {
            return tiers[tiers.length - 1];
        }

        // Find closest tier by absolute difference (prefer higher on tie)
        let closestTier = tiers[0];
        let minDiff = Math.abs(value - tiers[0]);

        for (const tier of tiers) {
            const diff = Math.abs(value - tier);
            if (diff < minDiff || (diff === minDiff && tier > closestTier)) {
                minDiff = diff;
                closestTier = tier;
            }
        }

        return closestTier;
    }

    /**
     * Get all pricing for a specific fabric group (for admin pricing management)
     */
    async getPricingMatrixByGroup(fabricGroup: number) {
        const pricing = await prisma.pricingMatrix.findMany({
            where: { fabricGroup },
            orderBy: [{ width: 'asc' }, { drop: 'asc' }],
        });

        return pricing.map(p => ({
            id: p.id,
            width: p.width,
            drop: p.drop,
            price: parseFloat(p.price.toString()),
            updatedBy: p.updatedBy,
            updatedAt: p.updatedAt,
        }));
    }

    /**
     * Update pricing for a specific fabric group/width/drop combination (admin only)
     */
    async updatePrice(
        fabricGroup: number,
        width: number,
        drop: number,
        price: number,
        updatedBy: string
    ) {
        const updated = await prisma.pricingMatrix.upsert({
            where: {
                fabricGroup_width_drop: {
                    fabricGroup,
                    width,
                    drop,
                },
            },
            update: {
                price,
                updatedBy,
            },
            create: {
                fabricGroup,
                width,
                drop,
                price,
                updatedBy,
            },
        });

        logger.info(`Pricing updated: G${fabricGroup} ${width}x${drop} = $${price} by ${updatedBy}`);

        return {
            id: updated.id,
            fabricGroup: updated.fabricGroup,
            width: updated.width,
            drop: updated.drop,
            price: parseFloat(updated.price.toString()),
        };
    }
}

export default new PricingService();
