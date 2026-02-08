import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export class WorksheetService {
    /**
     * Get fabric cut worksheet data (all 12 columns)
     */
    static async getFabricCutWorksheet(orderId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
            },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        return {
            orderId: order.id,
            customerName: order.customerName,
            orderDate: order.orderDate,
            type: 'fabric_cut',
            columns: [
                'Blind Number',
                'Location',
                'Width (mm)',
                'Drop (mm)',
                'Control Side',
                'Control Colour',
                'Chain/Motor',
                'Roll',
                'Fabric',
                'Colour',
                'Bottom Rail Type',
                'Bottom Rail Colour',
            ],
            items: order.items.map(item => ({
                blindNumber: item.itemNumber.toString(),
                location: item.location,
                widthMm: item.calculatedWidth || item.width, // Fallback if calc is missing
                dropMm: item.calculatedDrop || item.drop,
                controlSide: item.controlSide || '-',
                controlColor: '-', // Not currently captured in OrderItem? Adding placeholder
                chainOrMotor: (item.chainOrMotor || '-').replace(/_/g, ' '),
                rollType: item.roll || '-',
                fabricType: item.fabricType || '-',
                fabricColor: item.fabricColor || '-',
                bottomRailType: item.bottomRailType || '-',
                bottomRailColor: item.bottomRailColor || '-',
                highlightFlag: item.isDuplicate,
            })),
        };
    }

    /**
     * Get tube cut worksheet data (columns 1,2,3,11,12 only)
     */
    static async getTubeCutWorksheet(orderId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
            },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        return {
            orderId: order.id,
            customerName: order.customerName,
            orderDate: order.orderDate,
            type: 'tube_cut',
            columns: [
                'Blind Number',
                'Location',
                'Width (mm)',
                'Bottom Rail Type',
                'Bottom Rail Colour',
            ],
            items: order.items.map(item => ({
                blindNumber: item.itemNumber.toString(),
                location: item.location,
                widthMm: item.calculatedWidth || item.width,
                bottomRailType: item.bottomRailType || '-',
                bottomRailColor: item.bottomRailColor || '-',
                highlightFlag: item.isDuplicate,
            })),
        };
    }

    /**
     * Get both worksheets
     */
    static async getWorksheets(orderId: string) {
        const [fabricCut, tubeCut] = await Promise.all([
            this.getFabricCutWorksheet(orderId),
            this.getTubeCutWorksheet(orderId),
        ]);

        return {
            fabricCut,
            tubeCut,
        };
    }
}
