import { useState } from 'react';
import { Sheet, GenerationStats, GeneticValidation } from '../../types/order';

interface FabricCutPreviewProps {
    fabricKey: string;
    sheets: Sheet[];
    efficiency: number;
    totalFabricNeeded: number;
    wastePercentage: number;
    // Genetic algorithm metadata
    generationStats?: GenerationStats;
    validation?: GeneticValidation;
    isGuillotineValid?: boolean;
    strategy?: string;
}

// Color palette for panels (NO RED — red is reserved for cutting marks)
const PANEL_COLORS = [
    '#4A90E2', // blue
    '#50C878', // green
    '#FFD700', // yellow
    '#FF8C42', // orange
    '#9B59B6', // purple
    '#8B6914', // dark gold
    '#A9A9A9', // gray
    '#FFB6C1', // pink
];

/**
 * Visual cutting layout preview with SVG rendering.
 * Displays in LANDSCAPE orientation (fabric length horizontal, roll width vertical)
 * matching CutLogic's display format.
 *
 * Data arrives in portrait format (width=3000, length=fabricLength).
 * We rotate 90° at render time: GA Y → display X, GA X → display Y.
 */
export default function FabricCutPreview({
    fabricKey,
    sheets,
    efficiency,
    totalFabricNeeded,
    wastePercentage,
    generationStats,
    validation,
    isGuillotineValid,
    strategy,
}: FabricCutPreviewProps) {
    const [showCuttingMarks, setShowCuttingMarks] = useState(false);

    const getColor = (index: number) => PANEL_COLORS[index % PANEL_COLORS.length];

    return (
        <div className="fabric-cut-preview mb-8">
            {/* Header */}
            <div className="bg-white border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{fabricKey}</h3>
                        <div className="flex gap-3 mt-2 text-sm flex-wrap">
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md font-medium">
                                {sheets.length} Sheet{sheets.length !== 1 ? 's' : ''}
                            </span>
                            <span className="px-3 py-1 bg-green-50 text-green-700 rounded-md font-medium">
                                {efficiency.toFixed(1)}% Efficiency
                            </span>
                            <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-md font-medium">
                                {(totalFabricNeeded / 1000).toFixed(2)}m Fabric
                            </span>
                            <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-md font-medium">
                                {wastePercentage.toFixed(1)}% Waste
                            </span>
                            {isGuillotineValid !== undefined && (
                                <span className={`px-3 py-1 rounded-md font-medium ${
                                    isGuillotineValid
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-red-50 text-red-700'
                                }`}>
                                    {isGuillotineValid ? 'Guillotine Valid' : 'Non-guillotine'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Toggle cutting marks button */}
                    <button
                        onClick={() => setShowCuttingMarks(!showCuttingMarks)}
                        className={`px-4 py-2 rounded-md font-semibold border-2 transition-all ${
                            showCuttingMarks
                                ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                                : 'bg-white text-green-600 border-green-500 hover:bg-green-50'
                        }`}
                    >
                        {showCuttingMarks ? 'Hide Cutting Marks' : 'View Cutting Marks'}
                    </button>
                </div>
            </div>

            {/* Sheets visualization — LANDSCAPE LAYOUT */}
            <div className="space-y-6 p-5 bg-gray-50 rounded-lg overflow-x-auto">
                {sheets.map((sheet, sheetIndex) => {
                    // Landscape: fabric length → horizontal, roll width (3000mm) → vertical
                    // Data is portrait (width=3000, length=fabricLength), we rotate for display
                    const fabricLength = sheet.length || 1;
                    const rollWidth = sheet.width; // 3000mm

                    // Scale: fit to container width (~800px), ensure minimum height (200px)
                    const CONTAINER_WIDTH = 800;
                    const MIN_HEIGHT = 200;
                    const MAX_HEIGHT = 400;

                    const scaleFromWidth = CONTAINER_WIDTH / fabricLength;
                    const minScale = MIN_HEIGHT / rollWidth;
                    const maxScale = MAX_HEIGHT / rollWidth;
                    const scale = Math.min(Math.max(scaleFromWidth, minScale), maxScale);

                    const svgWidth = fabricLength * scale;
                    const svgHeight = rollWidth * scale;

                    return (
                        <div key={sheet.id} className="bg-white p-4 rounded-lg shadow-md">
                            {/* Sheet header */}
                            <div className="text-center mb-3">
                                <h4 className="font-bold text-gray-800">
                                    Layout {sheet.id} &mdash; {fabricLength.toLocaleString()} mm &times; {rollWidth.toLocaleString()} mm
                                </h4>
                                <p className="text-xs text-gray-600">
                                    {sheet.panels.length} panels &nbsp;|&nbsp;
                                    {sheet.efficiency.toFixed(1)}% eff. &nbsp;|&nbsp;
                                    1 &times;
                                </p>
                            </div>

                            {/* SVG Canvas — landscape */}
                            <svg
                                width={svgWidth}
                                height={svgHeight}
                                className="border-2 border-gray-800 bg-white rounded"
                            >
                                {/* Stripe pattern for waste areas */}
                                <defs>
                                    <pattern
                                        id={`stripe-${sheetIndex}`}
                                        patternUnits="userSpaceOnUse"
                                        width="8"
                                        height="8"
                                        patternTransform="rotate(45)"
                                    >
                                        <line
                                            x1="0" y1="0" x2="0" y2="8"
                                            stroke="#999" strokeWidth="1.5"
                                        />
                                    </pattern>
                                </defs>

                                {/* Full sheet background with stripe pattern (waste visible in gaps) */}
                                <rect
                                    x={0} y={0}
                                    width={svgWidth} height={svgHeight}
                                    fill={`url(#stripe-${sheetIndex})`}
                                    opacity="0.3"
                                />

                                {/* Panels — rotated 90° from portrait data:
                                    display X = panel.y (GA's fabric-length axis)
                                    display Y = panel.x (GA's roll-width axis)
                                    display W = GA's y-span (rotated ? panel.width : panel.length)
                                    display H = GA's x-span (rotated ? panel.length : panel.width)
                                */}
                                {sheet.panels.map((panel, panelIndex) => {
                                    // Landscape transform: swap axes
                                    const displayW = (panel.rotated ? panel.width : panel.length) * scale;
                                    const displayH = (panel.rotated ? panel.length : panel.width) * scale;
                                    const px = panel.y * scale;
                                    const py = panel.x * scale;

                                    return (
                                        <g key={panel.id}>
                                            {/* Panel rectangle */}
                                            <rect
                                                x={px} y={py}
                                                width={displayW} height={displayH}
                                                fill={getColor(panelIndex)}
                                                stroke="#000"
                                                strokeWidth="1.5"
                                            />

                                            {/* Panel number + rotation indicator */}
                                            <text
                                                x={px + displayW / 2}
                                                y={py + displayH / 2}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize={Math.min(16, displayW * 0.3, displayH * 0.3)}
                                                fontWeight="bold"
                                                fill="#000"
                                            >
                                                {panel.blindNumber ?? (panelIndex + 1)}
                                            </text>

                                            {/* Dimension labels inside panels (when large enough) */}
                                            {displayW > 50 && displayH > 40 && (
                                                <text
                                                    x={px + displayW / 2}
                                                    y={py + displayH / 2 + 14}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fontSize="8"
                                                    fill="#333"
                                                >
                                                    {panel.width}&times;{panel.length}
                                                </text>
                                            )}

                                            {/* Edge dimension labels (top edge: horizontal extent) */}
                                            {panel.y === 0 && (
                                                <text
                                                    x={px + displayW / 2}
                                                    y={py - 4}
                                                    textAnchor="middle"
                                                    fontSize="7"
                                                    fontWeight="bold"
                                                    fill="#CC0000"
                                                >
                                                    {Math.round(panel.rotated ? panel.width : panel.length).toLocaleString()} mm
                                                </text>
                                            )}

                                            {/* Left edge: vertical extent */}
                                            {panel.x === 0 && (
                                                <text
                                                    x={px - 4}
                                                    y={py + displayH / 2}
                                                    textAnchor="end"
                                                    dominantBaseline="middle"
                                                    fontSize="7"
                                                    fontWeight="bold"
                                                    fill="#CC0000"
                                                    transform={`rotate(-90, ${px - 4}, ${py + displayH / 2})`}
                                                >
                                                    {Math.round(panel.rotated ? panel.length : panel.width).toLocaleString()} mm
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}

                                {/* Cutting marks (toggled via button — NOT shown by default) */}
                                {showCuttingMarks && sheet.cutSequence && sheet.cutSequence.map((cut, cutIndex) => {
                                    // Rotate cut lines 90°:
                                    //   GA "horizontal" cut (y=const) → display VERTICAL line at x=cut.y1
                                    //   GA "vertical" cut (x=const) → display HORIZONTAL line at y=cut.x1
                                    if (cut.type === 'horizontal') {
                                        const x = cut.y1 * scale;
                                        return (
                                            <g key={`cut-h-${cutIndex}`}>
                                                <line
                                                    x1={x} y1={0} x2={x} y2={svgHeight}
                                                    stroke="red" strokeWidth="2" strokeDasharray="6,3"
                                                />
                                                <text
                                                    x={x + 4} y={12}
                                                    fill="red" fontSize="10" fontWeight="bold"
                                                >
                                                    {cut.label}
                                                </text>
                                            </g>
                                        );
                                    } else {
                                        const y = cut.x1 * scale;
                                        return (
                                            <g key={`cut-v-${cutIndex}`}>
                                                <line
                                                    x1={0} y1={y} x2={svgWidth} y2={y}
                                                    stroke="red" strokeWidth="2" strokeDasharray="6,3"
                                                />
                                                <text
                                                    x={svgWidth - 5} y={y - 4}
                                                    fill="red" fontSize="10" fontWeight="bold" textAnchor="end"
                                                >
                                                    {cut.label}
                                                </text>
                                            </g>
                                        );
                                    }
                                })}

                                {/* Sheet border */}
                                <rect
                                    x="0" y="0"
                                    width={svgWidth} height={svgHeight}
                                    fill="none" stroke="#000" strokeWidth="3"
                                />
                            </svg>

                            {/* Right-side stats (below SVG in landscape) */}
                            <div className="flex gap-6 mt-2 text-xs text-gray-500">
                                <span>Cut {sheetIndex + 1} of {sheets.length}</span>
                                <span>{fabricLength.toLocaleString()} mm</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend + GA Strategy Info */}
            <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm text-gray-600 flex flex-wrap gap-4 items-center">
                <span className="font-semibold">Legend:</span>
                <span>Panel numbers inside rectangles</span>
                <span className="flex items-center gap-1">
                    <svg className="inline" width="20" height="14" style={{ verticalAlign: 'middle' }}>
                        <rect width="20" height="14" fill="url(#stripe-legend)" />
                        <defs>
                            <pattern id="stripe-legend" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                                <line x1="0" y1="0" x2="0" y2="8" stroke="#999" strokeWidth="1.5" />
                            </pattern>
                        </defs>
                    </svg>
                    = Waste area
                </span>
                <span className="flex items-center gap-1">
                    <svg className="inline" width="20" height="3" style={{ verticalAlign: 'middle' }}>
                        <line x1="0" y1="1.5" x2="20" y2="1.5" stroke="red" strokeWidth="2" strokeDasharray="4,2" />
                    </svg>
                    = Cutting marks
                </span>
            </div>

            {/* Genetic Algorithm metadata */}
            {(strategy || generationStats) && (
                <div className="mt-2 px-3 py-2 bg-gray-50 rounded-md text-xs text-gray-500 flex flex-wrap gap-4 items-center">
                    {strategy && <span>{strategy}</span>}
                    {generationStats && (
                        <>
                            <span>Seeds: {generationStats.seedsTested}</span>
                            <span>Best gen: {generationStats.bestGeneration}/{generationStats.totalGenerations}</span>
                            <span>{generationStats.convergenceTime}ms</span>
                        </>
                    )}
                    {validation && validation.guillotineStages > 0 && (
                        <span>Guillotine stages: {validation.guillotineStages}</span>
                    )}
                </div>
            )}
        </div>
    );
}
