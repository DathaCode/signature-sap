/**
 * Simple test runner for optimizer services (no jest dependency needed)
 * Run: npx tsx src/services/__tests__/runTests.ts
 */

import { CutlistOptimizer, PanelInput } from '../cutlistOptimizer.service';
import { TubeCutOptimizer, TubeBlindInput } from '../tubeCutOptimizer.service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
        console.log(`  PASS: ${testName}`);
        passed++;
    } else {
        console.log(`  FAIL: ${testName}${detail ? ' - ' + detail : ''}`);
        failed++;
    }
}

function assertClose(actual: number, expected: number, tolerance: number, testName: string) {
    assert(Math.abs(actual - expected) <= tolerance, testName, `Expected ~${expected}, got ${actual}`);
}

// ============= CUTLIST OPTIMIZER TESTS =============
console.log('\n=== CutlistOptimizer Tests ===\n');

{
    const optimizer = new CutlistOptimizer({ stockWidth: 3000, stockLength: 10000 });

    // Test 1: Single blind
    const r1 = optimizer.optimize([{ width: 1472, length: 2250, qty: 1, label: 'Single' }]);
    assert(r1.sheets.length === 1, 'Single blind: 1 sheet');
    assert(r1.statistics.totalPanels === 1, 'Single blind: 1 panel');
    assert(r1.sheets[0].panels[0].x === 0 && r1.sheets[0].panels[0].y === 0, 'Single blind: placed at origin');

    // Test 2: Multiple identical
    const r2 = optimizer.optimize([{ width: 1472, length: 2250, qty: 3, label: 'Same' }]);
    assert(r2.statistics.totalPanels === 3, 'Multiple identical: 3 panels placed');
    assert(r2.sheets.length <= 2, 'Multiple identical: fits in <= 2 sheets');

    // Test 3: Mixed sizes sorted by area
    const r3 = optimizer.optimize([
        { width: 500, length: 500, qty: 1, label: 'Small' },
        { width: 2000, length: 2000, qty: 1, label: 'Large' },
        { width: 1000, length: 1000, qty: 1, label: 'Medium' },
    ]);
    assert(r3.statistics.totalPanels === 3, 'Mixed sizes: all 3 placed');
    const firstArea = r3.sheets[0].panels[0].width * r3.sheets[0].panels[0].length;
    const secondArea = r3.sheets[0].panels[1].width * r3.sheets[0].panels[1].length;
    assert(firstArea >= secondArea, 'Mixed sizes: largest placed first');

    // Test 4: Panel too large (wider than stock AND longer when rotated)
    const r4 = optimizer.optimize([{ width: 3500, length: 3500, qty: 1, label: 'Too wide both ways' }]);
    assert(r4.statistics.totalCuts === 0, 'Too large panel: gracefully skipped');

    // Test 4b: Panel wider than stock but rotatable
    const r4b = optimizer.optimize([{ width: 3500, length: 2000, qty: 1, label: 'Rotatable' }]);
    assert(r4b.statistics.totalCuts === 1, 'Rotatable panel: placed via rotation');
    assert(r4b.sheets[0].panels[0].rotated === true, 'Rotatable panel: marked as rotated');

    // Test 5: Statistics accuracy
    const r5 = optimizer.optimize([{ width: 1000, length: 1000, qty: 4, label: 'Square' }]);
    assert(r5.statistics.totalUsedArea === 4000000, 'Statistics: used area = 4,000,000');
    assert(r5.statistics.wastePercentage + r5.statistics.efficiency === 100, 'Statistics: waste + efficiency = 100%');

    // Test 6: Fabric needed
    const r6 = optimizer.optimize([{ width: 2900, length: 9900, qty: 2, label: 'Nearly full' }]);
    assert(r6.statistics.totalFabricNeeded === r6.sheets.length * 10000,
        `Fabric needed = sheets(${r6.sheets.length}) * 10000 = ${r6.statistics.totalFabricNeeded}`);

    // Test 7: Dynamic stock length
    const shortOpt = new CutlistOptimizer({ stockWidth: 3000, stockLength: 5000 });
    const r7 = shortOpt.optimize([{ width: 1472, length: 2250, qty: 3, label: 'Short' }]);
    assert(r7.statistics.totalFabricNeeded === r7.sheets.length * 5000, 'Dynamic stock length: correct fabric needed');

    // Test 8: Cut list entries
    const r8 = optimizer.optimize([{ width: 1000, length: 2000, qty: 2, label: 'Cuts' }]);
    assert(r8.cuts.length === 2, 'Cut list: 2 entries');
    assert(r8.cuts[0].cutNumber === 1 && r8.cuts[1].cutNumber === 2, 'Cut list: numbered correctly');

    // Test 9: Large order
    const r9 = optimizer.optimize([
        { width: 1472, length: 2250, qty: 5, label: 'A' },
        { width: 972, length: 1950, qty: 5, label: 'B' },
        { width: 1972, length: 2550, qty: 3, label: 'C' },
    ]);
    assert(r9.statistics.totalPanels === 13, 'Large order: 13 panels');
    assert(r9.statistics.efficiency > 0, `Large order: efficiency ${r9.statistics.efficiency}%`);

    // Test 10: Rotation check
    const r10 = optimizer.optimize([
        { width: 1500, length: 2800, qty: 1, label: 'Tall' },
        { width: 1500, length: 2800, qty: 1, label: 'Tall 2' },
    ]);
    assert(r10.statistics.totalPanels === 2, 'Rotation: both panels placed');
    // Check if any panel was rotated
    const anyRotated = r10.sheets.some(s => s.panels.some(p => p.rotated));
    console.log(`  INFO: Rotation used: ${anyRotated}`);
}

// ============= TUBE CUT OPTIMIZER TESTS =============
console.log('\n=== TubeCutOptimizer Tests ===\n');

{
    const tubeOpt = new TubeCutOptimizer();

    // Test 1: Small total < 1 piece
    const t1 = tubeOpt.optimize([
        { location: 'Room A', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        { location: 'Room B', originalWidth: 2200, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
    ]);
    assert(t1.groups[0].totalWidth === 3700, 'Small total: totalWidth = 3700');
    assert(t1.groups[0].piecesToDeduct === 1, 'Small total: 1 piece needed');

    // Test 2: Exact multiple with wastage
    const t2 = tubeOpt.optimize([
        { location: 'Room 1', originalWidth: 5800, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
    ]);
    assertClose(t2.groups[0].baseQuantity, 1.0, 0.01, 'Exact: base qty = 1.0');
    assert(t2.groups[0].piecesToDeduct === 2, 'Exact: 2 pieces (1 + 10% wastage → ceil)');

    // Test 3: Documented example
    const t3 = tubeOpt.optimize([
        { location: 'Living Room', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        { location: 'Bedroom 1', originalWidth: 2200, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        { location: 'Bedroom 2', originalWidth: 3400, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
    ]);
    assert(t3.groups[0].totalWidth === 7100, 'Doc example: totalWidth = 7100');
    assertClose(t3.groups[0].baseQuantity, 1.224, 0.01, 'Doc example: base qty ≈ 1.224');
    assert(t3.groups[0].piecesToDeduct === 2, 'Doc example: 2 pieces');

    // Test 4: Multiple groups
    const t4 = tubeOpt.optimize([
        { location: 'A', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
        { location: 'B', originalWidth: 2000, bottomRailType: 'D30', bottomRailColour: 'Black' },
        { location: 'C', originalWidth: 1800, bottomRailType: 'Oval', bottomRailColour: 'Anodised' },
    ]);
    assert(t4.groups.length === 3, 'Multiple groups: 3 groups');
    assert(t4.totalPiecesNeeded === 3, 'Multiple groups: 3 total pieces');

    // Test 5: Uses original width
    const t5 = tubeOpt.optimize([
        { location: 'Room 1', originalWidth: 1500, bottomRailType: 'D30', bottomRailColour: 'Anodised' },
    ]);
    assert(t5.groups[0].totalWidth === 1500, 'Uses original width (1500, not 1472)');

    // Test 6: Stock length constant
    assert(t5.groups[0].stockLength === 5800, 'Stock length = 5800mm');

    // Test 7: Large order
    const widths = [5000, 6000, 7000, 5500, 6500, 7500, 5200, 6200, 7200, 5800, 6800, 4000, 4500, 5000, 4685];
    const t7 = tubeOpt.optimize(widths.map((w, i) => ({
        location: `Room ${i + 1}`, originalWidth: w, bottomRailType: 'Oval', bottomRailColour: 'Black',
    })));
    const totalW = widths.reduce((a, b) => a + b, 0);
    assert(t7.groups[0].totalWidth === totalW, `Large order: total ${totalW}mm`);
    const expectedPcs = Math.ceil((totalW / 5800) * 1.1);
    assert(t7.groups[0].piecesToDeduct === expectedPcs, `Large order: ${expectedPcs} pieces`);
}

// ============= SUMMARY =============
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
