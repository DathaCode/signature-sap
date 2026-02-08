import { useState } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { BlindItemForm } from '../../components/orders/BlindItemForm';
import { Button } from '../../components/ui/Button';
import { Plus, Save, ArrowLeft } from 'lucide-react';
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

    const { control, handleSubmit, watch } = methods;
    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    // Calculate Totals
    const items = watch('items');
    const subtotal = items.reduce((sum, item) => sum + (item.price || 0), 0);

    const onSubmit = async (data: CreateOrderRequest) => {
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
                        <p className="text-muted-foreground">Create a new blind order</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {fields.map((field, index) => (
                        <BlindItemForm
                            key={field.id}
                            index={index}
                            onRemove={() => remove(index)}
                            canRemove={fields.length > 1}
                        />
                    ))}

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full py-8 border-dashed"
                        onClick={() => append({
                            location: '', width: 0, drop: 0,
                            material: '', fabricType: '', fabricColour: '',
                            controlSide: 'Left', roll: 'Front'
                        })}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Another Blind
                    </Button>
                </form>

                {/* Sticky Footer */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-10">
                    <div className="max-w-5xl mx-auto flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">{fields.length} Items</p>
                            <p className="text-2xl font-bold">${subtotal.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => navigate('/dashboard')}>
                                Cancel
                            </Button>
                            <Button size="lg" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
                                {isSubmitting ? 'Placing Order...' : 'Place Order'}
                                <Save className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

            </div>
        </FormProvider>
    );
}
