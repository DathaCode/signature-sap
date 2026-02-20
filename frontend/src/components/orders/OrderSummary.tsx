import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Pencil, Trash2, Save, FileText, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { BlindItem } from '../../types/order';
import { isWinderMotor } from '../../data/hardware';

interface OrderSummaryProps {
    blinds: BlindItem[];
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    onBackToForm: () => void;
    onSubmitOrder: () => void;
    onSaveAsQuote: () => void;
    isSubmitting: boolean;
    notes: string;
    onNotesChange: (notes: string) => void;
    customerReference?: string;
}

export default function OrderSummary({
    blinds,
    onEdit,
    onDelete,
    onBackToForm,
    onSubmitOrder,
    onSaveAsQuote,
    isSubmitting,
    notes,
    onNotesChange,
    customerReference,
}: OrderSummaryProps) {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    const toggleRow = (index: number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Review Your Order</h1>
                    <p className="text-gray-500 mt-1">
                        {blinds.length} blind{blinds.length !== 1 ? 's' : ''} ready to submit
                    </p>
                    {customerReference && (
                        <p className="text-sm text-blue-700 mt-1 font-medium">
                            Reference: {customerReference}
                        </p>
                    )}
                </div>
                <Button variant="outline" onClick={onBackToForm}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add More Blinds
                </Button>
            </div>

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Order Items ({blinds.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="h-12 px-4 font-medium text-gray-500 w-8"></th>
                                    <th className="h-12 px-4 font-medium text-gray-500">#</th>
                                    <th className="h-12 px-4 font-medium text-gray-500">Location</th>
                                    <th className="h-12 px-4 font-medium text-gray-500">Size</th>
                                    <th className="h-12 px-4 font-medium text-gray-500">Fabric</th>
                                    <th className="h-12 px-4 font-medium text-gray-500 text-right">Price</th>
                                    <th className="h-12 px-4 font-medium text-gray-500 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blinds.map((blind, index) => (
                                    <>
                                        <tr
                                            key={`row-${index}`}
                                            className="border-b hover:bg-gray-50 cursor-pointer"
                                            onClick={() => toggleRow(index)}
                                        >
                                            {/* Expand toggle */}
                                            <td className="px-4 py-3 text-gray-400">
                                                {expandedRows.has(index)
                                                    ? <ChevronUp className="h-4 w-4" />
                                                    : <ChevronDown className="h-4 w-4" />
                                                }
                                            </td>
                                            <td className="p-4 text-gray-500">{index + 1}</td>
                                            <td className="p-4 font-medium">{blind.location}</td>
                                            <td className="p-4">{blind.width}mm x {blind.drop}mm</td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm">{blind.material} - {blind.fabricType}</span>
                                                    <span className="text-xs text-gray-500">{blind.fabricColour}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="font-semibold">${(blind.price || 0).toFixed(2)}</span>
                                                {blind.discountPercent != null && Number(blind.discountPercent) > 0 && (
                                                    <span className="block text-xs text-green-600">
                                                        -{Number(blind.discountPercent)}% fabric discount
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                <div className="flex gap-1 justify-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onEdit(index)}
                                                        className="text-blue-600 hover:text-blue-800"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onDelete(index)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded details row */}
                                        {expandedRows.has(index) && (
                                            <tr key={`detail-${index}`} className="bg-blue-50 border-b">
                                                <td colSpan={7} className="px-8 py-4">
                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                                                        {/* Fabric price (without & with discount) */}
                                                        <div className="col-span-2 md:col-span-2">
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Fabric Price</span>
                                                            <p className="font-medium mt-0.5">
                                                                {blind.fabricPrice != null ? (
                                                                    blind.discountPercent && Number(blind.discountPercent) > 0 ? (
                                                                        <span className="flex items-center gap-2">
                                                                            <span className="line-through text-gray-400">
                                                                                ${(Number(blind.fabricPrice) / (1 - Number(blind.discountPercent) / 100)).toFixed(2)}
                                                                            </span>
                                                                            <span className="text-green-700 font-semibold">
                                                                                ${Number(blind.fabricPrice).toFixed(2)}
                                                                            </span>
                                                                            <span className="text-xs text-orange-600">
                                                                                (-{Number(blind.discountPercent)}%)
                                                                            </span>
                                                                        </span>
                                                                    ) : (
                                                                        <span>${Number(blind.fabricPrice).toFixed(2)}</span>
                                                                    )
                                                                ) : '—'}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Fixing Type</span>
                                                            <p className="font-medium mt-0.5">{blind.fixing || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Control Side</span>
                                                            <p className="font-medium mt-0.5">{blind.controlSide || '—'}</p>
                                                        </div>

                                                        {/* Bracket Type with price indicator */}
                                                        <div>
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Bracket Type</span>
                                                            <p className="font-medium mt-0.5 flex items-center gap-1.5">
                                                                {blind.bracketPrice != null && Number(blind.bracketPrice) > 0 && (
                                                                    <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                                                                        +${Number(blind.bracketPrice).toFixed(2)}
                                                                    </span>
                                                                )}
                                                                {blind.bracketType || '—'}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Bracket Colour</span>
                                                            <p className="font-medium mt-0.5">{blind.bracketColour || '—'}</p>
                                                        </div>

                                                        {/* Chain/Motor with price indicator */}
                                                        <div>
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Chain/Motor</span>
                                                            <p className="font-medium mt-0.5 flex items-center gap-1.5">
                                                                {blind.motorPrice != null && Number(blind.motorPrice) > 0 && (
                                                                    <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                                                                        +${Number(blind.motorPrice).toFixed(2)}
                                                                    </span>
                                                                )}
                                                                {blind.chainOrMotor || '—'}
                                                            </p>
                                                        </div>

                                                        {isWinderMotor(blind.chainOrMotor || '') && (
                                                            <div>
                                                                <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Chain Type</span>
                                                                <p className="font-medium mt-0.5">{blind.chainType || '—'}</p>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Roll Direction</span>
                                                            <p className="font-medium mt-0.5">{blind.roll || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Bottom Rail Type</span>
                                                            <p className="font-medium mt-0.5">{blind.bottomRailType || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Bottom Rail Colour</span>
                                                            <p className="font-medium mt-0.5">{blind.bottomRailColour || '—'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Notes */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Order Notes (Optional)</CardTitle>
                </CardHeader>
                <CardContent>
                    <textarea
                        value={notes}
                        onChange={(e) => onNotesChange(e.target.value)}
                        placeholder="Any special instructions or notes..."
                        className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4 sticky bottom-0 bg-white p-4 border-t shadow-lg rounded-t-lg">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onSaveAsQuote}
                    disabled={isSubmitting}
                    className="flex-1"
                >
                    <FileText className="mr-2 h-4 w-4" />
                    Save as Quote
                </Button>
                <Button
                    type="button"
                    onClick={onSubmitOrder}
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? 'Submitting...' : 'Place Order'}
                </Button>
            </div>
        </div>
    );
}
