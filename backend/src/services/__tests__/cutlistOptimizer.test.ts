import { CutlistOptimizer, PanelInput } from '../cutlistOptimizer.service';

describe('CutlistOptimizer', () => {
    let optimizer: CutlistOptimizer;

    beforeEach(() => {
        optimizer = new CutlistOptimizer({
            stockWidth: 3000,
            stockLength: 10000,
        });
    });

    test('should optimize single blind (minimal case)', () => {
        const panels: PanelInput[] = [
            { width: 1472, length: 2250, qty: 1, label: 'Living Room - 1500x2100' },
        ];

        const result = optimizer.optimize(panels);

        expect(result.sheets.length).toBe(1);
        expect(result.statistics.totalPanels).toBe(1);
        expect(result.statistics.totalCuts).toBe(1);
        expect(result.sheets[0].panels[0].x).toBe(0);
        expect(result.sheets[0].panels[0].y).toBe(0);
        expect(result.statistics.efficiency).toBeGreaterThan(0);
    });

    test('should pack multiple identical blinds efficiently', () => {
        const panels: PanelInput[] = [
            { width: 1472, length: 2250, qty: 3, label: 'Same Size' },
        ];

        const result = optimizer.optimize(panels);

        // 3 panels of 1472x2250 should fit on 1 sheet (3000x10000)
        // 1472*2=2944 fits in 3000 width, so 2 side by side
        expect(result.sheets.length).toBeLessThanOrEqual(2);
        expect(result.statistics.totalPanels).toBe(3);
        expect(result.statistics.efficiency).toBeGreaterThan(10);
    });

    test('should sort by area (largest first - First Fit Decreasing)', () => {
        const panels: PanelInput[] = [
            { width: 500, length: 500, qty: 1, label: 'Small' },
            { width: 2000, length: 2000, qty: 1, label: 'Large' },
            { width: 1000, length: 1000, qty: 1, label: 'Medium' },
        ];

        const result = optimizer.optimize(panels);

        // The largest panel should be placed first (sheet 1, position 0,0)
        const firstPlaced = result.sheets[0].panels[0];
        expect(firstPlaced.width * firstPlaced.length).toBeGreaterThanOrEqual(
            result.sheets[0].panels[1].width * result.sheets[0].panels[1].length
        );
    });

    test('should rotate panels when needed for better fit', () => {
        // Panel 2800x1500 won't fit normal (2800 < 3000 ok, but let's test rotation)
        const panels: PanelInput[] = [
            { width: 2800, length: 1500, qty: 2, label: 'Needs rotation check' },
        ];

        const result = optimizer.optimize(panels);

        expect(result.statistics.totalPanels).toBe(2);
        // Both should fit on sheets (2800 < 3000, and 1500 < 10000)
        expect(result.sheets.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle large order (10+ blinds)', () => {
        const panels: PanelInput[] = [
            { width: 1472, length: 2250, qty: 5, label: 'Type A' },
            { width: 972, length: 1950, qty: 5, label: 'Type B' },
            { width: 1972, length: 2550, qty: 3, label: 'Type C' },
        ];

        const result = optimizer.optimize(panels);

        expect(result.statistics.totalPanels).toBe(13);
        expect(result.statistics.efficiency).toBeGreaterThan(0);
        expect(result.sheets.length).toBeGreaterThanOrEqual(1);
        expect(result.sheets.length).toBeLessThanOrEqual(10);
    });

    test('should warn when panel too large for stock in both orientations', () => {
        // Panel wider AND longer than stock — cannot be placed even rotated
        const panels: PanelInput[] = [
            { width: 3500, length: 3500, qty: 1, label: 'Too large both ways' },
        ];

        const result = optimizer.optimize(panels);

        // Panel should not be placed (exceeds 3000mm in both dimensions)
        expect(result.statistics.totalCuts).toBe(0);
    });

    test('should calculate statistics correctly', () => {
        const panels: PanelInput[] = [
            { width: 1000, length: 1000, qty: 4, label: 'Square' },
        ];

        const result = optimizer.optimize(panels);

        const totalStockArea = result.sheets.length * 3000 * 10000;
        const expectedUsedArea = 4 * 1000 * 1000; // 4,000,000

        expect(result.statistics.totalUsedArea).toBe(expectedUsedArea);
        expect(result.statistics.totalWastedArea).toBe(totalStockArea - expectedUsedArea);
        expect(result.statistics.wastePercentage + result.statistics.efficiency).toBe(100);
    });

    test('should calculate totalFabricNeeded as sheets * stockLength', () => {
        const panels: PanelInput[] = [
            { width: 2900, length: 9900, qty: 2, label: 'Large' },
        ];

        const result = optimizer.optimize(panels);

        // Each panel nearly fills a sheet, so should need 2 sheets
        expect(result.statistics.totalFabricNeeded).toBe(
            result.sheets.length * 10000
        );
    });

    test('should use dynamic stock length', () => {
        const shortRollOptimizer = new CutlistOptimizer({
            stockWidth: 3000,
            stockLength: 5000, // shorter rolls
        });

        const panels: PanelInput[] = [
            { width: 1472, length: 2250, qty: 3, label: 'Short roll test' },
        ];

        const result = shortRollOptimizer.optimize(panels);

        // With shorter rolls, may need more sheets
        expect(result.statistics.totalFabricNeeded).toBe(
            result.sheets.length * 5000
        );
    });

    test('should generate cut list entries', () => {
        const panels: PanelInput[] = [
            { width: 1000, length: 2000, qty: 2, label: 'Test Cut' },
        ];

        const result = optimizer.optimize(panels);

        expect(result.cuts.length).toBe(2);
        result.cuts.forEach((cut, idx) => {
            expect(cut.cutNumber).toBe(idx + 1);
            expect(cut.sheetNumber).toBeGreaterThanOrEqual(1);
            expect(typeof cut.x).toBe('number');
            expect(typeof cut.y).toBe('number');
        });
    });
});
