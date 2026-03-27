import { useState } from 'react';
import { FabricGroupData } from '../../types/order';
import FabricCutPreview from './FabricCutPreview';
import { LayoutGrid, Table, Printer, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * Determine chain size (mm) from total drop (Calc D = original drop + 200)
 * Matches backend worksheetExport.service.ts and inventory chain lengths
 */
/**
 * Motor-specific width deductions (must match backend MOTOR_DEDUCTIONS)
 */
const MOTOR_DEDUCTIONS: Record<string, number> = {
    'TBS winder-32mm': 32,
    'Acmeda winder-29mm': 29,
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

function getMotorDeduction(motorType: string | undefined): number {
    if (!motorType) return 28;
    return MOTOR_DEDUCTIONS[motorType] || 28;
}

function getChainSize(calcDrop: number): number {
    if (calcDrop <= 850) return 500;
    if (calcDrop <= 1200) return 900;
    if (calcDrop <= 1600) return 1200;
    if (calcDrop <= 2200) return 1500;
    return 2000;
}

interface Props {
    fabricCutData: Record<string, FabricGroupData>;
    onPrintLabels?: () => void;
    printingLabels?: boolean;
}

export default function FabricCutWorksheet({ fabricCutData, onPrintLabels, printingLabels }: Props) {
    const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');

    return (
        <div className="space-y-6">
            {/* View Mode Toggle + Print Labels */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('visual')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                            viewMode === 'visual'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-800'
                        }`}
                    >
                        <LayoutGrid className="h-4 w-4" />
                        Visual Layout
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                            viewMode === 'table'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-800'
                        }`}
                    >
                        <Table className="h-4 w-4" />
                        Table View
                    </button>
                </div>
                {onPrintLabels && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onPrintLabels}
                        disabled={printingLabels}
                        className="flex items-center gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50"
                    >
                        {printingLabels
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Printer className="h-3.5 w-3.5" />}
                        {printingLabels ? 'Generating...' : 'Print Labels'}
                    </Button>
                )}
            </div>

            {/* Visual Layout View */}
            {viewMode === 'visual' && (
                <div className="space-y-8">
                    {Object.entries(fabricCutData).map(([fabricKey, groupData]) => (
                        <FabricCutPreview
                            key={fabricKey}
                            fabricKey={fabricKey}
                            sheets={groupData.optimization.sheets}
                            efficiency={groupData.optimization.statistics.efficiency}
                            totalFabricNeeded={groupData.optimization.statistics.totalFabricNeeded}
                            wastePercentage={groupData.optimization.statistics.wastePercentage}
                            generationStats={groupData.optimization.generationStats}
                            validation={groupData.optimization.validation}
                            isGuillotineValid={groupData.optimization.isGuillotineValid}
                            strategy={groupData.optimization.strategy}
                        />
                    ))}
                </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
                <div className="space-y-6">
            {Object.entries(fabricCutData).map(([fabricKey, groupData]) => {
                return (
                    <div key={fabricKey} className="border rounded-lg overflow-hidden">
                        <div className="bg-blue-50 px-4 py-2 border-b">
                            <h3 className="font-semibold text-sm text-blue-800">{fabricKey}</h3>
                            <div className="flex gap-4 text-xs text-blue-600 mt-1">
                                <span>Sheets: {groupData.optimization.statistics.usedStockSheets}</span>
                                <span>Efficiency: {groupData.optimization.statistics.efficiency}%</span>
                                <span>Fabric Needed: {(groupData.optimization.statistics.totalFabricNeeded / 1000).toFixed(1)}m</span>
                                <span>Waste: {groupData.optimization.statistics.wastePercentage}%</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse border border-gray-300">
                                <thead>
                                    <tr className="bg-blue-50">
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">Blind #</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">Location</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-blue-900">Fab Cut W</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-blue-900">Calc D</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">Ctrl</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">Ctrl Col</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">Chain/Motor</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">Roll</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">Fabric</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">Colour</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">BR Colour</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-blue-900">Chain</th>
                                        <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-blue-900">Bracket Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupData.optimization.sheets.map(sheet =>
                                        [...sheet.panels].sort((a, b) => (a.blindNumber ?? 0) - (b.blindNumber ?? 0)).map((panel, idx) => {
                                            const item = groupData.items.find(
                                                (it: any) => it.id === panel.orderItemId
                                            );
                                            const fabricCutW = item?.fabricCutWidth ?? (item ? item.width - getMotorDeduction(item.chainOrMotor) : '-');
                                            const calcD = item ? item.drop + 200 : 0;
                                            const chainSize = calcD > 0 ? getChainSize(calcD) : '-';
                                            const bracketType = item?.bracketType || 'Single';
                                            const motorType = item?.chainOrMotor || '';
                                            const isBracketHighlighted = /dual/i.test(bracketType) || /extension/i.test(bracketType);
                                            const isMotorHighlighted = /motor/i.test(motorType);
                                            const rowBg = idx % 2 === 0 ? '' : 'bg-gray-50';
                                            return (
                                                <tr key={`${sheet.id}-${idx}`} className={`${rowBg} hover:bg-blue-50`}>
                                                    <td className="border border-gray-300 px-2 py-1.5 font-semibold">{panel.blindNumber ?? (idx + 1)}</td>
                                                    <td className="border border-gray-300 px-2 py-1.5 font-medium">{item?.location || panel.location || panel.label}</td>
                                                    <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-blue-700">{fabricCutW}</td>
                                                    <td className="border border-gray-300 px-2 py-1.5 text-right">{calcD > 0 ? calcD : '-'}</td>
                                                    <td className="border border-gray-300 px-2 py-1.5">{item?.controlSide || '-'}</td>
                                                    <td className="border border-gray-300 px-2 py-1.5">{item?.bracketColour || '-'}</td>
                                                    <td className={`border border-gray-300 px-2 py-1.5 max-w-[100px] truncate ${isMotorHighlighted ? 'bg-yellow-200 text-yellow-900 font-medium' : ''}`}>
                                                        {motorType.replace(/_/g, ' ') || '-'}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1.5">{item?.roll || '-'}</td>
                                                    <td className="border border-gray-300 px-2 py-1.5">{item?.fabricType || '-'}</td>
                                                    <td className="border border-gray-300 px-2 py-1.5">{item?.fabricColour || '-'}</td>
                                                    <td className="border border-gray-300 px-2 py-1.5">{item?.bottomRailColour || '-'}</td>
                                                    <td className="border border-gray-300 px-2 py-1.5 text-right">{chainSize !== '-' ? `${chainSize}mm` : '-'}</td>
                                                    <td className={`border border-gray-300 px-2 py-1.5 font-medium ${isBracketHighlighted ? 'bg-yellow-200 text-yellow-900' : ''}`}>
                                                        {bracketType}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
                </div>
            )}
        </div>
    );
}
