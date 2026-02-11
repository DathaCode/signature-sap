import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Pencil, Trash2, ArrowLeft, Save, FileText } from 'lucide-react';
import { BlindItem } from '../../types/order';

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
}: OrderSummaryProps) {
    const subtotal = blinds.reduce((sum, b) => sum + (b.price || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Review Your Order</h1>
                    <p className="text-gray-500 mt-1">
                        {blinds.length} blind{blinds.length !== 1 ? 's' : ''} ready to submit
                    </p>
                </div>
                <Button variant="outline" onClick={onBackToForm}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Form
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
                                    <th className="h-12 px-4 font-medium text-gray-500">#</th>
                                    <th className="h-12 px-4 font-medium text-gray-500">Location</th>
                                    <th className="h-12 px-4 font-medium text-gray-500">Size</th>
                                    <th className="h-12 px-4 font-medium text-gray-500">Fabric</th>
                                    <th className="h-12 px-4 font-medium text-gray-500">Motor/Chain</th>
                                    <th className="h-12 px-4 font-medium text-gray-500 text-right">Price</th>
                                    <th className="h-12 px-4 font-medium text-gray-500 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blinds.map((blind, index) => (
                                    <tr key={index} className="border-b hover:bg-gray-50">
                                        <td className="p-4 text-gray-500">{index + 1}</td>
                                        <td className="p-4 font-medium">{blind.location}</td>
                                        <td className="p-4">{blind.width}mm x {blind.drop}mm</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-sm">{blind.material} - {blind.fabricType}</span>
                                                <span className="text-xs text-gray-500">{blind.fabricColour}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm">{blind.chainOrMotor || '-'}</td>
                                        <td className="p-4 text-right">
                                            <span className="font-semibold">${(blind.price || 0).toFixed(2)}</span>
                                            {blind.discountPercent != null && Number(blind.discountPercent) > 0 && (
                                                <span className="block text-xs text-green-600">
                                                    -{Number(blind.discountPercent)}% discount
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
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

            {/* Pricing Summary */}
            <Card className="border-2 border-blue-600">
                <CardHeader>
                    <CardTitle>Pricing Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {blinds.map((blind, index) => (
                        <div key={index} className="flex justify-between items-center py-1 text-sm">
                            <span>Blind #{index + 1}: {blind.location}</span>
                            <span className="font-medium">${(blind.price || 0).toFixed(2)}</span>
                        </div>
                    ))}
                    <div className="pt-4 border-t-2 border-gray-300">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold">Total</span>
                            <span className="text-2xl font-bold text-blue-600">${subtotal.toFixed(2)}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{blinds.length} blind{blinds.length !== 1 ? 's' : ''}</p>
                    </div>
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
