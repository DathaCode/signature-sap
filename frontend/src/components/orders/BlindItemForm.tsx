import { useEffect, useRef, useState } from 'react';
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
import { Trash2, AlertCircle, Calculator, Copy, PlusCircle } from 'lucide-react';
import { pricingApi } from '../../services/api';
import toast from 'react-hot-toast';


interface BlindItemFormProps {
    index: number;
    onRemove?: () => void;
    onCopy?: () => void;
    onContinue?: () => void;
    canRemove?: boolean;
    blindNumber?: number;
}

export function BlindItemForm({ index, onRemove, onCopy, onContinue, canRemove = false, blindNumber }: BlindItemFormProps) {
    const { register, setValue, control, setError, clearErrors } = useFormContext();

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

    // Track previous values to only clear dependent fields on actual user change
    const prevMaterialRef = useRef<string | undefined>(material);
    const prevFabricTypeRef = useRef<string | undefined>(fabricType);
    const prevChainOrMotorRef = useRef<string | undefined>(chainOrMotor);
    const isInitialMount = useRef(true);

    // Show chain type dropdown only for winders
    const showChainType = chainOrMotor && isWinderMotor(chainOrMotor);

    // Check if all required fields are filled for pricing
    const canCalculatePrice = Boolean(
        width && drop && material && fabricType && fabricColour &&
        chainOrMotor && bracketType && bracketColour &&
        bottomRailType && bottomRailColour &&
        (!showChainType || chainType) // If winder, chain type is required
    );

    // Skip clearing on initial mount
    useEffect(() => {
        isInitialMount.current = false;
    }, []);

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

    // Reset dependent fields ONLY when the user actually changes the selection
    useEffect(() => {
        if (isInitialMount.current) return;
        if (prevMaterialRef.current !== undefined && prevMaterialRef.current !== material) {
            setValue(`items.${index}.fabricType`, '');
            setValue(`items.${index}.fabricColour`, '');
        }
        prevMaterialRef.current = material;
    }, [material, setValue, index]);

    useEffect(() => {
        if (isInitialMount.current) return;
        if (prevFabricTypeRef.current !== undefined && prevFabricTypeRef.current !== fabricType) {
            setValue(`items.${index}.fabricColour`, '');
        }
        prevFabricTypeRef.current = fabricType;
    }, [fabricType, setValue, index]);

    // Reset chain type when motor changes to non-winder
    useEffect(() => {
        if (isInitialMount.current) return;
        if (prevChainOrMotorRef.current !== undefined && prevChainOrMotorRef.current !== chainOrMotor) {
            if (chainOrMotor && !isWinderMotor(chainOrMotor)) {
                setValue(`items.${index}.chainType`, '');
            }
        }
        prevChainOrMotorRef.current = chainOrMotor;
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
                    <CardTitle className="text-lg">Blind #{blindNumber ?? index + 1}</CardTitle>
                    {price > 0 && (
                        <div className="flex items-center gap-2">
                            {discount > 0 && (
                                <>
                                    <Badge variant="outline" className="text-xs px-2 py-0.5 line-through text-gray-400">
                                        ${(() => {
                                            // Reverse-calculate pre-discount fabric price
                                            const otherComponents = (priceBreakdown?.motorChainPrice || 0) + (priceBreakdown?.bracketPrice || 0) +
                                                (priceBreakdown?.chainPrice || 0) + (priceBreakdown?.clipsPrice || 0) +
                                                (priceBreakdown?.idlerClutchPrice || 0) + (priceBreakdown?.stopBoltSafetyLockPrice || 0);
                                            const fabricOrig = (priceBreakdown?.fabricPrice || 0) / (1 - discount / 100);
                                            return (fabricOrig + otherComponents).toFixed(2);
                                        })()}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs px-2 py-0.5 text-orange-600">
                                        -{discount}%
                                    </Badge>
                                </>
                            )}
                            <Badge variant="success" className="text-sm px-3 py-1">
                                ${price.toFixed(2)}
                            </Badge>
                        </div>
                    )}
                </div>
                {canRemove && onRemove && (
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

                    {/* Price Breakdown Details */}
                    {priceBreakdown && (() => {
                        const otherComponents = priceBreakdown.motorChainPrice + priceBreakdown.bracketPrice +
                            priceBreakdown.chainPrice + priceBreakdown.clipsPrice +
                            priceBreakdown.idlerClutchPrice + priceBreakdown.stopBoltSafetyLockPrice;
                        const discPct = priceBreakdown.discountPercent || 0;
                        const fabricOriginal = discPct > 0
                            ? priceBreakdown.fabricPrice / (1 - discPct / 100)
                            : priceBreakdown.fabricPrice;
                        const subtotal = fabricOriginal + otherComponents;
                        const discountAmount = subtotal - priceBreakdown.totalPrice;

                        return (
                            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
                                <div className="font-semibold text-green-800 mb-2">Price Breakdown:</div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-gray-700">
                                    <div>Fabric: ${fabricOriginal.toFixed(2)}</div>
                                    <div>Motor/Chain: ${priceBreakdown.motorChainPrice.toFixed(2)}</div>
                                    <div>Bracket: ${priceBreakdown.bracketPrice.toFixed(2)}</div>
                                    <div>Chain: ${priceBreakdown.chainPrice.toFixed(2)}</div>
                                    <div>Clips: ${priceBreakdown.clipsPrice.toFixed(2)}</div>
                                    <div>Idler/Clutch: ${priceBreakdown.idlerClutchPrice.toFixed(2)}</div>
                                    <div>Accessories: ${priceBreakdown.stopBoltSafetyLockPrice.toFixed(2)}</div>
                                </div>
                                <div className="border-t border-green-300 mt-2 pt-2 space-y-1">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal:</span>
                                        <span>${subtotal.toFixed(2)}</span>
                                    </div>
                                    {discPct > 0 && (
                                        <div className="flex justify-between text-orange-600">
                                            <span>Discount (G{priceBreakdown.fabricGroup} - {discPct}%):</span>
                                            <span>-${discountAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-bold text-green-700 text-base">
                                        <span>Total:</span>
                                        <span>${priceBreakdown.totalPrice.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Copy & Continue Buttons (only when callbacks provided) */}
                    {(onCopy || onContinue) && (
                        <div className="flex gap-2 mt-3">
                            {onCopy && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={onCopy}
                                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                >
                                    <Copy className="h-4 w-4 mr-1" />
                                    Update & Copy
                                </Button>
                            )}
                            {onContinue && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={onContinue}
                                    className="text-green-600 border-green-300 hover:bg-green-50"
                                >
                                    <PlusCircle className="h-4 w-4 mr-1" />
                                    Update
                                </Button>
                            )}
                        </div>
                    )}
                </div>

            </CardContent>
        </Card>
    );
}
