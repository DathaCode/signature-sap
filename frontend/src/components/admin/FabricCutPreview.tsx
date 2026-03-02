import { useState } from 'react';
import { Sheet } from '../../types/order';

interface FabricCutPreviewProps {
    fabricKey: string;
    sheets: Sheet[];
    efficiency: number;
    totalFabricNeeded: number;
    wastePercentage: number;
}

/**
 * Visual cutting layout preview with SVG rendering
 * Similar to CutLogic 2D output
 */
export default function FabricCutPreview({
    fabricKey,
    sheets,
    efficiency,
    totalFabricNeeded,
    wastePercentage
}: FabricCutPreviewProps) {
    const [showCuttingMarks, setShowCuttingMarks] = useState(false);

    // Color palette for panels (pastel colors for better visibility)
    const PANEL_COLORS = [
        '#FFB3BA', // Light pink
        '#BAFFC9', // Light green
        '#BAE1FF', // Light blue
        '#FFFFBA', // Light yellow
        '#FFD4BA', // Light orange
        '#E0BBE4', // Light purple
        '#FFDFD3', // Peach
        '#C7CEEA', // Periwinkle
    ];

    // Scale factor to fit on screen (1mm = 0.06px for better visibility)
    const SCALE = 0.06;

    const getRandomColor = (index: number) => {
        return PANEL_COLORS[index % PANEL_COLORS.length];
    };

    /**
     * Calculate waste rectangles for visualization
     * Simplified: waste is the area from max panel height to sheet length
     */
    const getWasteRectangles = (sheet: Sheet): Array<{x: number; y: number; width: number; height: number}> => {
        if (sheet.panels.length === 0) {
            return [{
                x: 0,
                y: 0,
                width: sheet.width,
                height: sheet.length
            }];
        }

        // Find the maximum Y + height across all panels
        const maxUsedHeight = Math.max(...sheet.panels.map(p =>
            p.y + (p.rotated ? p.width : p.length)
        ));

        // If there's unused space at the bottom, show it as waste
        if (maxUsedHeight < sheet.length) {
            return [{
                x: 0,
                y: maxUsedHeight,
                width: sheet.width,
                height: sheet.length - maxUsedHeight
            }];
        }

        return [];
    };

    return (
        <div className="fabric-cut-preview mb-8">
            {/* Header */}
            <div className="bg-white border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{fabricKey}</h3>
                        <div className="flex gap-4 mt-2 text-sm">
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
                        className={`px-4 py-2 rounded-md font-medium transition-colors ${
                            showCuttingMarks
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        {showCuttingMarks ? '🔴 Hide Cutting Marks' : '⚪ Show Cutting Marks'}
                    </button>
                </div>
            </div>

            {/* Sheets visualization - HORIZONTAL LAYOUT */}
            <div className="flex gap-6 overflow-x-auto pb-4">
                {sheets.map((sheet, sheetIndex) => {
                    const wasteRects = getWasteRectangles(sheet);

                    return (
                        <div key={sheet.id} className="flex-shrink-0">
                            <div className="text-center mb-2">
                                <h4 className="font-bold text-gray-800">Sheet {sheet.id}</h4>
                                <p className="text-xs text-gray-600">
                                    {sheet.width} × {sheet.length}mm | {sheet.panels.length} panels | {sheet.efficiency.toFixed(1)}% eff.
                                </p>
                            </div>

                            {/* SVG Canvas */}
                            <svg
                                width={sheet.width * SCALE}
                                height={sheet.length * SCALE}
                                className="border-2 border-gray-800 bg-white shadow-lg"
                                style={{ maxHeight: '600px' }}
                            >
                                {/* Stripe pattern for waste areas */}
                                <defs>
                                    <pattern
                                        id={`stripe-${sheetIndex}`}
                                        patternUnits="userSpaceOnUse"
                                        width="10"
                                        height="10"
                                        patternTransform="rotate(45)"
                                    >
                                        <line
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="10"
                                            stroke="#999"
                                            strokeWidth="2"
                                        />
                                    </pattern>
                                </defs>

                                {/* Waste areas (striped pattern) */}
                                {wasteRects.map((waste, i) => (
                                    <rect
                                        key={`waste-${i}`}
                                        x={waste.x * SCALE}
                                        y={waste.y * SCALE}
                                        width={waste.width * SCALE}
                                        height={waste.height * SCALE}
                                        fill={`url(#stripe-${sheetIndex})`}
                                        opacity="0.4"
                                    />
                                ))}

                                {/* Panels */}
                                {sheet.panels.map((panel, panelIndex) => {
                                    const panelWidth = panel.rotated ? panel.length : panel.width;
                                    const panelHeight = panel.rotated ? panel.width : panel.length;

                                    return (
                                        <g key={panel.id}>
                                            {/* Panel rectangle */}
                                            <rect
                                                x={panel.x * SCALE}
                                                y={panel.y * SCALE}
                                                width={panelWidth * SCALE}
                                                height={panelHeight * SCALE}
                                                fill={getRandomColor(panelIndex)}
                                                stroke="#000"
                                                strokeWidth="1.5"
                                            />

                                            {/* Panel number and rotation indicator */}
                                            <text
                                                x={(panel.x + panelWidth / 2) * SCALE}
                                                y={(panel.y + panelHeight / 2) * SCALE}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize="16"
                                                fontWeight="bold"
                                                fill="#000"
                                            >
                                                {panelIndex + 1}{panel.rotated && '*'}
                                            </text>

                                            {/* Cutting marks (if enabled) */}
                                            {showCuttingMarks && (
                                                <>
                                                    {/* Top horizontal line */}
                                                    <line
                                                        x1={panel.x * SCALE}
                                                        y1={panel.y * SCALE}
                                                        x2={(panel.x + panelWidth) * SCALE}
                                                        y2={panel.y * SCALE}
                                                        stroke="red"
                                                        strokeWidth="2"
                                                        strokeDasharray="5,3"
                                                    />

                                                    {/* Left vertical line */}
                                                    <line
                                                        x1={panel.x * SCALE}
                                                        y1={panel.y * SCALE}
                                                        x2={panel.x * SCALE}
                                                        y2={(panel.y + panelHeight) * SCALE}
                                                        stroke="red"
                                                        strokeWidth="2"
                                                        strokeDasharray="5,3"
                                                    />

                                                    {/* Dimension text on outer edges */}
                                                    {panel.x === 0 && (
                                                        <text
                                                            x={5}
                                                            y={(panel.y + panelHeight / 2) * SCALE}
                                                            fill="red"
                                                            fontSize="11"
                                                            fontWeight="bold"
                                                        >
                                                            {panelHeight}
                                                        </text>
                                                    )}

                                                    {panel.y === 0 && (
                                                        <text
                                                            x={(panel.x + panelWidth / 2) * SCALE}
                                                            y={14}
                                                            fill="red"
                                                            fontSize="11"
                                                            fontWeight="bold"
                                                            textAnchor="middle"
                                                        >
                                                            {panelWidth}
                                                        </text>
                                                    )}
                                                </>
                                            )}
                                        </g>
                                    );
                                })}

                                {/* Sheet border */}
                                <rect
                                    x="0"
                                    y="0"
                                    width={sheet.width * SCALE}
                                    height={sheet.length * SCALE}
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
            <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm text-gray-600">
                <span className="font-semibold">Legend:</span>
                <span className="ml-4">Panel numbers shown inside rectangles</span>
                <span className="ml-4">* = Rotated 90°</span>
                <span className="ml-4">
                    <svg className="inline" width="20" height="14" style={{ verticalAlign: 'middle' }}>
                        <rect width="20" height="14" fill="url(#stripe-legend)" />
                        <defs>
                            <pattern id="stripe-legend" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                                <line x1="0" y1="0" x2="0" y2="10" stroke="#999" strokeWidth="2" />
                            </pattern>
                        </defs>
                    </svg>
                    = Waste area
                </span>
            </div>
        </div>
    );
}
