import { TubeCutOptimizer, TubeBlindInput } from '../tubeCutOptimizer.service';

describe('TubeCutOptimizer', () => {
    let optimizer: TubeCutOptimizer;

    beforeEach(() => {
        optimizer = new TubeCutOptimizer();
    });

    test('should calculate correctly for small total (< 1 piece)', () => {
        const blinds: TubeBlindInput[] = [
            { location: 'Living Room', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
            { location: 'Bedroom', originalWidth: 2200, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        ];

        const result = optimizer.optimize(blinds);

        expect(result.groups.length).toBe(1);
        expect(result.groups[0].totalWidth).toBe(3700);
        // 3700/5800 = 0.638, +10% = 0.702, ceil = 1
        expect(result.groups[0].piecesToDeduct).toBe(1);
        expect(result.totalPiecesNeeded).toBe(1);
    });

    test('should calculate with 10% wastage for exact multiple', () => {
        const blinds: TubeBlindInput[] = [
            { location: 'Room 1', originalWidth: 5800, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        ];

        const result = optimizer.optimize(blinds);

        // 5800/5800 = 1.0, +10% = 1.1, ceil = 2
        expect(result.groups[0].baseQuantity).toBeCloseTo(1.0, 2);
        expect(result.groups[0].piecesToDeduct).toBe(2);
    });

    test('should match documented example (3 blinds D30 Anodised)', () => {
        const blinds: TubeBlindInput[] = [
            { location: 'Living Room', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
            { location: 'Bedroom 1', originalWidth: 2200, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
            { location: 'Bedroom 2', originalWidth: 3400, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        ];

        const result = optimizer.optimize(blinds);

        expect(result.groups[0].totalWidth).toBe(7100);
        expect(result.groups[0].baseQuantity).toBeCloseTo(1.224, 2);
        expect(result.groups[0].wastage).toBeCloseTo(0.122, 2);
        expect(result.groups[0].finalQuantity).toBeCloseTo(1.346, 2);
        expect(result.groups[0].piecesToDeduct).toBe(2);
    });

    test('should handle large order (documented example 2)', () => {
        // 15 blinds totaling 90885mm
        const widths = [5000, 6000, 7000, 5500, 6500, 7500, 5200, 6200, 7200, 5800, 6800, 4000, 4500, 5000, 4685];
        const blinds: TubeBlindInput[] = widths.map((w, i) => ({
            location: `Room ${i + 1}`,
            originalWidth: w,
            bottomRailType: 'Oval',
            bottomRailColour: 'Black',
        }));

        const totalWidth = widths.reduce((a, b) => a + b, 0);
        const result = optimizer.optimize(blinds);

        expect(result.groups[0].totalWidth).toBe(totalWidth);
        expect(result.groups[0].blinds.length).toBe(15);
        // Verify the formula: ceil(totalWidth/5800 * 1.1)
        const expected = Math.ceil((totalWidth / 5800) * 1.1);
        expect(result.groups[0].piecesToDeduct).toBe(expected);
    });

    test('should group by bottom rail type and colour separately', () => {
        const blinds: TubeBlindInput[] = [
            { location: 'Room A', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
            { location: 'Room B', originalWidth: 2000, bottomRailType: 'D30', bottomRailColour: 'Black' },
            { location: 'Room C', originalWidth: 1800, bottomRailType: 'Oval', bottomRailColour: 'Anodised' },
        ];

        const result = optimizer.optimize(blinds);

        expect(result.groups.length).toBe(3);
        expect(result.totalPiecesNeeded).toBe(3); // 1 piece per group (small widths)
    });

    test('should use original width, not calculated width', () => {
        // Ensure we're using the original width passed in, not W-28
        const blinds: TubeBlindInput[] = [
            { location: 'Room 1', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        ];

        const result = optimizer.optimize(blinds);

        // totalWidth should be 1500 (original), not 1472 (W-28)
        expect(result.groups[0].totalWidth).toBe(1500);
    });

    test('should set stock length constant at 5800mm', () => {
        const blinds: TubeBlindInput[] = [
            { location: 'Room 1', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        ];

        const result = optimizer.optimize(blinds);

        expect(result.groups[0].stockLength).toBe(5800);
    });

    test('should round values to 3 decimal places', () => {
        const blinds: TubeBlindInput[] = [
            { location: 'Room 1', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
            { location: 'Room 2', originalWidth: 2200, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
            { location: 'Room 3', originalWidth: 3400, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        ];

        const result = optimizer.optimize(blinds);

        // Check precision
        const baseStr = result.groups[0].baseQuantity.toString().split('.')[1] || '';
        expect(baseStr.length).toBeLessThanOrEqual(3);
    });
});
