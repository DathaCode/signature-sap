import { useEffect, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getMaterials, getFabricTypes, getFabricColors } from '../../data/fabrics';
import {
    MOTORS,
    FIXING_TYPES,
    BRACKET_TYPES,
    BRACKET_COLOURS,
    CHAIN_TYPES,
    BOTTOM_RAIL_TYPES,
    BOTTOM_RAIL_COLOURS,
    CONTROL_SIDES,
    ROLL_DIRECTIONS,
    toSelectOptions,
    isWinderMotor,
    isTBSExtendedInvalid
} from '../../data/hardware';
import { Trash2, AlertCircle, Calculator } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { pricingApi } from '../../services/api';
import toast from 'react-hot-toast';


interface BlindItemFormProps {
    index: number;
    onRemove: () => void;
    canRemove: boolean;
}

export function BlindItemForm({ index, onRemove, canRemove }: BlindItemFormProps) {
    const { register, setValue, control, setError, clearErrors, getValues } = useFormContext();

    // Watch all fields
    const material = useWatch({ control, name: `items.${index}.material` });
    const fabricType = useWatch({ control, name: `items.${index}.fabricType` });
    const fabricColour = useWatch({ control, name: `items.${index}.fabricColour` });
    const width = useWatch({ control, name: `items.${index}.width` });
    const drop = useWatch({ control, name: `items.${index}.drop` });
    const price = useWatch({ control, name: `items.${index}.price` });
    const discount = useWatch({ control, name: `items.${index}.discountPercent` });
    const chainOrMotor = useWatch({ control, name: `items.${index}.chainOrMotor` });
    const chainType = useWatch({ control, name: `items.${index}.chainType` });
    const bracketType = useWatch({ control, name: `items.${index}.bracketType` });
    const bracketColour = useWatch({ control, name: `items.${index}.bracketColour` });
    const bottomRailType = useWatch({ control, name: `items.${index}.bottomRailType` });
    const bottomRailColour = useWatch({ control, name: `items.${index}.bottomRailColour` });
    const controlSide = useWatch({ control, name: `items.${index}.controlSide` });

    // Validation error state
    const [validationError, setValidationError] = useState<string | null>(null);
    const [calculatingPrice, setCalculatingPrice] = useState(false);
    const [priceBreakdown, setPriceBreakdown] = useState<any>(null);

    // Debounce pricing inputs
    const debouncedWidth = useDebounce(width, 500);
    const debouncedDrop = useDebounce(drop, 500);

    // Show chain type dropdown only for winders
    const showChainType = chainOrMotor && isWinderMotor(chainOrMotor);

    // Check if all required fields are filled for pricing
    const canCalculatePrice = Boolean(
        width && drop && material && fabricType && fabricColour &&
        chainOrMotor && bracketType && bracketColour &&
        bottomRailType && bottomRailColour &&
        (!showChainType || chainType) // If winder, chain type is required
    );

    // Validate TBS + Extended bracket combination
    useEffect(() => {
        if (chainOrMotor && bracketType) {
            if (isTBSExtendedInvalid(chainOrMotor, bracketType)) {
                setValidationError('Extended bracket set is not available with TBS winder-32mm');
                setError(`items.${index}.bracketType`, {
                    type: 'manual',
                    message: 'Invalid combination',
                });
            } else {
                setValidationError(null);
                clearErrors(`items.${index}.bracketType`);
            }
        }
    }, [chainOrMotor, bracketType, setError, clearErrors, index]);

    // Reset dependent fields when parent changes
    useEffect(() => {
        setValue(`items.${index}.fabricType`, '');
        setValue(`items.${index}.fabricColour`, '');
    }, [material, setValue, index]);

    useEffect(() => {
        setValue(`items.${index}.fabricColour`, '');
    }, [fabricType, setValue, index]);

    // Reset chain type when motor changes to non-winder
    useEffect(() => {
        if (chainOrMotor && !isWinderMotor(chainOrMotor)) {
            setValue(`items.${index}.chainType`, '');
        }
    }, [chainOrMotor, setValue, index]);

    // Calculate comprehensive price (called on button click)
    const handleCalculatePrice = async () => {
        if (!canCalculatePrice) {
            toast.error('Please fill in all required fields to calculate price');
            return;
        }

        try {
            setCalculatingPrice(true);
            setPriceBreakdown(null);

            const breakdown = await pricingApi.calculateBlindPrice({
                width: Number(width),
                drop: Number(drop),
                material,
                fabricType,
                fabricColour,
                chainOrMotor,
                chainType: showChainType ? chainType : undefined,
                bracketType,
                bracketColour,
                bottomRailType,
                bottomRailColour,
                controlSide,
            });

            // Update form values
            setValue(`items.${index}.price`, breakdown.totalPrice);
            setValue(`items.${index}.fabricGroup`, breakdown.fabricGroup);
            setValue(`items.${index}.discountPercent`, breakdown.discountPercent);

            // Store breakdown for display
            setPriceBreakdown(breakdown);

            toast.success(`Price calculated: $${breakdown.totalPrice.toFixed(2)}`);
        } catch (error: any) {
            console.error('Price calculation error:', error);
            toast.error(error.response?.data?.error || 'Failed to calculate price');
        } finally {
            setCalculatingPrice(false);
        }
    };

    // Dropdown options
    const materials = getMaterials().map(m => ({ label: m, value: m }));
    const fabricTypes = material ? getFabricTypes(material).map(t => ({ label: t, value: t })) : [];
    const fabricColors = (material && fabricType) ? getFabricColors(material, fabricType).map(c => ({ label: c, value: c })) : [];

    return (
        <Card className={`mb-6 border-l-4 ${validationError ? 'border-l-red-600' : 'border-l-blue-600'}`}>
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

                {/* Validation Error Alert */}
                {validationError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{validationError}</span>
                    </div>
                )}

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

                {/* Installation Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-md">
                    <div className="space-y-2">
                        <Label>Fixing Type</Label>
                        <Select
                            {...register(`items.${index}.fixing`)}
                            options={toSelectOptions(FIXING_TYPES)}
                            placeholder="Select Fixing"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Control Side</Label>
                        <Select
                            {...register(`items.${index}.controlSide`)}
                            options={toSelectOptions(CONTROL_SIDES)}
                            placeholder="Select Side"
                        />
                    </div>
                </div>

                {/* Bracket Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50 p-4 rounded-md">
                    <div className="space-y-2">
                        <Label>Bracket Type</Label>
                        <Select
                            {...register(`items.${index}.bracketType`)}
                            options={toSelectOptions(BRACKET_TYPES)}
                            placeholder="Select Type"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Bracket Colour</Label>
                        <Select
                            {...register(`items.${index}.bracketColour`)}
                            options={toSelectOptions(BRACKET_COLOURS)}
                            placeholder="Select Colour"
                        />
                    </div>
                </div>

                {/* Motor/Chain Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-green-50 p-4 rounded-md">
                    <div className="space-y-2">
                        <Label>Chain/Motor</Label>
                        <Select
                            {...register(`items.${index}.chainOrMotor`)}
                            options={toSelectOptions(MOTORS)}
                            placeholder="Select Motor/Winder"
                        />
                    </div>
                    {showChainType && (
                        <div className="space-y-2">
                            <Label>Chain Type <span className="text-xs text-gray-500">(Winder only)</span></Label>
                            <Select
                                {...register(`items.${index}.chainType`)}
                                options={toSelectOptions(CHAIN_TYPES)}
                                placeholder="Select Chain"
                            />
                        </div>
                    )}
                </div>

                {/* Fabric Selection */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-purple-50 p-4 rounded-md">
                    <div className="space-y-2">
                        <Label>Roll Direction</Label>
                        <Select
                            {...register(`items.${index}.roll`)}
                            options={toSelectOptions(ROLL_DIRECTIONS)}
                            placeholder="Select Roll"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Material Brand</Label>
                        <Select
                            {...register(`items.${index}.material`, { required: 'Required' })}
                            options={materials}
                            placeholder="Select Brand"
                        />
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

                {/* Bottom Rail Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md">
                    <div className="space-y-2">
                        <Label>Bottom Rail Type</Label>
                        <Select
                            {...register(`items.${index}.bottomRailType`)}
                            options={toSelectOptions(BOTTOM_RAIL_TYPES)}
                            placeholder="Select Type"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Bottom Rail Colour</Label>
                        <Select
                            {...register(`items.${index}.bottomRailColour`)}
                            options={toSelectOptions(BOTTOM_RAIL_COLOURS)}
                            placeholder="Select Colour"
                        />
                    </div>
                </div>

                {/* Check Price Button & Breakdown */}
                <div className="border-t pt-4 mt-2">
                    <div className="flex items-center justify-between gap-4">
                        <Button
                            type="button"
                            onClick={handleCalculatePrice}
                            disabled={!canCalculatePrice || calculatingPrice}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Calculator className="h-4 w-4 mr-2" />
                            {calculatingPrice ? 'Calculating...' : 'Check Price'}
                        </Button>

                        {priceBreakdown && (
                            <div className="text-sm text-gray-600">
                                <span className="font-semibold">{priceBreakdown.componentsUsed.length} components</span>
                                {' • '}
                                <span>Fabric: ${priceBreakdown.fabricPrice.toFixed(2)}</span>
                                {priceBreakdown.motorChainPrice > 0 && (
                                    <span> + Motor: ${priceBreakdown.motorChainPrice.toFixed(2)}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Price Breakdown Details (Collapsible) */}
                    {priceBreakdown && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
                            <div className="font-semibold text-green-800 mb-2">Price Breakdown:</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-gray-700">
                                <div>Fabric: ${priceBreakdown.fabricPrice.toFixed(2)}</div>
                                <div>Motor/Chain: ${priceBreakdown.motorChainPrice.toFixed(2)}</div>
                                <div>Bracket: ${priceBreakdown.bracketPrice.toFixed(2)}</div>
                                <div>Chain: ${priceBreakdown.chainPrice.toFixed(2)}</div>
                                <div>Clips: ${priceBreakdown.clipsPrice.toFixed(2)}</div>
                                <div>Idler/Clutch: ${priceBreakdown.idlerClutchPrice.toFixed(2)}</div>
                                <div>Accessories: ${priceBreakdown.stopBoltSafetyLockPrice.toFixed(2)}</div>
                                <div className="font-bold text-green-700">Total: ${priceBreakdown.totalPrice.toFixed(2)}</div>
                            </div>
                        </div>
                    )}
                </div>

            </CardContent>
        </Card>
    );
}
