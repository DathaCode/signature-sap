import * as XLSX from 'xlsx';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { ExcelRow, ControlSideSchema, ChainOrMotorSchema } from '../types/schemas';

export class ExcelParserService {
    /**
     * Parse Excel file starting from Row 13
     * Columns: A=Number, B=Location, C=Width, D=Drop, E=Group (skip),
     *          F=Fixing (skip), G=Control Side, H=Control Colour,
     *          I=Chain or Motor, J=Roll, K=Fabric, L=Colour,
     *          M=Bottom Rail Type, N=Bottom Rail Colour,
     *          O=Sub-Total (skip), P=Discount (skip), Q=Cost (skip)
     */
    static parseOrderFile(fileBuffer: Buffer, fileName: string): ExcelRow[] {
        try {
            logger.info(`Parsing Excel file: ${fileName}`);

            // Read workbook
            const workbook = XLSX.read(fileBuffer, {
                type: 'buffer',
                cellDates: true,
                cellNF: false,
                cellText: false,
            });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            if (!worksheet) {
                throw new AppError(400, 'Excel file is empty or corrupted');
            }

            // Convert to JSON starting from row 13
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                range: 12, // 0-indexed, so row 13 = index 12
                header: 'A', // Use column letters as keys
                defval: '', // Default value for empty cells
                blankrows: false, // Skip blank rows
            });

            if (!jsonData || jsonData.length === 0) {
                throw new AppError(400, 'No data found starting from Row 13');
            }

            logger.info(`Found ${jsonData.length} rows in Excel file`);

            // Parse and validate each row
            const parsedItems: ExcelRow[] = [];

            for (let i = 0; i < jsonData.length; i++) {
                const row: any = jsonData[i];
                const rowNumber = i + 13; // Actual Excel row number

                try {
                    // Skip completely empty rows
                    if (this.isEmptyRow(row)) {
                        logger.debug(`Skipping empty row ${rowNumber}`);
                        continue;
                    }

                    // Map Excel columns to our schema
                    const item: ExcelRow = {
                        blindNumber: this.getCellValue(row, 'A', rowNumber, 'Blind Number'),
                        location: this.getCellValue(row, 'B', rowNumber, 'Location'),
                        originalWidthMm: this.getNumericValue(row, 'C', rowNumber, 'Width'),
                        originalDropMm: this.getNumericValue(row, 'D', rowNumber, 'Drop'),
                        // Column E (Group) - skipped
                        // Column F (Fixing) - skipped
                        controlSide: this.normalizeControlSide(
                            this.getCellValue(row, 'G', rowNumber, 'Control Side')
                        ),
                        controlColor: this.getCellValue(row, 'H', rowNumber, 'Control Colour'),
                        chainOrMotor: this.normalizeChainOrMotor(
                            this.getCellValue(row, 'I', rowNumber, 'Chain or Motor')
                        ),
                        rollType: this.getCellValue(row, 'J', rowNumber, 'Roll'),
                        fabricType: this.getCellValue(row, 'K', rowNumber, 'Fabric'),
                        fabricColor: this.getCellValue(row, 'L', rowNumber, 'Colour'),
                        bottomRailType: this.getCellValue(row, 'M', rowNumber, 'Bottom Rail Type'),
                        bottomRailColor: this.getCellValue(row, 'N', rowNumber, 'Bottom Rail Colour'),
                        // Columns O, P, Q (Sub-Total, Discount, Cost) - skipped
                    };

                    parsedItems.push(item);
                } catch (error) {
                    if (error instanceof AppError) {
                        throw error;
                    }
                    throw new AppError(400, `Row ${rowNumber}: ${(error as Error).message}`);
                }
            }

            if (parsedItems.length === 0) {
                throw new AppError(400, 'No valid items found in Excel file');
            }

            logger.info(`Successfully parsed ${parsedItems.length} valid items`);
            return parsedItems;

        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error('Excel parsing failed:', error);
            throw new AppError(500, `Failed to parse Excel file: ${(error as Error).message}`);
        }
    }

    /**
     * Check if row is completely empty
     */
    private static isEmptyRow(row: any): boolean {
        const cellsToCheck = ['A', 'B', 'C', 'D', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
        return cellsToCheck.every(col => {
            const value = row[col];
            return value === undefined || value === null || value === '';
        });
    }

    /**
     * Get cell value as string with validation
     */
    private static getCellValue(row: any, column: string, rowNumber: number, fieldName: string): string {
        const value = row[column];

        if (value === undefined || value === null || value === '') {
            throw new AppError(400, `${fieldName} is required at row ${rowNumber}, column ${column}`);
        }

        return String(value).trim();
    }

    /**
     * Get cell value as number with validation
     */
    private static getNumericValue(row: any, column: string, rowNumber: number, fieldName: string): number {
        const value = row[column];

        if (value === undefined || value === null || value === '') {
            throw new AppError(400, `${fieldName} is required at row ${rowNumber}, column ${column}`);
        }

        const numValue = Number(value);

        if (isNaN(numValue) || numValue <= 0) {
            throw new AppError(400, `${fieldName} must be a positive number at row ${rowNumber}, column ${column}`);
        }

        return Math.round(numValue); // Ensure integer
    }

    /**
     * Normalize control side to enum value
     */
    private static normalizeControlSide(value: string): 'LEFT' | 'RIGHT' {
        const normalized = value.toUpperCase().trim();

        // Handle common variations
        if (normalized === 'LEFT' || normalized === 'L') {
            return 'LEFT';
        }
        if (normalized === 'RIGHT' || normalized === 'R') {
            return 'RIGHT';
        }

        // Validate with Zod
        const result = ControlSideSchema.safeParse(normalized);
        if (!result.success) {
            throw new AppError(400, `Invalid control side: "${value}". Must be LEFT or RIGHT.`);
        }

        return result.data;
    }

    /**
     * Normalize chain/motor type to enum value
     */
    private static normalizeChainOrMotor(value: string): string {
        const normalized = value.toUpperCase().trim();

        // Mapping common variations to enum values
        const mappings: Record<string, string> = {
            'PLASTIC': 'PLASTIC',
            'PLASTIC CHAIN': 'PLASTIC',
            'STAINLESS STEEL': 'STAINLESS_STEEL',
            'STAINLESS': 'STAINLESS_STEEL',
            'SS': 'STAINLESS_STEEL',
            'AUTOMATE 1.1NM LI-ION QUIET': 'AUTOMATE_1_1NM_LI_ION_QUIET',
            'AUTOMATE 1.1': 'AUTOMATE_1_1NM_LI_ION_QUIET',
            'AUTOMATE 0.7NM LI-ION QUIET': 'AUTOMATE_0_7NM_LI_ION_QUIET',
            'AUTOMATE 0.7': 'AUTOMATE_0_7NM_LI_ION_QUIET',
            'AUTOMATE 2NM LI-ION': 'AUTOMATE_2NM_LI_ION',
            'AUTOMATE 2': 'AUTOMATE_2NM_LI_ION',
            'AUTOMATE 3NM LI-ION': 'AUTOMATE_3NM_LI_ION',
            'AUTOMATE 3': 'AUTOMATE_3NM_LI_ION',
            'ALPHA 1NM BATTERY': 'ALPHA_1NM_BATTERY',
            'ALPHA 1': 'ALPHA_1NM_BATTERY',
        };

        const mapped = mappings[normalized];
        if (mapped) {
            return mapped;
        }

        // Try direct validation
        const result = ChainOrMotorSchema.safeParse(normalized.replace(/\s+/g, '_'));
        if (result.success) {
            return result.data;
        }

        throw new AppError(
            400,
            `Invalid chain/motor type: "${value}". Must be one of: Plastic, Stainless Steel, Automate 1.1NM, 0.7NM, 2NM, 3NM, or Alpha 1NM`
        );
    }
}
