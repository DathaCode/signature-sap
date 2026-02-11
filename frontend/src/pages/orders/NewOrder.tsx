import { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { BlindItemForm } from '../../components/orders/BlindItemForm';
import OrderSummary from '../../components/orders/OrderSummary';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ArrowLeft, Copy, PlusCircle, CheckCircle } from 'lucide-react';
import { BlindItem, CreateOrderRequest } from '../../types/order';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

const emptyBlind: BlindItem = {
    location: '',
    width: 0,
    drop: 0,
    material: '',
    fabricType: '',
    fabricColour: '',
    controlSide: 'Left',
    roll: 'Front',
    fixing: '',
    bracketType: '',
    bracketColour: '',
    chainOrMotor: '',
    bottomRailType: '',
    bottomRailColour: '',
    price: 0,
    fabricGroup: 1,
    discountPercent: 0,
};

export default function NewOrderPage() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [savedBlinds, setSavedBlinds] = useState<BlindItem[]>([]);
    const [showSummary, setShowSummary] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [notes, setNotes] = useState('');

    const methods = useForm<CreateOrderRequest>({
        defaultValues: {
            productType: 'BLINDS',
            items: [{ ...emptyBlind }]
        }
    });

    const { getValues, reset } = methods;

    // Auto-save draft to localStorage
    useEffect(() => {
        if (savedBlinds.length > 0) {
            const draft = {
                blinds: savedBlinds,
                notes,
                timestamp: Date.now(),
            };
            localStorage.setItem('order_draft', JSON.stringify(draft));
        }
    }, [savedBlinds, notes]);

    // Restore draft on mount
    useEffect(() => {
        const draftStr = localStorage.getItem('order_draft');
        if (draftStr) {
            try {
                const draft = JSON.parse(draftStr);
                const hoursOld = (Date.now() - draft.timestamp) / (1000 * 60 * 60);
                if (hoursOld < 24 && draft.blinds?.length > 0) {
                    if (confirm(`You have an unsaved draft from ${new Date(draft.timestamp).toLocaleString()} with ${draft.blinds.length} blind(s). Restore it?`)) {
                        setSavedBlinds(draft.blinds);
                        if (draft.notes) setNotes(draft.notes);
                        toast.success('Draft restored!');
                    } else {
                        localStorage.removeItem('order_draft');
                    }
                } else if (hoursOld >= 24) {
                    localStorage.removeItem('order_draft');
                }
            } catch {
                localStorage.removeItem('order_draft');
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const clearDraft = useCallback(() => {
        localStorage.removeItem('order_draft');
    }, []);

    // Validate current blind has all required fields
    const validateCurrentBlind = (): boolean => {
        const item = getValues('items.0');
        const required: (keyof BlindItem)[] = [
            'location', 'width', 'drop', 'material', 'fabricType', 'fabricColour',
            'controlSide', 'roll', 'fixing', 'bracketType', 'bracketColour',
            'chainOrMotor', 'bottomRailType', 'bottomRailColour'
        ];

        for (const field of required) {
            const val = item[field];
            if (!val || val === '' || val === 0) {
                return false;
            }
        }

        // If winder, chain type is required
        const isWinder = item.chainOrMotor?.toLowerCase().includes('winder');
        if (isWinder && !item.chainType) {
            return false;
        }

        return true;
    };

    const isPartiallyFilled = (): boolean => {
        const item = getValues('items.0');
        return !!(item.location || (item.width && item.width > 0) || (item.drop && item.drop > 0) || item.material);
    };

    // Save current blind and copy settings (except Location, Width, Drop)
    const handleUpdateAndCopy = () => {
        if (!validateCurrentBlind()) {
            toast.error('Please fill all required fields before saving');
            return;
        }

        const item = { ...getValues('items.0') };

        if (editingIndex !== null) {
            const updated = [...savedBlinds];
            updated[editingIndex] = item;
            setSavedBlinds(updated);
            toast.success(`Blind #${editingIndex + 1} updated! Fields copied (except Location, Width, Drop).`);
            setEditingIndex(null);
        } else {
            setSavedBlinds([...savedBlinds, item]);
            toast.success(`Blind #${savedBlinds.length + 1} saved! Fields copied (except Location, Width, Drop).`);
        }

        // Copy all fields EXCEPT Location, Width, Drop, price
        reset({
            productType: 'BLINDS',
            items: [{
                ...item,
                location: '',
                width: 0,
                drop: 0,
                price: 0,
                fabricGroup: item.fabricGroup,
                discountPercent: 0,
            }]
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Save current blind and clear ALL fields
    const handleUpdateAndContinueAdding = () => {
        if (!validateCurrentBlind()) {
            toast.error('Please fill all required fields before saving');
            return;
        }

        const item = { ...getValues('items.0') };

        if (editingIndex !== null) {
            const updated = [...savedBlinds];
            updated[editingIndex] = item;
            setSavedBlinds(updated);
            toast.success(`Blind #${editingIndex + 1} updated! Ready for next blind.`);
            setEditingIndex(null);
        } else {
            setSavedBlinds([...savedBlinds, item]);
            toast.success(`Blind #${savedBlinds.length + 1} saved! Ready for next blind.`);
        }

        // Clear ALL fields
        reset({
            productType: 'BLINDS',
            items: [{ ...emptyBlind }]
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Finish adding blinds and go to review
    const handleFinishAndReview = () => {
        // If current form has data, try to save it first
        if (isPartiallyFilled()) {
            if (!validateCurrentBlind()) {
                toast.error('Please complete all fields for the current blind or clear them to proceed');
                return;
            }
            const item = { ...getValues('items.0') };
            setSavedBlinds(prev => [...prev, item]);
        }

        if (savedBlinds.length === 0 && !isPartiallyFilled()) {
            toast.error('Please add at least one blind to proceed');
            return;
        }

        setShowSummary(true);
    };

    // Edit a saved blind
    const handleEditBlind = (index: number) => {
        const blind = savedBlinds[index];
        reset({
            productType: 'BLINDS',
            items: [{ ...blind }]
        });
        setEditingIndex(index);
        setShowSummary(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast(`Editing Blind #${index + 1}`, { icon: '✏️' });
    };

    // Delete a saved blind
    const handleDeleteBlind = (index: number) => {
        if (!confirm(`Are you sure you want to delete Blind #${index + 1}?`)) return;
        const updated = savedBlinds.filter((_, i) => i !== index);
        setSavedBlinds(updated);
        toast.success(`Blind #${index + 1} deleted`);

        if (updated.length === 0) {
            setShowSummary(false);
        }
    };

    // Submit as order
    const handleSubmitOrder = async () => {
        setIsSubmitting(true);
        try {
            const data: CreateOrderRequest = {
                productType: 'BLINDS',
                items: savedBlinds,
                notes: notes || undefined,
            };
            await api.post('/web-orders/create', data);
            clearDraft();
            toast.success('Order placed successfully!');
            navigate('/dashboard');
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to place order');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Save as quote
    const handleSaveAsQuote = async () => {
        setIsSubmitting(true);
        try {
            await api.post('/quotes/create', {
                productType: 'BLINDS',
                items: savedBlinds,
                notes: notes || undefined,
            });
            clearDraft();
            toast.success('Quote saved successfully!');
            navigate('/quotes');
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save quote');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Summary view
    if (showSummary) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto p-6 pb-24">
                <OrderSummary
                    blinds={savedBlinds}
                    onEdit={handleEditBlind}
                    onDelete={handleDeleteBlind}
                    onBackToForm={() => setShowSummary(false)}
                    onSubmitOrder={handleSubmitOrder}
                    onSaveAsQuote={handleSaveAsQuote}
                    isSubmitting={isSubmitting}
                    notes={notes}
                    onNotesChange={setNotes}
                />
            </div>
        );
    }

    // Form view
    return (
        <FormProvider {...methods}>
            <div className="space-y-6 max-w-5xl mx-auto p-6 pb-24">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Create New Order</h1>
                        <p className="text-gray-500 mt-1">
                            {editingIndex !== null
                                ? `Editing Blind #${editingIndex + 1}`
                                : savedBlinds.length === 0
                                    ? 'Add your first blind'
                                    : `Adding Blind #${savedBlinds.length + 1}`
                            }
                        </p>
                    </div>
                </div>

                {/* Single Blind Form */}
                <form className="space-y-6">
                    <BlindItemForm
                        index={0}
                        blindNumber={editingIndex !== null ? editingIndex + 1 : savedBlinds.length + 1}
                    />

                    {/* ACTION BUTTONS */}
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6">
                        <div className="flex gap-4 flex-wrap">
                            <button
                                type="button"
                                onClick={handleUpdateAndCopy}
                                className="flex-1 min-w-[240px] bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:from-blue-600 hover:to-blue-700 transition-all hover:shadow-lg"
                                title="Save this blind and copy settings (except Location, Width, Drop)"
                            >
                                <Copy className="h-5 w-5" />
                                Update & Copy
                            </button>

                            <button
                                type="button"
                                onClick={handleUpdateAndContinueAdding}
                                className="flex-1 min-w-[240px] bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:from-green-600 hover:to-green-700 transition-all hover:shadow-lg"
                                title="Save this blind and start fresh"
                            >
                                <PlusCircle className="h-5 w-5" />
                                Update & Continue Adding
                            </button>
                        </div>

                        {savedBlinds.length > 0 && (
                            <div className="pt-6 border-t border-gray-300 mt-6 text-center">
                                <button
                                    type="button"
                                    onClick={handleFinishAndReview}
                                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-purple-600 hover:to-purple-700 transition-all hover:shadow-lg inline-flex items-center gap-2"
                                >
                                    <CheckCircle className="h-5 w-5" />
                                    Finish & Review Order ({savedBlinds.length} blind{savedBlinds.length !== 1 ? 's' : ''})
                                </button>
                            </div>
                        )}
                    </div>
                </form>

                {/* Blinds Added So Far */}
                {savedBlinds.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Blinds Added ({savedBlinds.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead>
                                        <tr className="border-b bg-gray-100">
                                            <th className="h-10 px-4 font-medium text-gray-500">#</th>
                                            <th className="h-10 px-4 font-medium text-gray-500">Location</th>
                                            <th className="h-10 px-4 font-medium text-gray-500">Size</th>
                                            <th className="h-10 px-4 font-medium text-gray-500">Fabric</th>
                                            <th className="h-10 px-4 font-medium text-gray-500">Motor/Chain</th>
                                            <th className="h-10 px-4 font-medium text-gray-500 text-right">Price</th>
                                            <th className="h-10 px-4 font-medium text-gray-500 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {savedBlinds.map((blind, index) => (
                                            <tr
                                                key={index}
                                                className={`border-b hover:bg-gray-50 ${editingIndex === index ? 'bg-yellow-50 border-l-4 border-l-yellow-500' : ''}`}
                                            >
                                                <td className="p-4 text-gray-500">{index + 1}</td>
                                                <td className="p-4 font-medium">{blind.location}</td>
                                                <td className="p-4">{blind.width} x {blind.drop} mm</td>
                                                <td className="p-4 text-sm">{blind.material} - {blind.fabricType}</td>
                                                <td className="p-4 text-sm">{blind.chainOrMotor}</td>
                                                <td className="p-4 text-right font-semibold">${(blind.price || 0).toFixed(2)}</td>
                                                <td className="p-4 text-center">
                                                    <div className="flex gap-1 justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditBlind(index)}
                                                            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteBlind(index)}
                                                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>
        </FormProvider>
    );
}
