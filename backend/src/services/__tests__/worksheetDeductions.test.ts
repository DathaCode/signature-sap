// Test the motor-specific width deduction logic
// These mirror the MOTOR_DEDUCTIONS map in worksheet.service.ts

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

const TUBE_CUT_DEDUCTION = 28;

function getWidthDeduction(motorType: string, isTubeCut: boolean = false): number {
    if (isTubeCut) return TUBE_CUT_DEDUCTION;
    return MOTOR_DEDUCTIONS[motorType] || 28;
}

describe('Motor Width Deductions', () => {
    describe('Winder deductions (28mm)', () => {
        it('TBS winder-32mm should deduct 28mm', () => {
            expect(getWidthDeduction('TBS winder-32mm')).toBe(28);
        });

        it('Acmeda winder-29mm should deduct 28mm', () => {
            expect(getWidthDeduction('Acmeda winder-29mm')).toBe(28);
        });
    });

    describe('Automate motor deductions (29mm)', () => {
        const automateMotors = [
            'Automate 1.1NM Li-Ion Quiet Motor',
            'Automate 0.7NM Li-Ion Quiet Motor',
            'Automate 2NM Li-Ion Quiet Motor',
            'Automate 3NM Li-Ion Motor',
            'Automate E6 6NM Motor',
        ];

        automateMotors.forEach(motor => {
            it(`${motor} should deduct 29mm`, () => {
                expect(getWidthDeduction(motor)).toBe(29);
            });
        });
    });

    describe('Alpha Battery motor deductions (30mm)', () => {
        const alphaBatteryMotors = [
            'Alpha 1NM Battery Motor',
            'Alpha 2NM Battery Motor',
            'Alpha 3NM Battery Motor',
        ];

        alphaBatteryMotors.forEach(motor => {
            it(`${motor} should deduct 30mm`, () => {
                expect(getWidthDeduction(motor)).toBe(30);
            });
        });
    });

    describe('Alpha AC motor deductions (35mm)', () => {
        it('Alpha AC 5NM Motor should deduct 35mm', () => {
            expect(getWidthDeduction('Alpha AC 5NM Motor')).toBe(35);
        });
    });

    describe('Defaults and tube cuts', () => {
        it('unknown motor should default to 28mm', () => {
            expect(getWidthDeduction('Unknown Motor XYZ')).toBe(28);
        });

        it('tube cuts should always be 28mm regardless of motor', () => {
            expect(getWidthDeduction('Alpha AC 5NM Motor', true)).toBe(28);
            expect(getWidthDeduction('Automate 1.1NM Li-Ion Quiet Motor', true)).toBe(28);
            expect(getWidthDeduction('TBS winder-32mm', true)).toBe(28);
        });
    });

    describe('Fabric cut width calculations', () => {
        it('should calculate correct fabric cut width for each motor type', () => {
            const blindWidth = 1500;

            expect(blindWidth - getWidthDeduction('TBS winder-32mm')).toBe(1472);
            expect(blindWidth - getWidthDeduction('Automate 1.1NM Li-Ion Quiet Motor')).toBe(1471);
            expect(blindWidth - getWidthDeduction('Alpha 1NM Battery Motor')).toBe(1470);
            expect(blindWidth - getWidthDeduction('Alpha AC 5NM Motor')).toBe(1465);
        });

        it('should calculate correct tube cut width (always width - 28)', () => {
            const blindWidth = 1500;
            expect(blindWidth - getWidthDeduction('Alpha AC 5NM Motor', true)).toBe(1472);
        });
    });
});
