import { useState } from 'react';
import { FabricGroupData } from '../../types/order';
import FabricCutPreview from './FabricCutPreview';
import { LayoutGrid, Table } from 'lucide-react';

/**
 * Determine chain size (mm) from total drop (Calc D = original drop + 200)
 */
function getChainSize(calcDrop: number): number {
    if (calcDrop <= 850) return 500;
    if (calcDrop <= 1100) return 750;
    if (calcDrop <= 1600) return 1000;
    if (calcDrop <= 2200) return 1200;
    return 1500;
}

interface Props {
    fabricCutData: Record<string, FabricGroupData>;
}

export default function FabricCutWorksheet({ fabricCutData }: Props) {
    const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');

    return (
        <div className="space-y-6">
            {/* View Mode Toggle */}
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
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Blind #</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Location</th>
                                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">Fab Cut W</th>
                                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">Calc D</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Ctrl</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Ctrl Col</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Chain/Motor</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Roll</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Fabric</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Colour</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">BR Colour</th>
                                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">Chain Size</th>
                                        <th className="px-2 py-1.5 text-center font-medium text-gray-600">Rot</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupData.optimization.sheets.map(sheet =>
                                        sheet.panels.map((panel, idx) => {
                                            const item = groupData.items.find(
                                                (it: any) => it.id === panel.orderItemId
                                            );
                                            const fabricCutW = item?.fabricCutWidth ?? (item ? item.width - 28 : '-');
                                            const calcD = item ? item.drop + 200 : 0;
                                            const chainSize = calcD > 0 ? getChainSize(calcD) : '-';
                                            return (
                                                <tr key={`${sheet.id}-${idx}`} className="border-b hover:bg-gray-50">
                                                    <td className="px-2 py-1.5 font-semibold">{panel.blindNumber ?? (idx + 1)}</td>
                                                    <td className="px-2 py-1.5 font-medium">{item?.location || panel.location || panel.label}</td>
                                                    <td className="px-2 py-1.5 text-right font-semibold text-blue-700">
                                                        {fabricCutW}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        {calcD > 0 ? calcD : '-'}
                                                    </td>
                                                    <td className="px-2 py-1.5">{item?.controlSide || '-'}</td>
                                                    <td className="px-2 py-1.5">{item?.bracketColour || '-'}</td>
                                                    <td className="px-2 py-1.5 truncate max-w-[80px]">
                                                        {(item?.chainOrMotor || '-').replace(/_/g, ' ')}
                                                    </td>
                                                    <td className="px-2 py-1.5">{item?.roll || '-'}</td>
                                                    <td className="px-2 py-1.5">{item?.fabricType || '-'}</td>
                                                    <td className="px-2 py-1.5">{item?.fabricColour || '-'}</td>
                                                    <td className="px-2 py-1.5">{item?.bottomRailColour || '-'}</td>
                                                    <td className="px-2 py-1.5 text-right">{chainSize}mm</td>
                                                    <td className="px-2 py-1.5 text-center">{panel.rotated ? '*' : ''}</td>
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
