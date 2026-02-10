import { useState } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { BlindItemForm } from '../../components/orders/BlindItemForm';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Plus, Save, FileText, ArrowLeft } from 'lucide-react';
import { CreateOrderRequest } from '../../types/order';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

export default function NewOrderPage() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const methods = useForm<CreateOrderRequest>({
        defaultValues: {
            productType: 'BLINDS',
            items: [{
                location: '',
                width: 0,
                drop: 0,
                material: '',
                fabricType: '',
                fabricColour: '',
                controlSide: 'Left',
                roll: 'Front'
            }]
        }
    });

    const { control, handleSubmit, watch, getValues } = methods;
    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    // Copy current blind's config (preserve all fields except location/width/drop)
    const handleCopy = (index: number) => {
        const current = getValues(`items.${index}`);
        append({
            ...current,
            location: '',
            width: 0,
            drop: 0,
            price: 0,
            fabricGroup: undefined,
            discountPercent: 0,
        });
    };

    // Add a new empty blind after the current one
    const handleContinue = () => {
        append({
            location: '',
            width: 0,
            drop: 0,
            material: '',
            fabricType: '',
            fabricColour: '',
            controlSide: 'Left',
            roll: 'Front'
        });
    };

    // Calculate Totals
    const items = watch('items');
    const subtotal = items.reduce((sum, item) => sum + (item.price || 0), 0);

    const onSubmitOrder = async (data: CreateOrderRequest) => {
        setIsSubmitting(true);
        try {
            await api.post('/web-orders/create', data);
            toast.success('Order placed successfully!');
            navigate('/dashboard');
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to place order');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSaveAsQuote = async (data: CreateOrderRequest) => {
        setIsSubmitting(true);
        try {
            await api.post('/quotes/create', {
                productType: data.productType,
                items: data.items,
                notes: data.notes,
            });
            toast.success('Quote saved successfully!');
            navigate('/quotes');
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save quote');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <FormProvider {...methods}>
            <div className="space-y-6 max-w-5xl mx-auto p-6 pb-24">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">New Order</h1>
                        <p className="text-muted-foreground">Create a new blind order or save as quote</p>
                    </div>
                </div>

                {/* Form */}
                <form className="space-y-6">
                    {fields.map((field, index) => (
                        <BlindItemForm
                            key={field.id}
                            index={index}
                            onRemove={() => remove(index)}
                            onCopy={() => handleCopy(index)}
                            onContinue={handleContinue}
                            canRemove={fields.length > 1}
                        />
                    ))}

                    {/* Add Blind Button */}
                    <div className="flex justify-center">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => append({
                                location: '',
                                width: 0,
                                drop: 0,
                                material: '',
                                fabricType: '',
                                fabricColour: '',
                                controlSide: 'Left',
                                roll: 'Front'
                            })}
                            className="w-full max-w-md"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Another Blind
                        </Button>
                    </div>

                    {/* Order Summary */}
                    <Card className="border-2 border-blue-600">
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {items.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center py-2 border-b">
                                        <div className="flex-1">
                                            <p className="font-medium">Blind #{index + 1}: {item.location || 'Unnamed'}</p>
                                            <p className="text-sm text-gray-600">
                                                {item.width}mm × {item.drop}mm
                                                {item.material && ` • ${item.material}`}
                                                {item.fabricType && ` - ${item.fabricType}`}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">${(item.price || 0).toFixed(2)}</p>
                                            {item.discountPercent > 0 && (
                                                <p className="text-xs text-green-600">-{item.discountPercent}% discount</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t-2 border-gray-300">
                                <div className="flex justify-between items-center">
                                    <p className="text-lg font-bold">Total</p>
                                    <p className="text-2xl font-bold text-blue-600">${subtotal.toFixed(2)}</p>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{fields.length} blind{fields.length !== 1 ? 's' : ''}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex gap-4 sticky bottom-0 bg-white p-4 border-t shadow-lg">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleSubmit(onSaveAsQuote)}
                            disabled={isSubmitting || fields.length === 0}
                            className="flex-1"
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            Save as Quote
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit(onSubmitOrder)}
                            disabled={isSubmitting || fields.length === 0}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Place Order
                        </Button>
                    </div>
                </form>

            </div>
        </FormProvider>
    );
}
