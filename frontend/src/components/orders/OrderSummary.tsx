import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Pencil, Trash2, Save, FileText, ChevronDown, ChevronUp, PlusCircle, CheckSquare, Square, Settings2 } from 'lucide-react';
import { BlindItem } from '../../types/order';
import { isWinderMotor } from '../../data/hardware';
import { getMaterials, getFabricTypes, getFabricColors } from '../../data/fabrics';
import {
    FIXING_TYPES, BRACKET_TYPES, BRACKET_COLOURS, MOTORS, CHAIN_TYPES,
    BOTTOM_RAIL_TYPES, BOTTOM_RAIL_COLOURS, CONTROL_SIDES, ROLL_DIRECTIONS
} from '../../data/hardware';

interface OrderSummaryProps {
    blinds: BlindItem[];
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    onBulkDelete: (indices: number[]) => void;
    onBulkUpdate: (indices: number[], fields: Partial<BlindItem>) => void;
    onBackToForm: () => void;
    onSubmitOrder: () => void;
    onSaveAsQuote: () => void;
    isSubmitting: boolean;
    notes: string;
    onNotesChange: (notes: string) => void;
    customerReference?: string;
}

interface BulkChanges {
    material: string;
    fabricType: string;
    fabricColour: string;
    fixing: string;
    controlSide: string;
    bracketType: string;
    bracketColour: string;
    chainOrMotor: string;
    chainType: string;
    roll: string;
    bottomRailType: string;
    bottomRailColour: string;
}

const EMPTY_BULK: BulkChanges = {
    material: '', fabricType: '', fabricColour: '',
    fixing: '', controlSide: '',
    bracketType: '', bracketColour: '',
    chainOrMotor: '', chainType: '',
    roll: '', bottomRailType: '', bottomRailColour: '',
};

const SelectField = ({
    label, value, options, onChange, disabled,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
            <option value="">— No change —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);

export default function OrderSummary({
    blinds,
    onEdit,
    onDelete,
    onBulkDelete,
    onBulkUpdate,
    onBackToForm,
    onSubmitOrder,
    onSaveAsQuote,
    isSubmitting,
    notes,
    onNotesChange,
    customerReference,
}: OrderSummaryProps) {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [bulk, setBulk] = useState<BulkChanges>({ ...EMPTY_BULK });

    const toggleRow = (index: number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    };

    const toggleSelect = (index: number) => {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    };

    const allSelected = blinds.length > 0 && selectedIndices.size === blinds.length;
    const someSelected = selectedIndices.size > 0;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(blinds.map((_, i) => i)));
        }
    };

    const setBulkField = (field: keyof BulkChanges, value: string) => {
        setBulk(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'material') { next.fabricType = ''; next.fabricColour = ''; }
            if (field === 'fabricType') { next.fabricColour = ''; }
            return next;
        });
    };

    const handleApplyBulk = () => {
        const fields: Partial<BlindItem> = {};
        (Object.keys(bulk) as (keyof BulkChanges)[]).forEach(k => {
            if (bulk[k]) (fields as any)[k] = bulk[k];
        });
        if (Object.keys(fields).length === 0) return;
        onBulkUpdate(Array.from(selectedIndices), fields);
        setSelectedIndices(new Set());
        setShowBulkEdit(false);
        setBulk({ ...EMPTY_BULK });
    };

    const handleBulkDelete = () => {
        onBulkDelete(Array.from(selectedIndices));
        setSelectedIndices(new Set());
        setShowBulkEdit(false);
    };

    const fabricTypes = bulk.material ? getFabricTypes(bulk.material) : [];
    const fabricColours = bulk.material && bulk.fabricType ? getFabricColors(bulk.material, bulk.fabricType) : [];

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
                <CardContent className="p-0">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm text-left">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="h-10 px-3 w-8">
                                        <button
                                            onClick={toggleSelectAll}
                                            className="text-gray-400 hover:text-blue-600"
                                            title={allSelected ? 'Deselect all' : 'Select all'}
                                        >
                                            {allSelected
                                                ? <CheckSquare className="h-4 w-4 text-blue-600" />
                                                : <Square className="h-4 w-4" />
                                            }
                                        </button>
                                    </th>
                                    <th className="h-10 px-3 w-8 font-medium text-gray-500"></th>
                                    <th className="h-10 px-3 font-medium text-gray-500">#</th>
                                    <th className="h-10 px-3 font-medium text-gray-500">Location</th>
                                    <th className="h-10 px-3 font-medium text-gray-500">Size</th>
                                    <th className="h-10 px-3 font-medium text-gray-500">Fabric</th>
                                    <th className="h-10 px-3 font-medium text-gray-500 text-right">Price</th>
                                    <th className="h-10 px-3 font-medium text-gray-500 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blinds.map((blind, index) => (
                                    <>
                                        <tr
                                            key={`row-${index}`}
                                            className={`border-b hover:bg-gray-50 cursor-pointer ${selectedIndices.has(index) ? 'bg-blue-50' : ''}`}
                                        >
                                            {/* Checkbox */}
                                            <td className="px-3 py-3" onClick={e => { e.stopPropagation(); toggleSelect(index); }}>
                                                {selectedIndices.has(index)
                                                    ? <CheckSquare className="h-4 w-4 text-blue-600" />
                                                    : <Square className="h-4 w-4 text-gray-300" />
                                                }
                                            </td>
                                            {/* Expand toggle */}
                                            <td className="px-3 py-3 text-gray-400" onClick={() => toggleRow(index)}>
                                                {expandedRows.has(index)
                                                    ? <ChevronUp className="h-4 w-4" />
                                                    : <ChevronDown className="h-4 w-4" />
                                                }
                                            </td>
                                            <td className="p-3 text-gray-500" onClick={() => toggleRow(index)}>{index + 1}</td>
                                            <td className="p-3 font-medium" onClick={() => toggleRow(index)}>{blind.location}</td>
                                            <td className="p-3" onClick={() => toggleRow(index)}>{blind.width}mm x {blind.drop}mm</td>
                                            <td className="p-3" onClick={() => toggleRow(index)}>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm">{blind.material} - {blind.fabricType}</span>
                                                    <span className="text-xs text-gray-500">{blind.fabricColour}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right" onClick={() => toggleRow(index)}>
                                                <span className="font-semibold text-blue-700">${(blind.price || 0).toFixed(2)}</span>
                                            </td>
                                            <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
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
                                                <td colSpan={8} className="px-8 py-4">
                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                                                        <div className="col-span-2 md:col-span-2">
                                                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Fabric</span>
                                                            <p className="font-medium mt-0.5">
                                                                {blind.fabricPrice != null ? (
                                                                    blind.discountPercent && Number(blind.discountPercent) > 0 ? (
                                                                        <span className="flex items-center gap-2 flex-wrap">
                                                                            <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-semibold line-through text-xs">
                                                                                ${(Number(blind.fabricPrice) / (1 - Number(blind.discountPercent) / 100)).toFixed(2)}
                                                                            </span>
                                                                            <span className="text-xs text-orange-600">-{Number(blind.discountPercent)}%</span>
                                                                            <span className="text-green-700 font-semibold">
                                                                                ${Number(blind.fabricPrice).toFixed(2)}
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

            {/* Bulk Action Bar — appears when any blinds selected */}
            {someSelected && (
                <Card className="border-2 border-blue-300 bg-blue-50">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-semibold text-blue-800 text-sm">
                                {selectedIndices.size} blind{selectedIndices.size !== 1 ? 's' : ''} selected
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setShowBulkEdit(v => !v); setBulk({ ...EMPTY_BULK }); }}
                                className="border-blue-400 text-blue-700 hover:bg-blue-100"
                            >
                                <Settings2 className="h-4 w-4 mr-1.5" />
                                {showBulkEdit ? 'Hide Bulk Edit' : 'Bulk Edit'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleBulkDelete}
                                className="border-red-400 text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4 mr-1.5" />
                                Delete Selected
                            </Button>
                            <button
                                className="text-xs text-gray-500 hover:text-gray-700 ml-auto underline"
                                onClick={() => { setSelectedIndices(new Set()); setShowBulkEdit(false); }}
                            >
                                Clear selection
                            </button>
                        </div>

                        {/* Bulk Edit Panel */}
                        {showBulkEdit && (
                            <div className="mt-4 pt-4 border-t border-blue-200 space-y-4">
                                <p className="text-xs text-blue-700 font-medium">
                                    Set fields below — only fields you change will be applied. Prices will recalculate automatically.
                                </p>

                                {/* Fabric Section */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Fabric</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <SelectField
                                            label="Material"
                                            value={bulk.material}
                                            options={getMaterials()}
                                            onChange={v => setBulkField('material', v)}
                                        />
                                        <SelectField
                                            label="Fabric Range"
                                            value={bulk.fabricType}
                                            options={fabricTypes}
                                            onChange={v => setBulkField('fabricType', v)}
                                            disabled={!bulk.material}
                                        />
                                        <SelectField
                                            label="Fabric Colour"
                                            value={bulk.fabricColour}
                                            options={fabricColours}
                                            onChange={v => setBulkField('fabricColour', v)}
                                            disabled={!bulk.material || !bulk.fabricType}
                                        />
                                    </div>
                                </div>

                                {/* Installation & Bracket */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Installation & Bracket</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <SelectField label="Fixing Type" value={bulk.fixing} options={FIXING_TYPES} onChange={v => setBulkField('fixing', v)} />
                                        <SelectField label="Control Side" value={bulk.controlSide} options={CONTROL_SIDES} onChange={v => setBulkField('controlSide', v)} />
                                        <SelectField label="Bracket Type" value={bulk.bracketType} options={BRACKET_TYPES} onChange={v => setBulkField('bracketType', v)} />
                                        <SelectField label="Bracket Colour" value={bulk.bracketColour} options={BRACKET_COLOURS} onChange={v => setBulkField('bracketColour', v)} />
                                    </div>
                                </div>

                                {/* Drive & Other */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Drive & Bottom Rail</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                        <SelectField label="Chain/Motor" value={bulk.chainOrMotor} options={MOTORS} onChange={v => setBulkField('chainOrMotor', v)} />
                                        <SelectField label="Chain Type" value={bulk.chainType} options={CHAIN_TYPES} onChange={v => setBulkField('chainType', v)} />
                                        <SelectField label="Roll Direction" value={bulk.roll} options={ROLL_DIRECTIONS} onChange={v => setBulkField('roll', v)} />
                                        <SelectField label="Bottom Rail Type" value={bulk.bottomRailType} options={BOTTOM_RAIL_TYPES} onChange={v => setBulkField('bottomRailType', v)} />
                                        <SelectField label="Bottom Rail Colour" value={bulk.bottomRailColour} options={BOTTOM_RAIL_COLOURS} onChange={v => setBulkField('bottomRailColour', v)} />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <Button
                                        onClick={handleApplyBulk}
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        Apply to {selectedIndices.size} blind{selectedIndices.size !== 1 ? 's' : ''}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => { setShowBulkEdit(false); setBulk({ ...EMPTY_BULK }); }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

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
