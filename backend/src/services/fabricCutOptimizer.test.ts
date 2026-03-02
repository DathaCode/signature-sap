/**
 * Fabric Cut Optimizer — MaxRects algorithm tests
 *
 * Sample data sets:
 *   7-blind  (spec)   : 650×2250, 2250×2100 ×2, 2999×2100, 650×2860, 1200×2500, 950×2250
 *   10-blind (CutLogic): 1500×1500, 1800×1000 ×2, 1500×1000, 600×1000, 2400×2100, 2400×1500, 1800×600, 610×1200, 2999×1345
 */
import { FabricCutOptimizerService } from './fabricCutOptimizer.service';

describe('FabricCutOptimizerService', () => {
    let optimizer: FabricCutOptimizerService;

    beforeEach(() => {
        optimizer = new FabricCutOptimizerService();
    });

    // ---------------------------------------------------------------
    // Helper — build an order-item-like object for the optimizer
    // ---------------------------------------------------------------
    function makeItem(
        id: number,
        width: number,
        drop: number,
        location: string,
        motor = 'TBS winder-32mm'
    ) {
        return {
            id,
            itemNumber: id,
            location,
            width,
            drop,
            material: 'Textstyle',
            fabricType: 'Focus',
            fabricColour: 'White',
            chainOrMotor: motor,
        };
    }

    // ================================================================
    // 7-blind test set (from original spec)
    // ================================================================
    const sevenBlinds = [
        makeItem(1, 650, 2250, 'Living Room', 'Automate 1.1NM Li-Ion Quiet Motor'),
        makeItem(2, 2250, 2100, 'Bedroom 1'),
        makeItem(3, 2250, 2100, 'Bedroom 2'),
        makeItem(4, 2999, 2100, 'Dining Room', 'Acmeda winder-29mm'),
        makeItem(5, 650, 2860, 'Kitchen', 'Alpha 1NM Battery Motor'),
        makeItem(6, 1200, 2500, 'Office', 'Automate 2NM Li-Ion Motor'),
        makeItem(7, 950, 2250, 'Hallway', 'Alpha AC 5NM Motor'),
    ];

    // ================================================================
    // 10-blind test set (from CutLogic 2D screenshot, 74.79% baseline)
    // All use default motor (28 mm deduction)
    // ================================================================
    const tenBlinds = [
        makeItem(1, 1500, 1500, 'Room 1'),
        makeItem(2, 1800, 1000, 'Room 2'),
        makeItem(3, 1500, 1000, 'Room 3'),
        makeItem(4, 1800, 1000, 'Room 4'),
        makeItem(5, 600, 1000, 'Room 5'),
        makeItem(6, 2400, 2100, 'Room 6'),
        makeItem(7, 2400, 1500, 'Room 7'),
        makeItem(8, 1800, 600, 'Room 8'),
        makeItem(9, 610, 1200, 'Room 9'),
        makeItem(10, 2999, 1345, 'Room 10'),
    ];

    // ---------------------------------------------------------------
    // 7-blind suite
    // ---------------------------------------------------------------
    describe('7-blind sample', () => {
        test('groups all items into one fabric group', async () => {
            const results = await optimizer.optimizeOrder(sevenBlinds);
            expect(results.size).toBe(1);
            expect(results.has('Textstyle - Focus - White')).toBe(true);
        });

        test('uses at most 2 sheets', async () => {
            const results = await optimizer.optimizeOrder(sevenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            expect(r.sheets.length).toBeLessThanOrEqual(2);
        });

        test('achieves >= 60% efficiency', async () => {
            const results = await optimizer.optimizeOrder(sevenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            console.log(`  7-blind efficiency: ${r.efficiency.toFixed(2)}%`);
            expect(r.efficiency).toBeGreaterThanOrEqual(60);
        });

        test('applies motor-specific width deductions correctly', async () => {
            const results = await optimizer.optimizeOrder(sevenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            const allPanels = r.sheets.flatMap(s => s.panels);

            // Each panel stores its original (unrotated) width/length.
            // After rotation, the panel's on-sheet width/length may be swapped.
            // The original fabricCutWidth is one of the two dimensions.

            // Item 1 — 650 - 29 = 621
            const p1 = allPanels.find(p => p.blindNumber === 1)!;
            expect([p1.width, p1.length]).toContain(621);

            // Item 4 — 2999 - 28 = 2971
            const p4 = allPanels.find(p => p.blindNumber === 4)!;
            expect([p4.width, p4.length]).toContain(2971);

            // Item 5 — 650 - 30 = 620
            const p5 = allPanels.find(p => p.blindNumber === 5)!;
            expect([p5.width, p5.length]).toContain(620);

            // Item 7 — 950 - 35 = 915
            const p7 = allPanels.find(p => p.blindNumber === 7)!;
            expect([p7.width, p7.length]).toContain(915);
        });

        test('adds 150 mm to drop', async () => {
            const results = await optimizer.optimizeOrder(sevenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            const allPanels = r.sheets.flatMap(s => s.panels);

            // Item 1 drop 2250 + 150 = 2400
            const p1 = allPanels.find(p => p.blindNumber === 1)!;
            expect([p1.width, p1.length]).toContain(2400);
        });
    });

    // ---------------------------------------------------------------
    // 10-blind suite (CutLogic 2D reference: 74.79% on 1 sheet)
    // ---------------------------------------------------------------
    describe('10-blind CutLogic sample', () => {
        test('produces 1-2 sheets', async () => {
            const results = await optimizer.optimizeOrder(tenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            console.log(`  10-blind sheets: ${r.sheets.length}`);
            expect(r.sheets.length).toBeLessThanOrEqual(2);
        });

        test('achieves >= 60% efficiency (target 75-85%)', async () => {
            const results = await optimizer.optimizeOrder(tenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            console.log(`  10-blind efficiency: ${r.efficiency.toFixed(2)}%`);
            // CutLogic 2D achieves 74.79% on this set
            expect(r.efficiency).toBeGreaterThanOrEqual(60);
        });

        test('reports correct panel count', async () => {
            const results = await optimizer.optimizeOrder(tenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            expect(r.statistics.totalPanels).toBe(10);
        });

        test('sheet width is 3000 mm', async () => {
            const results = await optimizer.optimizeOrder(tenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            r.sheets.forEach(s => expect(s.width).toBe(3000));
        });

        test('sheet length <= 10000 mm', async () => {
            const results = await optimizer.optimizeOrder(tenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            r.sheets.forEach(s => expect(s.actualUsedLength).toBeLessThanOrEqual(10000));
        });

        test('all panels placed (none lost)', async () => {
            const results = await optimizer.optimizeOrder(tenBlinds);
            const r = results.get('Textstyle - Focus - White')!;
            const totalPlaced = r.sheets.reduce((sum, s) => sum + s.panels.length, 0);
            expect(totalPlaced).toBe(10);
        });
    });

    // ---------------------------------------------------------------
    // Multi-fabric grouping
    // ---------------------------------------------------------------
    describe('multi-fabric grouping', () => {
        test('separates different fabrics', async () => {
            const mixed = [
                ...sevenBlinds.slice(0, 3),
                {
                    ...sevenBlinds[3],
                    material: 'Gracetech',
                    fabricType: 'Vista',
                    fabricColour: 'Grey',
                },
                {
                    ...sevenBlinds[4],
                    material: 'Gracetech',
                    fabricType: 'Vista',
                    fabricColour: 'Grey',
                },
            ];

            const results = await optimizer.optimizeOrder(mixed);
            expect(results.size).toBe(2);
            expect(results.has('Textstyle - Focus - White')).toBe(true);
            expect(results.has('Gracetech - Vista - Grey')).toBe(true);
        });
    });

    // ---------------------------------------------------------------
    // Large order stress test
    // ---------------------------------------------------------------
    describe('performance', () => {
        test('handles 50 blinds in < 5 seconds', async () => {
            const items = Array.from({ length: 50 }, (_, i) =>
                makeItem(i + 1, 800 + Math.floor(Math.random() * 2200), 600 + Math.floor(Math.random() * 2400), `Room ${i + 1}`)
            );

            const start = Date.now();
            const results = await optimizer.optimizeOrder(items);
            const elapsed = Date.now() - start;

            console.log(`  50-blind time: ${elapsed}ms`);
            expect(elapsed).toBeLessThan(5000);

            const r = results.get('Textstyle - Focus - White')!;
            console.log(`  50-blind: ${r.sheets.length} sheets, ${r.efficiency.toFixed(2)}% eff`);
            expect(r.statistics.totalPanels).toBe(50);
        });
    });
});
