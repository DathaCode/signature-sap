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
    FIXING_TYPES,
    BRACKET_TYPES,
    BRACKET_COLOURS,
    CHAIN_TYPES,
    BOTTOM_RAIL_TYPES,
    BOTTOM_RAIL_COLOURS,
    CONTROL_SIDES,
    ROLL_DIRECTIONS,
    MOTOR_OPTIONS,
    toSelectOptions,
    isWinderMotor,
    isTBSExtendedInvalid
} from '../../data/hardware';
import { Trash2, AlertCircle, Copy, PlusCircle } from 'lucide-react';
import { pricingApi } from '../../services/api';

interface SimplePriceBreakdown {
    fabricBase: number;
    motorPrice: number;
    bracketPrice: number;
}

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
    const [priceBreakdown, setPriceBreakdown] = useState<SimplePriceBreakdown | null>(null);

    // Track previous values to only clear dependent fields on actual user change
    const prevMaterialRef = useRef<string | undefined>(material);
    const prevFabricTypeRef = useRef<string | undefined>(fabricType);
    const prevChainOrMotorRef = useRef<string | undefined>(chainOrMotor);
    const isInitialMount = useRef(true);
    const autoCalcRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Show chain type dropdown only for winders
    const showChainType = chainOrMotor && isWinderMotor(chainOrMotor);

    // Check if all required fields are filled for pricing
    const canCalculatePrice = Boolean(
        width && drop && material && fabricType && fabricColour &&
        chainOrMotor && bracketType && bracketColour &&
        bottomRailType && bottomRailColour &&
        (!showChainType || chainType)
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

    // Reset dependent fields ONLY when the new selection makes the existing value invalid
    useEffect(() => {
        if (isInitialMount.current) return;
        if (prevMaterialRef.current !== undefined && prevMaterialRef.current !== material) {
            const validTypes = material ? getFabricTypes(material) : [];
            if (fabricType && !validTypes.includes(fabricType)) {
                setValue(`items.${index}.fabricType`, '');
                setValue(`items.${index}.fabricColour`, '');
            }
        }
        prevMaterialRef.current = material;
    }, [material, fabricType, setValue, index]);

    useEffect(() => {
        if (isInitialMount.current) return;
        if (prevFabricTypeRef.current !== undefined && prevFabricTypeRef.current !== fabricType) {
            const validColors = (material && fabricType) ? getFabricColors(material, fabricType) : [];
            if (fabricColour && !validColors.includes(fabricColour)) {
                setValue(`items.${index}.fabricColour`, '');
            }
        }
        prevFabricTypeRef.current = fabricType;
    }, [fabricType, fabricColour, material, setValue, index]);

    // Reset chain type when motor changes to non-winder
    // Also force Oval bottom rail when TBS winder is selected
    useEffect(() => {
        if (isInitialMount.current) return;
        if (prevChainOrMotorRef.current !== undefined && prevChainOrMotorRef.current !== chainOrMotor) {
            if (chainOrMotor && !isWinderMotor(chainOrMotor)) {
                setValue(`items.${index}.chainType`, '');
            }
            // TBS winder only supports Oval bottom rail
            if (chainOrMotor === 'TBS winder-32mm' && bottomRailType === 'D30') {
                setValue(`items.${index}.bottomRailType`, 'Oval');
            }
        }
        prevChainOrMotorRef.current = chainOrMotor;
    }, [chainOrMotor, bottomRailType, setValue, index]);

    // Shared price calculation logic — uses comprehensive pricing (fabric + motor + bracket)
    const calculateAndSetPrice = async () => {
        const result = await pricingApi.calculateBlindPrice({
            material,
            fabricType,
            fabricColour,
            width: Number(width),
            drop: Number(drop),
            chainOrMotor,
            chainType: chainType || undefined,
            bracketType,
            bracketColour,
            bottomRailType,
            bottomRailColour,
        });

        const totalPrice = result.totalPrice;
        const fabricBase = result.fabricBasePrice;  // pre-discount fabric price

        setValue(`items.${index}.price`, totalPrice);
        setValue(`items.${index}.fabricGroup`, result.fabricGroup);
        setValue(`items.${index}.discountPercent`, result.discountPercent);
        setValue(`items.${index}.fabricPrice`, result.fabricPrice);   // discounted fabric
        setValue(`items.${index}.motorPrice`, result.motorChainPrice);
        setValue(`items.${index}.bracketPrice`, result.bracketPrice);

        setPriceBreakdown({ fabricBase, motorPrice: result.motorChainPrice, bracketPrice: result.bracketPrice });

        return totalPrice;
    };

    // Auto-calculate price when all required fields are filled (debounced)
    useEffect(() => {
        if (!canCalculatePrice) return;
        if (autoCalcRef.current) clearTimeout(autoCalcRef.current);

        autoCalcRef.current = setTimeout(async () => {
            try {
                await calculateAndSetPrice();
            } catch {
                // Silent fail for auto-calculate
            }
        }, 800);

        return () => { if (autoCalcRef.current) clearTimeout(autoCalcRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canCalculatePrice, width, drop, material, fabricType, fabricColour, chainOrMotor, chainType, bracketType, bracketColour, bottomRailType, bottomRailColour, controlSide, showChainType, index]);


    // Dropdown options
    const materials = getMaterials().map(m => ({ label: m, value: m }));
    const fabricTypes = material ? getFabricTypes(material).map(t => ({ label: t, value: t })) : [];
    const fabricColors = (material && fabricType) ? getFabricColors(material, fabricType).map(c => ({ label: c, value: c })) : [];

    // Strikethrough price (fabric base, before discount)
    const strikethroughPrice = priceBreakdown ? priceBreakdown.fabricBase : null;

    return (
        <Card className={`mb-6 border-l-4 ${validationError ? 'border-l-red-600' : 'border-l-blue-600'}`}>
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-4">
                    <CardTitle className="text-lg">Blind #{blindNumber ?? index + 1}</CardTitle>
                    {price > 0 && (
                        <div className="flex items-center gap-2">
                            {discount > 0 && strikethroughPrice != null && (
                                <>
                                    <Badge variant="outline" className="text-xs px-2 py-0.5 line-through text-gray-400">
                                        ${strikethroughPrice.toFixed(2)}
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
                            {...register(`items.${index}.width`, { required: 'Required', valueAsNumber: true, min: 200, max: 3000 })}
                            placeholder="Width"
                        />
                        {Number(width) > 0 && (Number(width) < 200 || Number(width) > 3000) && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Width must be between 200mm and 3000mm
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Drop (mm)</Label>
                        <Input
                            type="number"
                            {...register(`items.${index}.drop`, { required: 'Required', valueAsNumber: true, min: 200, max: 3000 })}
                            placeholder="Drop"
                        />
                        {Number(drop) > 0 && (Number(drop) < 200 || Number(drop) > 3000) && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Drop must be between 200mm and 3000mm
                            </p>
                        )}
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
                            options={MOTOR_OPTIONS}
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
                            options={BOTTOM_RAIL_TYPES.map(t => ({
                                label: t,
                                value: t,
                                disabled: chainOrMotor === 'TBS winder-32mm' && t === 'D30',
                            }))}
                            placeholder="Select Type"
                        />
                        {chainOrMotor === 'TBS winder-32mm' && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                TBS Winder requires Oval bottom rail only
                            </p>
                        )}
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

                {/* Action Buttons */}
                <div className="border-t pt-4 mt-2">
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
