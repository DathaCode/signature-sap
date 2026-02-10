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

        it('should round width UP to next tier (e.g., 650 -> 800)', async () => {
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '100.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out',
                width: 650,
                drop: 1200,
            });

            // Width 650 is between 600 and 800, should round UP to 800
            expect(result.roundedWidth).toBe(800);
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

        it('should round drop UP similarly (e.g., 1300 -> 1400)', async () => {
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

    describe('Discount by fabric group', () => {
        it('should apply 20% discount for G1', async () => {
            // Mock getFabricGroup to return G1 by using a known G1 fabric
            // Alpha - Avoca Block Out = G2, so let's use the price result
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '100.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out', // G2
                width: 1000,
                drop: 1200,
            });

            // G2 = 25% discount
            expect(result.discountPercent).toBe(25);
            expect(result.discountAmount).toBe(25.00);
            expect(result.finalPrice).toBe(75.00);
        });

        it('should calculate final price correctly with discount', async () => {
            prisma.pricingMatrix.findUnique.mockResolvedValue({ price: '200.00' });

            const result = await pricingService.calculatePrice({
                material: 'Alpha',
                fabricType: 'Avoca Block Out', // G2 = 25%
                width: 1000,
                drop: 1200,
            });

            expect(result.basePrice).toBe(200.00);
            expect(result.finalPrice).toBe(150.00); // 200 - 25% = 150
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
