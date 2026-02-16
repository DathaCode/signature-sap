// Mock Prisma before imports
jest.mock('@prisma/client', () => {
    const mockPrismaClient = {
        pricingMatrix: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
        },
    };
    return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

jest.mock('../../config/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../middleware/errorHandler', () => ({
    AppError: class AppError extends Error {
        statusCode: number;
        constructor(statusCode: number, message: string) {
            super(message);
            this.statusCode = statusCode;
        }
    },
}));

import { PrismaClient } from '@prisma/client';
import pricingService from '../pricing.service';

const prisma = new PrismaClient() as any;

describe('PricingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('roundToTier (tested via calculatePrice)', () => {
        // We test rounding indirectly via calculatePrice since roundToTier is private

        it('should round width to nearest tier (e.g., 650 -> 600)', async () => {
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '100.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out',
                width: 650,
                drop: 1200,
            });

            // Width 650 is closer to 600 (diff=50) than 800 (diff=150)
            expect(result.roundedWidth).toBe(600);
        });

        it('should use exact tier when width matches (e.g., 1000 -> 1000)', async () => {
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '120.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out',
                width: 1000,
                drop: 1200,
            });

            expect(result.roundedWidth).toBe(1000);
        });

        it('should cap at smallest tier for very small width (e.g., 300 -> 600)', async () => {
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '80.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out',
                width: 300,
                drop: 1200,
            });

            expect(result.roundedWidth).toBe(600);
        });

        it('should cap at largest tier for oversized width (e.g., 3500 -> 3000)', async () => {
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '200.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out',
                width: 3500,
                drop: 1200,
            });

            expect(result.roundedWidth).toBe(3000);
        });

        it('should round drop to nearest, prefer higher on tie (e.g., 1300 -> 1400)', async () => {
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '100.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out',
                width: 1000,
                drop: 1300,
            });

            expect(result.roundedDrop).toBe(1400);
        });
    });

    describe('Pricing matrix returns final price (no group discount applied)', () => {
        it('should return matrix price as final price with no discount', async () => {
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '100.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out', // G2
                width: 1000,
                drop: 1200,
            });

            // Matrix prices are already final - no additional discount
            expect(result.discountPercent).toBe(0);
            expect(result.discountAmount).toBe(0);
            expect(result.finalPrice).toBe(100.00);
        });

        it('should return basePrice equal to finalPrice', async () => {
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '200.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out', // G2
                width: 1000,
                drop: 1200,
            });

            expect(result.basePrice).toBe(200.00);
            expect(result.finalPrice).toBe(200.00);
        });
    });

    describe('Error handling', () => {
        it('should throw for unknown fabric material', async () => {
            await expect(
                pricingService.calculatePrice({
                    material: 'NonExistent',
                    fabricType: 'Whatever',
                    width: 1000,
                    drop: 1200,
                })
            ).rejects.toThrow('Unknown fabric');
        });
    });
});
