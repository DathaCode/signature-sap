import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getMaterials, getFabricTypes, getFabricColors } from '../../data/fabrics';
import { Trash2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';


interface BlindItemFormProps {
    index: number;
    onRemove: () => void;
    canRemove: boolean;
}

export function BlindItemForm({ index, onRemove, canRemove }: BlindItemFormProps) {
    const { register, setValue, control } = useFormContext();

    // Watch fields for hierarchical dropdowns & pricing
    const material = useWatch({ control, name: `items.${index}.material` });
    const fabricType = useWatch({ control, name: `items.${index}.fabricType` });
    const width = useWatch({ control, name: `items.${index}.width` });
    const drop = useWatch({ control, name: `items.${index}.drop` });
    const price = useWatch({ control, name: `items.${index}.price` });
    const discount = useWatch({ control, name: `items.${index}.discountPercent` });

    // Debounce pricing inputs
    const debouncedWidth = useDebounce(width, 500);
    const debouncedDrop = useDebounce(drop, 500);

    // Reset dependent fields when parent changes
    useEffect(() => {
        setValue(`items.${index}.fabricType`, '');
        setValue(`items.${index}.fabricColour`, '');
    }, [material, setValue, index]);

    useEffect(() => {
        setValue(`items.${index}.fabricColour`, '');
    }, [fabricType, setValue, index]);

    // Calculate Price
    useEffect(() => {
        const calculate = () => {
            if (material && fabricType && debouncedWidth > 0 && debouncedDrop > 0) {
                // Get fabric group first
                import('../../data/fabrics').then(({ getFabricGroup }) => {
                    const group = getFabricGroup(material, fabricType);

                    if (group) {
                        import('../../utils/pricing').then(({ calculateBlindPrice }) => {
                            const result = calculateBlindPrice(
                                Number(debouncedWidth),
                                Number(debouncedDrop),
                                0, // Default discount (can be updated based on logic if needed)
                                group
                            );

                            if (result) {
                                setValue(`items.${index}.price`, result.price);
                                setValue(`items.${index}.fabricGroup`, group);
                                // Set default discount based on group if needed, matching the HTML logic
                                // The HTML has: G1=20%, G2=25%, G3=30%
                                const defaultDiscounts: Record<number, number> = { 1: 20, 2: 25, 3: 30 };
                                const itemsDiscount = defaultDiscounts[group] || 0;
                                setValue(`items.${index}.discountPercent`, itemsDiscount);

                                // Recalculate with discount
                                const discountedResult = calculateBlindPrice(
                                    Number(debouncedWidth),
                                    Number(debouncedDrop),
                                    itemsDiscount,
                                    group
                                );
                                if (discountedResult) {
                                    setValue(`items.${index}.price`, discountedResult.price);
                                }
                            } else {
                                setValue(`items.${index}.price`, 0);
                            }
                        });
                    }
                });
            }
        };

        calculate();
    }, [material, fabricType, debouncedWidth, debouncedDrop, setValue, index]);

    // Data options
    const materials = getMaterials().map(m => ({ label: m, value: m }));
    const fabricTypes = material ? getFabricTypes(material).map(t => ({ label: t, value: t })) : [];
    const fabricColors = (material && fabricType) ? getFabricColors(material, fabricType).map(c => ({ label: c, value: c })) : [];

    const controlSides = [{ label: 'Left', value: 'Left' }, { label: 'Right', value: 'Right' }];

    const rollOptions = [{ label: 'Front', value: 'Front' }, { label: 'Back', value: 'Back' }];

    return (
        <Card className="mb-6 border-l-4 border-l-blue-600">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-4">
                    <CardTitle className="text-lg">Blind #{index + 1}</CardTitle>
                    {price > 0 && (
                        <Badge variant="success" className="text-sm px-3 py-1">
                            ${price.toFixed(2)}
                            {discount > 0 && <span className="ml-1 text-xs opacity-90">(-{discount}%)</span>}
                        </Badge>
                    )}
                </div>
                {canRemove && (
                    <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                    </Button>
                )}
            </CardHeader>
            <CardContent className="grid gap-6">

                {/* Dimensions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Location / Room</Label>
                        <Input {...register(`items.${index}.location`, { required: 'Required' })} placeholder="e.g. Living Room" />
                    </div>
                    <div className="space-y-2">
                        <Label>Width (mm)</Label>
                        <Input
                            type="number"
                            {...register(`items.${index}.width`, { required: 'Required', valueAsNumber: true, min: 100 })}
                            placeholder="Width"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Drop (mm)</Label>
                        <Input
                            type="number"
                            {...register(`items.${index}.drop`, { required: 'Required', valueAsNumber: true, min: 100 })}
                            placeholder="Drop"
                        />
                    </div>
                </div>

                {/* Fabric Selection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-md">
                    <div className="space-y-2">
                        <Label>Material Brand</Label>
                        <Select {...register(`items.${index}.material`, { required: 'Required' })} options={materials} placeholder="Select Brand" />
                    </div>
                    <div className="space-y-2">
                        <Label>Fabric Range</Label>
                        <Select
                            {...register(`items.${index}.fabricType`, { required: 'Required' })}
                            options={fabricTypes}
                            placeholder="Select Range"
                            disabled={!material}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Fabric Colour</Label>
                        <Select
                            {...register(`items.${index}.fabricColour`, { required: 'Required' })}
                            options={fabricColors}
                            placeholder="Select Colour"
                            disabled={!fabricType}
                        />
                    </div>
                </div>

                {/* Control & Hardware Details */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label>Control Side</Label>
                        <Select {...register(`items.${index}.controlSide`)} options={controlSides} placeholder="Select Side" />
                    </div>
                    <div className="space-y-2">
                        <Label>Roll Direction</Label>
                        <Select {...register(`items.${index}.roll`)} options={rollOptions} placeholder="Select Roll" />
                    </div>
                    <div className="space-y-2">
                        <Label>Chain/Motor</Label>
                        <Input {...register(`items.${index}.chainOrMotor`)} placeholder="Chain Color or Motor" />
                    </div>
                    <div className="space-y-2">
                        <Label>Fixing Type</Label>
                        <Input {...register(`items.${index}.fixing`)} placeholder="Face/Reveal" />
                    </div>
                </div>

                {/* Additional Details */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label>Bracket Type</Label>
                        <Input {...register(`items.${index}.bracketType`)} placeholder="e.g. Double/Dual" />
                    </div>
                    <div className="space-y-2">
                        <Label>Bracket Colour</Label>
                        <Input {...register(`items.${index}.bracketColour`)} placeholder="Color" />
                    </div>
                    <div className="space-y-2">
                        <Label>Bottom Rail Type</Label>
                        <Input {...register(`items.${index}.bottomRailType`)} placeholder="Type" />
                    </div>
                    <div className="space-y-2">
                        <Label>Bottom Rail Colour</Label>
                        <Input {...register(`items.${index}.bottomRailColour`)} placeholder="Color" />
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
