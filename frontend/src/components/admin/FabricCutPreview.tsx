import { useState } from 'react';
import { Sheet } from '../../types/order';

interface FabricCutPreviewProps {
    fabricKey: string;
    sheets: Sheet[];
    efficiency: number;
    totalFabricNeeded: number;
    wastePercentage: number;
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

const MAX_PREVIEW_WIDTH = 800; // px
const MAX_PREVIEW_HEIGHT = 600; // px

/**
 * Visual cutting layout preview with SVG rendering
 * Uses auto-scaling to fit within container, shows guillotine cut lines
 */
export default function FabricCutPreview({
    fabricKey,
    sheets,
    efficiency,
    totalFabricNeeded,
    wastePercentage
}: FabricCutPreviewProps) {
    const [showCuttingMarks, setShowCuttingMarks] = useState(false);

    const getColor = (index: number) => {
        return PANEL_COLORS[index % PANEL_COLORS.length];
    };

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
                                {efficiency.toFixed(2)}% Efficiency
                            </span>
                            <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-md font-medium">
                                {(totalFabricNeeded / 1000).toFixed(2)}m Fabric
                            </span>
                            <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-md font-medium">
                                {wastePercentage.toFixed(2)}% Waste
                            </span>
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

            {/* Sheets visualization — HORIZONTAL LAYOUT */}
            <div className="flex gap-8 overflow-x-auto pb-4 p-5 bg-gray-50 rounded-lg">
                {sheets.map((sheet, sheetIndex) => {
                    // Auto-scale: fit within MAX_PREVIEW_WIDTH x MAX_PREVIEW_HEIGHT
                    const sheetLength = sheet.length || 1;
                    const scaleX = MAX_PREVIEW_WIDTH / sheet.width;
                    const scaleY = MAX_PREVIEW_HEIGHT / sheetLength;
                    const scale = Math.min(scaleX, scaleY);

                    const svgWidth = sheet.width * scale;
                    const svgHeight = sheetLength * scale;

                    // Calculate waste rectangle
                    const maxUsedHeight = sheet.panels.length > 0
                        ? Math.max(...sheet.panels.map(p =>
                            p.y + (p.rotated ? p.width : p.length)
                        ))
                        : 0;

                    return (
                        <div key={sheet.id} className="flex-shrink-0 bg-white p-4 rounded-lg shadow-md">
                            <div className="text-center mb-3">
                                <h4 className="font-bold text-gray-800">Sheet {sheet.id}</h4>
                                <p className="text-xs text-gray-600">
                                    {sheet.width} &times; {sheetLength}mm &nbsp;|&nbsp;
                                    {sheet.panels.length} panels &nbsp;|&nbsp;
                                    {sheet.efficiency.toFixed(1)}% eff.
                                </p>
                            </div>

                            {/* SVG Canvas */}
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
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="8"
                                            stroke="#999"
                                            strokeWidth="1.5"
                                        />
                                    </pattern>
                                </defs>

                                {/* Waste area (stripe pattern at bottom) */}
                                {maxUsedHeight < sheetLength && (
                                    <rect
                                        x={0}
                                        y={maxUsedHeight * scale}
                                        width={sheet.width * scale}
                                        height={(sheetLength - maxUsedHeight) * scale}
                                        fill={`url(#stripe-${sheetIndex})`}
                                        opacity="0.4"
                                    />
                                )}

                                {/* Panels */}
                                {sheet.panels.map((panel, panelIndex) => {
                                    const panelWidth = (panel.rotated ? panel.length : panel.width) * scale;
                                    const panelHeight = (panel.rotated ? panel.width : panel.length) * scale;
                                    const px = panel.x * scale;
                                    const py = panel.y * scale;

                                    return (
                                        <g key={panel.id}>
                                            {/* Panel rectangle */}
                                            <rect
                                                x={px}
                                                y={py}
                                                width={panelWidth}
                                                height={panelHeight}
                                                fill={getColor(panelIndex)}
                                                stroke="#000"
                                                strokeWidth="1.5"
                                            />

                                            {/* Panel number and rotation indicator */}
                                            <text
                                                x={px + panelWidth / 2}
                                                y={py + panelHeight / 2}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize={Math.min(16, panelWidth * 0.4, panelHeight * 0.3)}
                                                fontWeight="bold"
                                                fill="#000"
                                            >
                                                {panelIndex + 1}{panel.rotated && '*'}
                                            </text>

                                            {/* Dimension labels inside panels (when large enough) */}
                                            {panelWidth > 50 && panelHeight > 40 && (
                                                <text
                                                    x={px + panelWidth / 2}
                                                    y={py + panelHeight / 2 + 14}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fontSize="8"
                                                    fill="#333"
                                                >
                                                    {panel.rotated ? panel.length : panel.width}&times;{panel.rotated ? panel.width : panel.length}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}

                                {/* Guillotine cutting marks (from cutSequence) */}
                                {showCuttingMarks && sheet.cutSequence && sheet.cutSequence.map((cut, cutIndex) => {
                                    if (cut.type === 'horizontal') {
                                        const y = cut.y1 * scale;
                                        return (
                                            <g key={`cut-h-${cutIndex}`}>
                                                <line
                                                    x1={0}
                                                    y1={y}
                                                    x2={svgWidth}
                                                    y2={y}
                                                    stroke="red"
                                                    strokeWidth="2"
                                                    strokeDasharray="6,3"
                                                />
                                                <text
                                                    x={svgWidth - 5}
                                                    y={y - 4}
                                                    fill="red"
                                                    fontSize="10"
                                                    fontWeight="bold"
                                                    textAnchor="end"
                                                >
                                                    {cut.label}
                                                </text>
                                            </g>
                                        );
                                    } else {
                                        const x = cut.x1 * scale;
                                        return (
                                            <g key={`cut-v-${cutIndex}`}>
                                                <line
                                                    x1={x}
                                                    y1={0}
                                                    x2={x}
                                                    y2={svgHeight}
                                                    stroke="red"
                                                    strokeWidth="2"
                                                    strokeDasharray="6,3"
                                                />
                                                <text
                                                    x={x + 4}
                                                    y={12}
                                                    fill="red"
                                                    fontSize="10"
                                                    fontWeight="bold"
                                                >
                                                    {cut.label}
                                                </text>
                                            </g>
                                        );
                                    }
                                })}

                                {/* Sheet border */}
                                <rect
                                    x="0"
                                    y="0"
                                    width={svgWidth}
                                    height={svgHeight}
                                    fill="none"
                                    stroke="#000"
                                    strokeWidth="3"
                                />
                            </svg>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm text-gray-600 flex flex-wrap gap-4 items-center">
                <span className="font-semibold">Legend:</span>
                <span>Panel numbers inside rectangles</span>
                <span>* = Rotated 90&deg;</span>
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
        </div>
    );
}
