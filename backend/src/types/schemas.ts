import { z } from 'zod';

// Enum schemas matching Prisma enums
export const ControlSideSchema = z.enum(['LEFT', 'RIGHT']);
export const ChainOrMotorSchema = z.enum([
    'PLASTIC',
    'STAINLESS_STEEL',
    'AUTOMATE_1_1NM_LI_ION_QUIET',
    'AUTOMATE_0_7NM_LI_ION_QUIET',
    'AUTOMATE_2NM_LI_ION',
    'AUTOMATE_3NM_LI_ION',
    'ALPHA_1NM_BATTERY',
]);

// Excel row data schema (before calculations)
export const ExcelRowSchema = z.object({
    blindNumber: z.string().min(1, 'Blind number is required'),
    location: z.string().min(1, 'Location is required'),
    originalWidthMm: z.number().int().positive('Width must be positive'),
    originalDropMm: z.number().int().positive('Drop must be positive'),
    controlSide: ControlSideSchema,
    controlColor: z.string().min(1, 'Control color is required'),
    chainOrMotor: ChainOrMotorSchema,
    rollType: z.string().min(1, 'Roll type is required'),
    fabricType: z.string().min(1, 'Fabric type is required'),
    fabricColor: z.string().min(1, 'Fabric color is required'),
    bottomRailType: z.string().min(1, 'Bottom rail type is required'),
    bottomRailColor: z.string().min(1, 'Bottom rail color is required'),
});

// Parsed order schema
export const ParsedOrderSchema = z.object({
    customerName: z.string().min(1, 'Customer name is required'),
    fileName: z.string(),
    items: z.array(ExcelRowSchema).min(1, 'Order must contain at least one item'),
});

// Worksheet item type (after calculations)
export type WorksheetItemInput = z.infer<typeof ExcelRowSchema> & {
    widthMm: number;
    dropMm: number;
    highlightFlag: boolean;
};

// Order confirmation request
export const OrderConfirmationSchema = z.object({
    orderId: z.string().uuid(),
});

// Download request query params
export const DownloadQuerySchema = z.object({
    type: z.enum(['fabric_cut', 'tube_cut']),
    format: z.enum(['csv', 'pdf']),
});

export type ParsedOrder = z.infer<typeof ParsedOrderSchema>;
export type ExcelRow = z.infer<typeof ExcelRowSchema>;
export type DownloadQuery = z.infer<typeof DownloadQuerySchema>;
