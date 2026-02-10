/**
 * Inventory Deduction Service
 * 
 * Implements automatic inventory deduction logic per UPGRADE.md
 * Handles all 7 sample scenarios with motor-specific logic
 */

export interface BlindItem {
    chainOrMotor: string;
    bracketType: string;
    bracketColour: string;
    controlSide: string;
    drop: number;
    chainType?: string; // Conditional: only for winders
    bottomRailType: string;
    bottomRailColour: string;
}

export interface DeductionItem {
    itemName: string;
    quantity: number;
    category: string;
}

export interface DeductionResult {
    deductions: DeductionItem[];
    errors?: string[];
}

export class InventoryDeductionService {

    /**
     * Main deduction logic for a blind item
     * Implements all 7 scenarios from UPGRADE.md
     */
    async deductForBlind(blindItem: BlindItem): Promise<DeductionResult> {
        const deductions: DeductionItem[] = [];
        const errors: string[] = [];

        const motor = blindItem.chainOrMotor;

        // Validate TBS + Extended bracket combination (should be blocked at frontend)
        if (motor === 'TBS winder-32mm' && blindItem.bracketType === 'Single Extension') {
            errors.push('Extended bracket set is not available with TBS winder-32mm');
            return { deductions, errors };
        }

        // 1. DEDUCT MOTOR/CHAIN (always 1 unit)
        deductions.push({
            itemName: motor,
            quantity: 1,
            category: 'Motors'
        });

        // 2. DEDUCT BASED ON MOTOR TYPE
        if (motor === 'Acmeda winder-29mm') {
            this.deductAcemedaWinder(deductions, blindItem);

        } else if (motor === 'TBS winder-32mm') {
            this.deductTBSWinder(deductions, blindItem);

        } else {
            // All other motors (Automate & Alpha)
            this.deductOtherMotors(deductions, blindItem);
        }

        return { deductions, errors };
    }

    /**
     * Sample 1 & 2: Acmeda winder logic
     */
    private deductAcemedaWinder(deductions: DeductionItem[], blindItem: BlindItem): void {
        // Idler & Clutch
        deductions.push({ itemName: 'Acmeda Idler', quantity: 1, category: 'Accessories' });
        deductions.push({ itemName: 'Acmeda Clutch', quantity: 1, category: 'Accessories' });

        // Brackets (Acmeda brand)
        deductions.push(...this.getBracketDeduction('Acmeda', blindItem));

        // Chain
        deductions.push(...this.getChainDeduction(blindItem));

        // Clips
        deductions.push(...this.getClipsDeduction(blindItem));

        // Stop bolt & Safety lock
        deductions.push({ itemName: 'Stop bolt', quantity: 1, category: 'Accessories' });
        deductions.push({ itemName: 'Safety lock', quantity: 1, category: 'Accessories' });
    }

    /**
     * Sample 3 & 4: TBS winder logic
     */
    private deductTBSWinder(deductions: DeductionItem[], blindItem: BlindItem): void {
        const bracketType = blindItem.bracketType;

        // EXCEPTION: Dual brackets need separate Idler & Clutch
        if (bracketType === 'Dual Left' || bracketType === 'Dual Right') {
            deductions.push({ itemName: 'Acmeda Idler', quantity: 1, category: 'Accessories' });
            deductions.push({ itemName: 'Acmeda Clutch', quantity: 1, category: 'Accessories' });
        }
        // For Single TBS bracket, Idler & Clutch already included in bracket set

        // Brackets (TBS brand)
        deductions.push(...this.getBracketDeduction('TBS', blindItem));

        // Chain
        deductions.push(...this.getChainDeduction(blindItem));

        // Clips
        deductions.push(...this.getClipsDeduction(blindItem));

        // Stop bolt & Safety lock
        deductions.push({ itemName: 'Stop bolt', quantity: 1, category: 'Accessories' });
        deductions.push({ itemName: 'Safety lock', quantity: 1, category: 'Accessories' });
    }

    /**
     * Sample 5, 6, 7: Automate & Alpha motors
     */
    private deductOtherMotors(deductions: DeductionItem[], blindItem: BlindItem): void {
        // Idler (all motorized systems need this)
        deductions.push({ itemName: 'Acmeda Idler', quantity: 1, category: 'Accessories' });

        // Brackets (Acmeda brand for all motors)
        deductions.push(...this.getBracketDeduction('Acmeda', blindItem));

        // Clips
        deductions.push(...this.getClipsDeduction(blindItem));

        // NO chain, NO stop bolt, NO safety lock for motorized systems
    }

    /**
     * Get bracket deduction
     */
    private getBracketDeduction(brand: string, item: BlindItem): DeductionItem[] {
        const { bracketType, bracketColour } = item;

        let bracketName = `${brand} `;

        if (bracketType === 'Single') {
            bracketName += `Single Bracket set - ${bracketColour}`;
        } else if (bracketType === 'Single Extension') {
            bracketName += `Extended Bracket set - ${bracketColour}`;
        } else if (bracketType === 'Dual Left') {
            bracketName += `Duel Bracket set Left - ${bracketColour}`;
        } else if (bracketType === 'Dual Right') {
            bracketName += `Duel Bracket set Right - ${bracketColour}`;
        }

        return [{ itemName: bracketName, quantity: 1, category: 'Brackets' }];
    }

    /**
     * Get chain deduction (conditional on winder motor)
     */
    private getChainDeduction(item: BlindItem): DeductionItem[] {
        const chainType = item.chainType || 'Stainless Steel'; // Default if not specified
        const length = this.getChainLength(item.drop);

        return [{
            itemName: `${chainType} Chain - ${length}mm`,
            quantity: 1,
            category: 'Chains'
        }];
    }

    /**
     * Get clips deduction (2 clips: left & right)
     */
    private getClipsDeduction(item: BlindItem): DeductionItem[] {
        const { bottomRailType, bottomRailColour } = item;

        return [
            {
                itemName: `Bottom bar Clips Left - ${bottomRailType} - ${bottomRailColour}`,
                quantity: 1,
                category: 'Clips'
            },
            {
                itemName: `Bottom bar Clips Right - ${bottomRailType} - ${bottomRailColour}`,
                quantity: 1,
                category: 'Clips'
            }
        ];
    }

    /**
     * Chain length selection based on drop
     * Per UPGRADE.md spec:
     * ≤850mm → 500mm
     * 850-1100mm → 750mm
     * 1100-1600mm → 1000mm
     * 1600-2200mm → 1200mm
     * >2200mm → 1500mm
     */
    private getChainLength(drop: number): number {
        if (drop <= 850) return 500;
        if (drop <= 1100) return 750;
        if (drop <= 1600) return 1000;
        if (drop <= 2200) return 1200;
        return 1500; // drop > 2200mm (up to 4000mm)
    }
}

export default new InventoryDeductionService();
