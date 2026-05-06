import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import {
    INSTALLATION_TYPES,
    SHEER_BRACKET_TYPES,
    SHEER_BRACKET_TYPES_CEILING,
    OPENING_TYPES,
    FULLNESS_OPTIONS,
    TRACK_TYPES,
    MOTOR_TYPES,
    TRACK_CONTROL_SIDES,
    REMOTE_OPTIONS,
    CHARGER_HUB_OPTIONS,
    TRACK_COLORS,
    BEND_TYPES,
} from '../../data/sheerHardware';
import { Upload, X } from 'lucide-react';
import { pricingApi, uploadBendDrawing, getBendDrawingUrl } from '../../services/api';
import { gooeyToast } from 'goey-toast';

interface FabricOption {
    fabricGroup: string;
    fabricName: string;
    pricePerMeter: number;
}

interface CurtainItemFormProps {
    index: number;
    curtainNumber?: number;
    highlightEmpty?: boolean;
}

export function CurtainItemForm({ index, curtainNumber, highlightEmpty = false }: CurtainItemFormProps) {
    const { register, setValue, control } = useFormContext();

    // Watch fields
    const location = useWatch({ control, name: `items.${index}.location` });
    const width = useWatch({ control, name: `items.${index}.width` });
    const drop = useWatch({ control, name: `items.${index}.drop` });
    const fabric = useWatch({ control, name: `items.${index}.fabric` });
    const fabricColour = useWatch({ control, name: `items.${index}.fabricColour` });
    const installation = useWatch({ control, name: `items.${index}.installation` });
    const bracketType = useWatch({ control, name: `items.${index}.bracketType` });
    const openingType = useWatch({ control, name: `items.${index}.openingType` });
    const fullness = useWatch({ control, name: `items.${index}.fullness` });
    const price = useWatch({ control, name: `items.${index}.price` });

    // Track Type section
    const requiresTracks = useWatch({ control, name: `items.${index}.requiresTracks` });
    const trackType = useWatch({ control, name: `items.${index}.trackType` });
    const motorType = useWatch({ control, name: `items.${index}.motorType` });
    const trackControlSide = useWatch({ control, name: `items.${index}.trackControlSide` });
    const trackColor = useWatch({ control, name: `items.${index}.trackColor` });
    const remotes = useWatch({ control, name: `items.${index}.remotes` });
    const chargerHub = useWatch({ control, name: `items.${index}.chargerHub` });

    // Bend section
    const requiresBentTracks = useWatch({ control, name: `items.${index}.requiresBentTracks` });
    const bendFilePath = useWatch({ control, name: `items.${index}.bendFilePath` });
    const bendType = useWatch({ control, name: `items.${index}.bendType` });
    const bendQty = useWatch({ control, name: `items.${index}.bendQty` });

    // Drop Deduction section
    const requiresDropDeduction = useWatch({ control, name: `items.${index}.requiresDropDeduction` });
    const dropDeductionValue = useWatch({ control, name: `items.${index}.dropDeductionValue` });

    // Fabrics fetched from API
    const [fabrics, setFabrics] = useState<FabricOption[]>([]);

    useEffect(() => {
        let cancelled = false;
        pricingApi
            .getAllSheerFabrics()
            .then((list) => {
                if (!cancelled) setFabrics(list);
            })
            .catch(() => {
                if (!cancelled) setFabrics([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const fabricOptions = useMemo(
        () => fabrics.map((f) => ({ label: f.fabricName, value: f.fabricName })),
        [fabrics]
    );

    const lookupFabricGroup = (fabricName?: string): string | undefined => {
        if (!fabricName) return undefined;
        return fabrics.find((f) => f.fabricName === fabricName)?.fabricGroup;
    };


    const [isUploading, setIsUploading] = useState(false);
    const autoCalcRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track type effects: motorised limits
    const isMotorised = trackType === 'Motorised' && requiresTracks;
    const widthLimit = 6000;

    // Reset motor-only fields when not motorised
    useEffect(() => {
        if (!isMotorised) {
            setValue(`items.${index}.motorType`, '');
            setValue(`items.${index}.remotes`, 'Not Required');
            setValue(`items.${index}.chargerHub`, 'Not Required');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMotorised, index]);

    // Bracket options depend on installation
    const isCeiling = installation === 'Ceiling';
    const bracketOptions = isCeiling
        ? SHEER_BRACKET_TYPES_CEILING.map((t) => ({ label: t, value: t }))
        : SHEER_BRACKET_TYPES.map((t) => ({ label: t, value: t }));

    // Default Bracket Type to "Ceiling" when installation switches to Ceiling
    useEffect(() => {
        if (isCeiling) {
            setValue(`items.${index}.bracketType`, 'Ceiling');
        } else if (bracketType === 'Ceiling') {
            setValue(`items.${index}.bracketType`, '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCeiling, index]);

    // Helper for empty field highlighting
    const emptyRing = (val: any) =>
        highlightEmpty && (!val || val === '' || val === 0)
            ? 'ring-2 ring-red-400'
            : '';

    // Check if pricing can be calculated
    const canCalculatePrice = Boolean(
        width && drop && fabric && openingType && fullness && bracketType &&
        (requiresDropDeduction === false || dropDeductionValue)
    );

    // Calculate pricing
    const calculateAndSetPrice = async () => {
        const fabricGroup = lookupFabricGroup(fabric);
        if (!fabricGroup) return 0;

        const result = await pricingApi.calculateCurtainPrice({
            width: Number(width),
            drop: Number(drop),
            openingType,
            fullness: Number(fullness),
            bracketType,
            fabric,
            fabricGroup,
            requiresDropDeduction: requiresDropDeduction !== false,
            dropDeductionValue: Number(dropDeductionValue) || 35,
            requiresTracks: !!requiresTracks,
            trackType: trackType || undefined,
            motorType: motorType || undefined,
            remotes: remotes || undefined,
            chargerHub: chargerHub || undefined,
        });

        setValue(`items.${index}.price`, result.total);
        setValue(`items.${index}.fabricGroup`, fabricGroup);
        setValue(`items.${index}.deductedDrop`, result.deductedDrop);
        setValue(`items.${index}.hookCount`, result.hookCount);
        setValue(`items.${index}.leftHooks`, result.leftHooks);
        setValue(`items.${index}.rightHooks`, result.rightHooks);
        setValue(`items.${index}.bracketCount`, result.bracketCount);
        setValue(`items.${index}.wandCount`, result.wandCount);
        setValue(`items.${index}.fabricLength`, result.fabricLength);
        setValue(`items.${index}.fabricMeters`, result.fabricMeters);
        setValue(`items.${index}.dropSurcharge`, result.dropSurcharge);
        setValue(`items.${index}.fabricCost`, result.fabricCost);
        setValue(`items.${index}.subtotal`, result.subtotal);
        setValue(`items.${index}.gst`, result.gst);
        setValue(`items.${index}.total`, result.total);

        return result.total;
    };

    // Auto-calculate price (debounced 800ms)
    useEffect(() => {
        if (!canCalculatePrice) return;
        if (fabrics.length === 0) return;
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
    }, [canCalculatePrice, width, drop, fabric, openingType, fullness, bracketType, requiresDropDeduction, dropDeductionValue, requiresTracks, trackType, motorType, remotes, chargerHub, index, fabrics.length]);

    // File upload handler
    const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.csv', '.xlsx', '.xlsm', '.pdf'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            gooeyToast.error('Invalid file type. Allowed: JPG, PNG, CSV, XLSX, XLSM, PDF');
            e.target.value = '';
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            gooeyToast.error('File too large. Maximum size is 10 MB.');
            e.target.value = '';
            return;
        }

        setIsUploading(true);
        try {
            const filePath = await uploadBendDrawing(file);
            setValue(`items.${index}.bendFilePath`, filePath);
        } catch (err) {
            console.error('File upload failed:', err);
        } finally {
            setIsUploading(false);
        }
    };

    const removeFile = () => {
        setValue(`items.${index}.bendFilePath`, '');
    };

    return (
        <Card className="border-2 border-slate-200">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                    <span>Curtain #{curtainNumber || index + 1}</span>
                    {price > 0 && (
                        <Badge variant="default" className="text-base px-3 py-1 bg-green-600">
                            ${Number(price).toFixed(2)}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* ---- DIMENSIONS ---- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label>Location / Room</Label>
                        <Input
                            {...register(`items.${index}.location`)}
                            placeholder="e.g., Living Room - Window 1"
                            className={emptyRing(location)}
                        />
                    </div>
                    <div>
                        <Label>Width (mm) (max 6000)</Label>
                        <Input
                            type="number"
                            {...register(`items.${index}.width`, { valueAsNumber: true })}
                            min={100}
                            max={widthLimit}
                            className={emptyRing(width)}
                        />
                        {width > 6000 && (
                            <p className="text-xs text-red-600 mt-1">
                                Maximum width is 6000mm
                            </p>
                        )}
                    </div>
                    <div>
                        <Label>Drop (mm)</Label>
                        <Input
                            type="number"
                            {...register(`items.${index}.drop`, { valueAsNumber: true })}
                            min={100}
                            className={emptyRing(drop)}
                        />
                        {drop > 3000 && (
                            <p className="text-xs text-orange-600 mt-1">
                                Drop exceeds 3000mm - surcharge applies
                            </p>
                        )}
                    </div>
                </div>

                {/* ---- TYPE & INSTALLATION (blue) ---- */}
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Curtain Type</Label>
                            <Select
                                {...register(`items.${index}.curtainType`)}
                                options={[{ label: 'S Fold', value: 'S Fold' }]}
                            />
                        </div>
                        <div>
                            <Label>Hem (mm)</Label>
                            <Select
                                {...register(`items.${index}.hem`)}
                                options={[{ label: '70', value: '70' }]}
                            />
                        </div>
                        <div>
                            <Label>Installation</Label>
                            <Select
                                {...register(`items.${index}.installation`)}
                                options={INSTALLATION_TYPES.map(t => ({ label: t, value: t }))}
                                className={emptyRing(installation)}
                            />
                        </div>
                    </div>
                </div>

                {/* ---- FABRIC (purple) ---- */}
                <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Fabric</Label>
                            <Select
                                {...register(`items.${index}.fabric`)}
                                options={fabricOptions}
                                placeholder={fabrics.length ? 'Select fabric...' : 'Loading fabrics...'}
                                className={emptyRing(fabric)}
                            />
                        </div>
                        <div>
                            <Label>Colour</Label>
                            <Input
                                {...register(`items.${index}.fabricColour`)}
                                placeholder="Enter fabric colour"
                                className={emptyRing(fabricColour)}
                            />
                        </div>
                    </div>
                </div>

                {/* ---- TRACK & OPENING (amber) ---- */}
                <div className="bg-amber-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Opening Type</Label>
                            <Select
                                {...register(`items.${index}.openingType`)}
                                options={OPENING_TYPES.map(t => ({ label: t, value: t }))}
                                className={emptyRing(openingType)}
                            />
                        </div>
                        <div>
                            <Label>Bracket Type</Label>
                            <Select
                                {...register(`items.${index}.bracketType`)}
                                options={bracketOptions}
                                className={emptyRing(bracketType)}
                            />
                        </div>
                        <div>
                            <Label>Fullness</Label>
                            <Select
                                {...register(`items.${index}.fullness`, { valueAsNumber: true })}
                                options={FULLNESS_OPTIONS.map(f => ({ label: String(f), value: String(f) }))}
                                className={emptyRing(fullness)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Wand Size (mm)</Label>
                            <Select
                                {...register(`items.${index}.wandSize`)}
                                options={[{ label: '1250', value: '1250' }]}
                                disabled
                            />
                        </div>
                    </div>
                </div>

                {/* ---- TRACK TYPE SECTION (teal) ---- */}
                <div className="bg-teal-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-4">
                        <Label className="font-semibold">Do you require tracks?</Label>
                        <div className="flex gap-3">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                    type="radio"
                                    value="false"
                                    checked={!requiresTracks}
                                    onChange={() => setValue(`items.${index}.requiresTracks`, false)}
                                />
                                <span className="text-sm">No</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                    type="radio"
                                    value="true"
                                    checked={requiresTracks === true}
                                    onChange={() => setValue(`items.${index}.requiresTracks`, true)}
                                />
                                <span className="text-sm">Yes</span>
                            </label>
                        </div>
                    </div>

                    {requiresTracks && (
                        <div className="space-y-3 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Track Type</Label>
                                    <Select
                                        {...register(`items.${index}.trackType`)}
                                        options={TRACK_TYPES.map(t => ({ label: t, value: t }))}
                                        className={emptyRing(trackType)}
                                    />
                                </div>
                                <div>
                                    <Label>Motor Type</Label>
                                    <Select
                                        {...register(`items.${index}.motorType`)}
                                        options={MOTOR_TYPES.map(t => ({ label: t, value: t }))}
                                        placeholder={isMotorised ? 'Select motor type...' : 'Motorised only'}
                                        disabled={!isMotorised}
                                        className={isMotorised ? emptyRing(motorType) : ''}
                                    />
                                </div>
                                <div>
                                    <Label>Track Control Side</Label>
                                    <Select
                                        {...register(`items.${index}.trackControlSide`)}
                                        options={TRACK_CONTROL_SIDES.map(t => ({ label: t, value: t }))}
                                        className={emptyRing(trackControlSide)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Remotes</Label>
                                    <Select
                                        {...register(`items.${index}.remotes`)}
                                        options={REMOTE_OPTIONS.map(t => ({ label: t, value: t }))}
                                        placeholder={isMotorised ? 'Select remote...' : 'Motorised only'}
                                        disabled={!isMotorised}
                                        className={isMotorised ? emptyRing(remotes) : ''}
                                    />
                                </div>
                                <div>
                                    <Label>Charger / Hub</Label>
                                    <Select
                                        {...register(`items.${index}.chargerHub`)}
                                        options={CHARGER_HUB_OPTIONS.map(t => ({ label: t, value: t }))}
                                        placeholder={isMotorised ? 'Select charger/hub...' : 'Motorised only'}
                                        disabled={!isMotorised}
                                        className={isMotorised ? emptyRing(chargerHub) : ''}
                                    />
                                </div>
                                <div>
                                    <Label>Track Color</Label>
                                    <Select
                                        {...register(`items.${index}.trackColor`)}
                                        options={TRACK_COLORS.map(t => ({ label: t, value: t }))}
                                        className={emptyRing(trackColor)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ---- BEND SECTION (rose) ---- */}
                <div className="bg-rose-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-4">
                        <Label className="font-semibold">Do you require bent tracks?</Label>
                        <div className="flex gap-3">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                    type="radio"
                                    value="false"
                                    checked={!requiresBentTracks}
                                    onChange={() => setValue(`items.${index}.requiresBentTracks`, false)}
                                />
                                <span className="text-sm">No</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                    type="radio"
                                    value="true"
                                    checked={requiresBentTracks === true}
                                    onChange={() => setValue(`items.${index}.requiresBentTracks`, true)}
                                />
                                <span className="text-sm">Yes</span>
                            </label>
                        </div>
                    </div>

                    {requiresBentTracks && (
                        <div className="space-y-3 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Bend Type</Label>
                                    <Select
                                        {...register(`items.${index}.bendType`)}
                                        options={BEND_TYPES.map(t => ({
                                            label: t,
                                            value: t,
                                        }))}
                                        className={emptyRing(bendType)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Angle: Attach drawings with angles and width. Radius: Provide a physical template.
                                    </p>
                                </div>
                                <div>
                                    <Label>Qty</Label>
                                    <Input
                                        type="number"
                                        {...register(`items.${index}.bendQty`, { valueAsNumber: true })}
                                        min={1}
                                        className={emptyRing(bendQty)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Attach File</Label>
                                {bendFilePath ? (
                                    <div className="flex items-center gap-2 mt-2 p-3 border border-green-300 bg-green-50 rounded-lg">
                                        <a
                                            href={getBendDrawingUrl(bendFilePath)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-green-700 underline truncate flex-1"
                                        >
                                            {bendFilePath.split('/').pop()}
                                        </a>
                                        <button
                                            type="button"
                                            onClick={removeFile}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center gap-2 cursor-pointer mt-2 px-6 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 bg-white transition-colors">
                                        <div className="p-2 bg-gray-100 rounded-lg">
                                            <Upload className="h-5 w-5 text-gray-500" />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-sm font-medium text-brand-gold">
                                                {isUploading ? 'Uploading...' : 'Click to upload'}
                                            </span>
                                            <span className="text-sm text-gray-500"> or drag and drop</span>
                                        </div>
                                        <p className="text-xs text-gray-400">
                                            JPG, PNG, CSV, XLSX, XLSM, PDF (max. 10 MB)
                                        </p>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".jpg,.jpeg,.png,.csv,.xlsx,.xlsm,.pdf"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ---- DROP DEDUCTION (orange) ---- */}
                <div className="bg-orange-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-4">
                        <Label className="font-semibold">Drop Deduction?</Label>
                        <div className="flex gap-3">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={requiresDropDeduction === false}
                                    onChange={() => setValue(`items.${index}.requiresDropDeduction`, false)}
                                />
                                <span className="text-sm">No</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={requiresDropDeduction !== false}
                                    onChange={() => setValue(`items.${index}.requiresDropDeduction`, true)}
                                />
                                <span className="text-sm">Yes</span>
                            </label>
                        </div>
                    </div>
                    {requiresDropDeduction !== false && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                            <div>
                                <Label>Deduction Amount (mm)</Label>
                                <select
                                    {...register(`items.${index}.dropDeductionValue`, { valueAsNumber: true })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    {[30, 35, 40, 50, 60].map(v => (
                                        <option key={v} value={v}>{v}mm</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
