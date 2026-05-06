import { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { BlindItemForm } from '../../components/orders/BlindItemForm';
import { CurtainItemForm } from '../../components/orders/CurtainItemForm';
import OrderSummary from '../../components/orders/OrderSummary';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Label } from '../../components/ui/Label';
import { Input } from '../../components/ui/Input';
import { ArrowLeft, Copy, PlusCircle, CheckCircle, X, ChevronDown, ChevronRight } from 'lucide-react';
import { BlindItem, CurtainItem, CreateOrderRequest, ProductType } from '../../types/order';
import { gooeyToast } from 'goey-toast';
import { confirmToast } from '../../utils/confirmToast';
import api, { pricingApi } from '../../services/api';
import { getSheerFabricGroup } from '../../data/sheerFabrics';

const emptyBlind: BlindItem = {
    location: '',
    width: 0,
    drop: 0,
    material: '',
    fabricType: '',
    fabricColour: '',
    fixing: 'Recess',
    controlSide: 'Right',
    bracketType: 'Single',
    bracketColour: 'White',
    chainOrMotor: 'Acmeda winder-29mm',
    chainType: 'Stainless Steel',
    roll: 'Back',
    bottomRailType: 'D30',
    bottomRailColour: 'Anodised',
    price: 0,
    fabricGroup: 1,
    discountPercent: 0,
};

const emptyCurtain: CurtainItem = {
    location: '',
    width: 0,
    drop: 0,
    curtainType: 'S Fold',
    hem: 70,
    fabric: '',
    fabricColour: '',
    installation: 'Wall',
    bracketType: 'Standard',
    openingType: 'Single Open',
    wandSize: 1250,
    fullness: 120,
    requiresTracks: false,
    trackType: 'Standard',
    trackControlSide: 'Right',
    trackColor: 'White',
    remotes: 'Not Required',
    chargerHub: 'Not Required',
    requiresBentTracks: false,
    bendType: 'Angle',
    requiresDropDeduction: true,
    dropDeductionValue: 35,
    price: 0,
};

export default function NewOrderPage() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productType, setProductType] = useState<ProductType>('BLINDS');
    const [savedBlinds, setSavedBlinds] = useState<BlindItem[]>([]);
    const [savedCurtains, setSavedCurtains] = useState<CurtainItem[]>([]);
    const [showSummary, setShowSummary] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [notes, setNotes] = useState('');
    const [customerReference, setCustomerReference] = useState('');
    const [siteAddress, setSiteAddress] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [dateRequired, setDateRequired] = useState('');
    const [highlightEmpty, setHighlightEmpty] = useState(false);
    const [step, setStep] = useState<'details' | 'items'>('details');
    const [expandedCurtain, setExpandedCurtain] = useState<number | null>(null);

    const isCurtain = productType === 'CURTAINS';
    const savedItems = isCurtain ? savedCurtains : savedBlinds;
    const itemLabel = isCurtain ? 'Curtain' : 'Blind';

    const methods = useForm<CreateOrderRequest>({
        defaultValues: {
            productType: 'BLINDS',
            items: [{ ...emptyBlind }]
        }
    });

    const { getValues, reset } = methods;

    // Auto-save draft to localStorage
    useEffect(() => {
        if (savedBlinds.length > 0 || savedCurtains.length > 0) {
            const draft = {
                productType,
                blinds: savedBlinds,
                curtains: savedCurtains,
                notes,
                customerReference,
                siteAddress,
                contactNumber,
                dateRequired,
                timestamp: Date.now(),
            };
            localStorage.setItem('order_draft', JSON.stringify(draft));
        }
    }, [savedBlinds, savedCurtains, notes, customerReference, siteAddress, contactNumber, dateRequired, productType]);

    // Restore draft on mount
    useEffect(() => {
        const draftStr = localStorage.getItem('order_draft');
        if (draftStr) {
            try {
                const draft = JSON.parse(draftStr);
                const hoursOld = (Date.now() - draft.timestamp) / (1000 * 60 * 60);
                const hasItems = (draft.blinds?.length > 0) || (draft.curtains?.length > 0);
                if (hoursOld < 24 && hasItems) {
                    const itemCount = (draft.blinds?.length || 0) + (draft.curtains?.length || 0);
                    const draftType = draft.productType || 'BLINDS';
                    confirmToast({
                        title: 'Restore Draft',
                        message: `You have an unsaved ${draftType === 'CURTAINS' ? 'curtain' : 'blind'} draft from ${new Date(draft.timestamp).toLocaleString()} with ${itemCount} item(s). Restore it?`,
                        confirmText: 'Restore',
                        cancelText: 'Discard',
                        variant: 'info',
                    }).then((confirmed) => {
                        if (confirmed) {
                            setProductType(draftType);
                            if (draft.blinds?.length > 0) setSavedBlinds(draft.blinds);
                            if (draft.curtains?.length > 0) setSavedCurtains(draft.curtains);
                            if (draft.notes) setNotes(draft.notes);
                            if (draft.customerReference) setCustomerReference(draft.customerReference);
                            if (draft.siteAddress) setSiteAddress(draft.siteAddress);
                            if (draft.contactNumber) setContactNumber(draft.contactNumber);
                            if (draft.dateRequired) setDateRequired(draft.dateRequired);
                            setStep('items');
                            // Reset form for correct product type
                            if (draftType === 'CURTAINS') {
                                reset({ productType: 'CURTAINS', items: [{ ...emptyCurtain }] });
                            }
                            gooeyToast.success('Draft restored!');
                        } else {
                            localStorage.removeItem('order_draft');
                        }
                    });
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

    // Handle product type change
    const handleProductTypeChange = (type: ProductType) => {
        if (savedItems.length > 0) return; // Lock once items added
        setProductType(type);
        if (type === 'CURTAINS') {
            reset({ productType: 'CURTAINS', items: [{ ...emptyCurtain }] });
        } else {
            reset({ productType: 'BLINDS', items: [{ ...emptyBlind }] });
        }
    };

    // Force-calculate price for blinds
    const forceCalculateBlindPrice = async (item: BlindItem): Promise<BlindItem> => {
        if ((item.price ?? 0) > 0) return item;
        if (!item.material || !item.fabricType || !item.fabricColour ||
            !item.chainOrMotor || !item.bracketType || !item.bracketColour ||
            !item.bottomRailType || !item.bottomRailColour) {
            return item;
        }
        try {
            const result = await pricingApi.calculateBlindPrice({
                material: item.material,
                fabricType: item.fabricType,
                fabricColour: item.fabricColour,
                width: item.width,
                drop: item.drop,
                chainOrMotor: item.chainOrMotor,
                chainType: item.chainType || undefined,
                bracketType: item.bracketType,
                bracketColour: item.bracketColour,
                bottomRailType: item.bottomRailType,
                bottomRailColour: item.bottomRailColour,
            });
            return {
                ...item,
                price: result.totalPrice,
                fabricPrice: result.fabricPrice,
                motorPrice: result.motorChainPrice,
                bracketPrice: result.bracketPrice,
                fabricGroup: result.fabricGroup,
                discountPercent: result.discountPercent,
            };
        } catch {
            return item;
        }
    };

    // Force-calculate price for curtains
    const forceCalculateCurtainPrice = async (item: CurtainItem): Promise<CurtainItem> => {
        if ((item.price ?? 0) > 0) return item;
        if (!item.fabric || !item.openingType || !item.fullness || !item.bracketType) return item;
        const fabricGroup = item.fabricGroup || getSheerFabricGroup(item.fabric);
        if (!fabricGroup) return item;
        try {
            const result = await pricingApi.calculateCurtainPrice({
                width: item.width,
                drop: item.drop,
                openingType: item.openingType,
                fullness: item.fullness,
                bracketType: item.bracketType,
                fabric: item.fabric,
                fabricGroup,
                requiresDropDeduction: item.requiresDropDeduction !== false,
                dropDeductionValue: item.dropDeductionValue ?? 35,
                requiresTracks: item.requiresTracks,
                trackType: item.trackType,
                motorType: item.motorType,
                remotes: item.remotes,
                chargerHub: item.chargerHub,
            });
            return { ...item, ...result, price: result.total };
        } catch {
            return item;
        }
    };

    // Discard current form
    const handleDiscardCurrentItem = async () => {
        const confirmed = await confirmToast({
            title: `Discard ${itemLabel}`,
            message: `Discard the current ${itemLabel.toLowerCase()} without saving?`,
            confirmText: 'Discard',
            cancelText: 'Keep Editing',
            variant: 'danger',
        });
        if (confirmed) {
            reset({ productType, items: (isCurtain ? [{ ...emptyCurtain }] : [{ ...emptyBlind }]) as any });
            setEditingIndex(null);
            setHighlightEmpty(false);
            if (savedItems.length > 0) {
                setShowSummary(true);
            }
        }
    };

    // Validate current blind
    const validateCurrentBlind = (): boolean => {
        const item = getValues('items.0') as BlindItem;
        const required: (keyof BlindItem)[] = [
            'location', 'width', 'drop', 'material', 'fabricType', 'fabricColour',
            'controlSide', 'roll', 'fixing', 'bracketType', 'bracketColour',
            'chainOrMotor', 'bottomRailType', 'bottomRailColour'
        ];

        let hasEmpty = false;
        for (const field of required) {
            const val = item[field];
            if (!val || val === '' || val === 0) { hasEmpty = true; break; }
        }

        const isWinder = item.chainOrMotor?.toLowerCase().includes('winder');
        if (isWinder && !item.chainType) hasEmpty = true;

        if (hasEmpty) { setHighlightEmpty(true); gooeyToast.error('Please complete all required fields'); return false; }

        if (item.chainOrMotor === 'TBS winder-32mm' && item.bracketType === 'Single Extension') {
            gooeyToast.error('Extended bracket is not available with TBS winder. Please select a different bracket type.');
            return false;
        }

        if (item.width < 200 || item.width > 3000) { gooeyToast.error('Width must be between 200mm and 3000mm'); return false; }
        if (item.drop < 200 || item.drop > 3000) { gooeyToast.error('Drop must be between 200mm and 3000mm'); return false; }

        setHighlightEmpty(false);
        return true;
    };

    // Validate current curtain
    const validateCurrentCurtain = (): boolean => {
        const item = getValues('items.0') as CurtainItem;
        const required: (keyof CurtainItem)[] = [
            'location', 'width', 'drop', 'fabric', 'fabricColour',
            'installation', 'bracketType', 'openingType', 'fullness'
        ];

        let hasEmpty = false;
        for (const field of required) {
            const val = item[field];
            if (!val || val === '' || val === 0) { hasEmpty = true; break; }
        }

        // If tracks required, validate track fields
        if (item.requiresTracks) {
            const trackRequired: (keyof CurtainItem)[] = ['trackType', 'trackControlSide', 'trackColor'];
            for (const field of trackRequired) {
                const val = item[field];
                if (!val || val === '') { hasEmpty = true; break; }
            }
            // If motorised, motor type is mandatory (remotes/chargerHub have "Not Required" option)
            if (item.trackType === 'Motorised') {
                const motorRequired: (keyof CurtainItem)[] = ['motorType'];
                for (const field of motorRequired) {
                    const val = item[field];
                    if (!val || val === '') { hasEmpty = true; break; }
                }
            }
        }

        if (hasEmpty) { setHighlightEmpty(true); gooeyToast.error('Please complete all required fields'); return false; }
        if (item.width < 100) { gooeyToast.error('Width must be at least 100mm'); return false; }
        if (item.width > 6000) { gooeyToast.error('Maximum width is 6000mm'); return false; }
        if (item.drop < 100) { gooeyToast.error('Drop must be at least 100mm'); return false; }

        setHighlightEmpty(false);
        return true;
    };

    const validateCurrentItem = () => isCurtain ? validateCurrentCurtain() : validateCurrentBlind();

    const isPartiallyFilled = (): boolean => {
        const item = getValues('items.0');
        return !!(item.location || (item.width && item.width > 0) || (item.drop && item.drop > 0));
    };

    // Save and copy
    const handleUpdateAndCopy = async () => {
        if (!validateCurrentItem()) {
            return;
        }

        if (isCurtain) {
            let item = await forceCalculateCurtainPrice({ ...getValues('items.0') as CurtainItem });
            if (editingIndex !== null) {
                const updated = [...savedCurtains];
                updated[editingIndex] = item;
                setSavedCurtains(updated);
                setEditingIndex(null);
            } else {
                setSavedCurtains([...savedCurtains, item]);
            }
            gooeyToast.success(`${itemLabel} saved! Fields copied (except Location, Width, Drop).`);
            reset({
                productType: 'CURTAINS',
                items: [{ ...item, location: '', width: 0, drop: 0, price: 0 }]
            });
        } else {
            let item = await forceCalculateBlindPrice({ ...getValues('items.0') as BlindItem });
            if (editingIndex !== null) {
                const updated = [...savedBlinds];
                updated[editingIndex] = item;
                setSavedBlinds(updated);
                setEditingIndex(null);
            } else {
                setSavedBlinds([...savedBlinds, item]);
            }
            gooeyToast.success(`${itemLabel} saved! Fields copied (except Location, Width, Drop).`);
            reset({
                productType: 'BLINDS',
                items: [{ ...item, location: '', width: 0, drop: 0, price: 0, fabricGroup: item.fabricGroup, discountPercent: 0 }]
            });
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Save and clear
    const handleUpdateAndContinueAdding = async () => {
        if (!validateCurrentItem()) {
            return;
        }

        if (isCurtain) {
            let item = await forceCalculateCurtainPrice({ ...getValues('items.0') as CurtainItem });
            if (editingIndex !== null) {
                const updated = [...savedCurtains];
                updated[editingIndex] = item;
                setSavedCurtains(updated);
                setEditingIndex(null);
                reset({ productType: 'CURTAINS', items: [{ ...emptyCurtain }] });
                setShowSummary(true);
                return;
            }
            setSavedCurtains([...savedCurtains, item]);
            gooeyToast.success(`${itemLabel} #${savedCurtains.length + 1} saved! Ready for next.`);
            reset({ productType: 'CURTAINS', items: [{ ...emptyCurtain }] });
        } else {
            let item = await forceCalculateBlindPrice({ ...getValues('items.0') as BlindItem });
            if (editingIndex !== null) {
                const updated = [...savedBlinds];
                updated[editingIndex] = item;
                setSavedBlinds(updated);
                setEditingIndex(null);
                reset({ productType: 'BLINDS', items: [{ ...emptyBlind }] });
                setShowSummary(true);
                return;
            }
            setSavedBlinds([...savedBlinds, item]);
            gooeyToast.success(`${itemLabel} #${savedBlinds.length + 1} saved! Ready for next.`);
            reset({ productType: 'BLINDS', items: [{ ...emptyBlind }] });
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Finish and review
    const handleFinishAndReview = async () => {
        if (isPartiallyFilled()) {
            if (!validateCurrentItem()) {
                gooeyToast.error(`Please complete all fields for the current ${itemLabel.toLowerCase()} or clear them to proceed`);
                return;
            }
            if (isCurtain) {
                const item = await forceCalculateCurtainPrice({ ...getValues('items.0') as CurtainItem });
                setSavedCurtains(prev => [...prev, item]);
            } else {
                const item = await forceCalculateBlindPrice({ ...getValues('items.0') as BlindItem });
                setSavedBlinds(prev => [...prev, item]);
            }
        }

        if (savedItems.length === 0 && !isPartiallyFilled()) {
            gooeyToast.error(`Please add at least one ${itemLabel.toLowerCase()} to proceed`);
            return;
        }

        setShowSummary(true);
    };

    // Edit a saved item
    const handleEditItem = (index: number) => {
        if (isCurtain) {
            reset({ productType: 'CURTAINS', items: [{ ...savedCurtains[index] }] });
        } else {
            reset({ productType: 'BLINDS', items: [{ ...savedBlinds[index] }] });
        }
        setEditingIndex(index);
        setShowSummary(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        gooeyToast.info(`Editing ${itemLabel} #${index + 1}`);
    };

    // Delete a saved item
    const handleDeleteItem = async (index: number) => {
        if (!await confirmToast({ title: `Delete ${itemLabel}`, message: `Are you sure you want to delete ${itemLabel} #${index + 1}?`, confirmText: 'Delete', variant: 'danger' })) return;
        if (isCurtain) {
            const updated = savedCurtains.filter((_, i) => i !== index);
            setSavedCurtains(updated);
            if (updated.length === 0) setShowSummary(false);
        } else {
            const updated = savedBlinds.filter((_, i) => i !== index);
            setSavedBlinds(updated);
            if (updated.length === 0) setShowSummary(false);
        }
        gooeyToast.success(`${itemLabel} #${index + 1} deleted`);
    };

    // Bulk delete
    const handleBulkDelete = async (indices: number[]) => {
        if (!await confirmToast({
            title: `Delete ${itemLabel}s`,
            message: `Delete ${indices.length} selected ${itemLabel.toLowerCase()}(s)? This cannot be undone.`,
            confirmText: 'Delete',
            variant: 'danger',
        })) return;
        const indexSet = new Set(indices);
        if (isCurtain) {
            const updated = savedCurtains.filter((_, i) => !indexSet.has(i));
            setSavedCurtains(updated);
            if (updated.length === 0) setShowSummary(false);
        } else {
            const updated = savedBlinds.filter((_, i) => !indexSet.has(i));
            setSavedBlinds(updated);
            if (updated.length === 0) setShowSummary(false);
        }
        gooeyToast.success(`${indices.length} ${itemLabel.toLowerCase()}(s) deleted`);
    };

    // Bulk update (blinds only for now)
    const handleBulkUpdate = async (indices: number[], fields: Partial<BlindItem>) => {
        const updated = savedBlinds.map((blind, i) =>
            indices.includes(i) ? { ...blind, ...fields, price: 0 } : blind
        );
        setSavedBlinds(updated);
        gooeyToast.info(`Recalculating prices for ${indices.length} blind(s)...`);

        const recalculated = [...updated];
        for (const idx of indices) {
            recalculated[idx] = await forceCalculateBlindPrice(recalculated[idx]);
        }
        setSavedBlinds(recalculated);
        gooeyToast.success(`${indices.length} blind(s) updated!`);
    };

    // Submit as order
    const handleSubmitOrder = async () => {
        if (!customerReference.trim()) {
            gooeyToast.error('Customer reference is required');
            return;
        }
        setIsSubmitting(true);
        try {
            const data: CreateOrderRequest = {
                productType,
                items: isCurtain ? savedCurtains : savedBlinds,
                notes: notes || undefined,
                customerReference: customerReference || undefined,
                siteAddress: siteAddress || undefined,
                contactNumber: contactNumber || undefined,
                dateRequired: dateRequired || undefined,
            };
            await api.post('/web-orders/create', data);
            clearDraft();
            gooeyToast.success('Order placed successfully!');
            navigate('/dashboard');
        } catch (error: any) {
            console.error(error);
            gooeyToast.error(error.response?.data?.message || 'Failed to place order');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Save as quote
    const handleSaveAsQuote = async () => {
        setIsSubmitting(true);
        try {
            await api.post('/quotes/create', {
                productType,
                items: isCurtain ? savedCurtains : savedBlinds,
                notes: notes || undefined,
                customerReference: customerReference || undefined,
                siteAddress: siteAddress || undefined,
                contactNumber: contactNumber || undefined,
                dateRequired: dateRequired || undefined,
            });
            clearDraft();
            gooeyToast.success('Quote saved successfully!');
            navigate('/quotes');
        } catch (error: any) {
            console.error(error);
            gooeyToast.error(error.response?.data?.message || 'Failed to save quote');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Summary view
    if (showSummary) {
        // For now reuse OrderSummary for blinds; curtains show a simple table
        if (isCurtain) {
            return (
                <div className="space-y-6 max-w-5xl mx-auto p-6 pb-24">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => {
                            reset({ productType: 'CURTAINS', items: [{ ...emptyCurtain }] });
                            setEditingIndex(null);
                            setShowSummary(false);
                        }}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-3xl font-bold">Review Curtain Order</h1>
                    </div>

                    {/* Customer Reference */}
                    <Card className="border-l-4 border-l-indigo-500">
                        <CardContent className="py-4">
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                <div className="space-y-1 flex-1 max-w-md">
                                    <Label>Your Reference <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={customerReference}
                                        onChange={(e) => setCustomerReference(e.target.value)}
                                        placeholder="e.g. Smith Kitchen, House-123"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Curtain items - expandable cards */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{savedCurtains.length} Sheer{savedCurtains.length !== 1 ? 's' : ''}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {savedCurtains.map((curtain, i) => {
                                const isOpen = expandedCurtain === i;
                                return (
                                    <div key={i} className="border rounded-lg overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedCurtain(isOpen ? null : i)}
                                            className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 text-left"
                                        >
                                            {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                            <span className="font-semibold w-12">#{i + 1}</span>
                                            <span className="flex-1 truncate">{curtain.location || '(no location)'}</span>
                                            <span className="text-sm text-gray-600">{curtain.width} x {curtain.drop}mm</span>
                                            <span className="text-sm text-gray-600">{curtain.fabric} - {curtain.fabricColour}</span>
                                            <span className="font-semibold text-green-700 w-24 text-right">${(curtain.price || 0).toFixed(2)}</span>
                                        </button>
                                        {isOpen && (
                                            <div className="p-4 bg-white space-y-2 text-sm">
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                                                    <div><span className="text-gray-500">Curtain Type:</span> <strong>{curtain.curtainType}</strong></div>
                                                    <div><span className="text-gray-500">Hem:</span> <strong>{curtain.hem}mm</strong></div>
                                                    <div><span className="text-gray-500">Installation:</span> <strong>{curtain.installation}</strong></div>
                                                    <div><span className="text-gray-500">Opening:</span> <strong>{curtain.openingType}</strong></div>
                                                    <div><span className="text-gray-500">Bracket:</span> <strong>{curtain.bracketType}</strong></div>
                                                    <div><span className="text-gray-500">Fullness:</span> <strong>{curtain.fullness}</strong></div>
                                                    <div><span className="text-gray-500">Wand:</span> <strong>{curtain.wandSize}mm</strong></div>
                                                    <div><span className="text-gray-500">Tracks:</span> <strong>{curtain.requiresTracks ? 'Yes' : 'No'}</strong></div>
                                                    {curtain.requiresTracks && (
                                                        <>
                                                            <div><span className="text-gray-500">Track Type:</span> <strong>{curtain.trackType || '-'}</strong></div>
                                                            <div><span className="text-gray-500">Track Color:</span> <strong>{curtain.trackColor || '-'}</strong></div>
                                                            <div><span className="text-gray-500">Control Side:</span> <strong>{curtain.trackControlSide || '-'}</strong></div>
                                                            {curtain.trackType === 'Motorised' && (
                                                                <>
                                                                    <div><span className="text-gray-500">Motor:</span> <strong>{curtain.motorType || '-'}</strong></div>
                                                                    <div><span className="text-gray-500">Remote:</span> <strong>{curtain.remotes || '-'}</strong></div>
                                                                    <div><span className="text-gray-500">Charger/Hub:</span> <strong>{curtain.chargerHub || '-'}</strong></div>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                    <div><span className="text-gray-500">Bent Tracks:</span> <strong>{curtain.requiresBentTracks ? 'Yes' : 'No'}</strong></div>
                                                    {curtain.requiresBentTracks && (
                                                        <>
                                                            <div><span className="text-gray-500">Bend Type:</span> <strong>{curtain.bendType || '-'}</strong></div>
                                                            <div><span className="text-gray-500">Bend Qty:</span> <strong>{curtain.bendQty || '-'}</strong></div>
                                                            {curtain.bendFilePath && <div className="col-span-2 md:col-span-3"><span className="text-gray-500">Drawing:</span> <strong className="text-blue-700">{curtain.bendFilePath.split('/').pop()}</strong></div>}
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 pt-2 border-t">
                                                    <button type="button" onClick={() => handleEditItem(i)} className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 rounded hover:bg-blue-50 border border-blue-200">Edit</button>
                                                    <button type="button" onClick={() => handleDeleteItem(i)} className="text-red-600 hover:text-red-800 text-sm px-3 py-1 rounded hover:bg-red-50 border border-red-200">Delete</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="flex justify-end pt-2 border-t font-bold text-lg">
                                Total: <span className="ml-3 text-green-700">${savedCurtains.reduce((sum, c) => sum + (c.price || 0), 0).toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card>
                        <CardContent className="py-4">
                            <Label>Order Notes (optional)</Label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="mt-2 w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                                placeholder="Any special instructions..."
                            />
                        </CardContent>
                    </Card>

                    {/* Action buttons */}
                    <div className="flex gap-4 flex-wrap">
                        <button
                            type="button"
                            onClick={() => {
                                reset({ productType: 'CURTAINS', items: [{ ...emptyCurtain }] });
                                setEditingIndex(null);
                                setShowSummary(false);
                            }}
                            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200"
                        >
                            + Add More Curtains
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveAsQuote}
                            disabled={isSubmitting}
                            className="bg-amber-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50"
                        >
                            Save as Quote
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmitOrder}
                            disabled={isSubmitting}
                            className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Placing Order...' : 'Place Order'}
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6 max-w-5xl mx-auto p-6 pb-24">
                <OrderSummary
                    blinds={savedBlinds}
                    onEdit={handleEditItem}
                    onDelete={handleDeleteItem}
                    onBulkDelete={handleBulkDelete}
                    onBulkUpdate={handleBulkUpdate}
                    onBackToForm={() => {
                        reset({ productType: 'BLINDS', items: [{ ...emptyBlind }] });
                        setEditingIndex(null);
                        setShowSummary(false);
                    }}
                    onSubmitOrder={handleSubmitOrder}
                    onSaveAsQuote={handleSaveAsQuote}
                    isSubmitting={isSubmitting}
                    notes={notes}
                    onNotesChange={setNotes}
                    customerReference={customerReference}
                />
            </div>
        );
    }

    // STEP 1: Order details & product selection
    if (step === 'details') {
        return (
            <div className="space-y-6 max-w-5xl mx-auto p-6 pb-24">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Create New Order</h1>
                        <p className="text-gray-500 mt-1">Enter customer details & select product type</p>
                    </div>
                </div>

                {/* Order Reference & Customer Details Card — FIRST */}
                <Card className="border-l-4 border-l-indigo-500">
                    <CardHeader className="py-4">
                        <CardTitle className="text-lg">Order Reference & Customer Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="customerReference">Your Reference <span className="text-red-500">*</span></Label>
                                <Input
                                    id="customerReference"
                                    value={customerReference}
                                    onChange={(e) => setCustomerReference(e.target.value)}
                                    placeholder="e.g. Smith Kitchen, House-123"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dateRequired">Date Required By</Label>
                                <Input
                                    id="dateRequired"
                                    type="date"
                                    value={dateRequired}
                                    onChange={(e) => setDateRequired(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="siteAddress">Site Address / Location</Label>
                                <Input
                                    id="siteAddress"
                                    value={siteAddress}
                                    onChange={(e) => setSiteAddress(e.target.value)}
                                    placeholder="Delivery / installation address"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactNumber">Contact No.</Label>
                                <Input
                                    id="contactNumber"
                                    value={contactNumber}
                                    onChange={(e) => setContactNumber(e.target.value)}
                                    placeholder="e.g. 04xx xxx xxx"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Reference is visible on your invoice, quotes, and order history.
                        </p>
                    </CardContent>
                </Card>

                {/* Product Type Selector — SECOND */}
                <Card className="border-l-4 border-l-brand-gold">
                    <CardContent className="py-4">
                        <Label className="font-semibold text-base">Product Type</Label>
                        <div className="flex flex-wrap gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => handleProductTypeChange('BLINDS')}
                                disabled={savedItems.length > 0}
                                className={`px-6 py-3 rounded-lg font-semibold transition-all ${productType === 'BLINDS'
                                    ? 'bg-brand-gold text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    } ${savedItems.length > 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Block Out Blinds
                            </button>
                            <button
                                type="button"
                                onClick={() => handleProductTypeChange('CURTAINS')}
                                disabled={savedItems.length > 0}
                                className={`px-6 py-3 rounded-lg font-semibold transition-all ${productType === 'CURTAINS'
                                    ? 'bg-brand-gold text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    } ${savedItems.length > 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Sheers
                            </button>
                            {/* Coming Soon buttons */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled
                                    className="px-6 py-3 rounded-lg font-semibold bg-gray-100 text-gray-400 cursor-not-allowed opacity-70"
                                >
                                    Plantation Shutters
                                </button>
                                <span className="absolute -top-2 -right-2 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">Soon</span>
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled
                                    className="px-6 py-3 rounded-lg font-semibold bg-gray-100 text-gray-400 cursor-not-allowed opacity-70"
                                >
                                    Outdoor Blinds
                                </button>
                                <span className="absolute -top-2 -right-2 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">Soon</span>
                            </div>
                        </div>
                        {savedItems.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">Product type is locked once items are added.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Next Button */}
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            if (!customerReference.trim()) {
                                gooeyToast.error('Please enter Your Reference to continue');
                                return;
                            }
                            setStep('items');
                        }}
                        className="bg-gradient-to-r from-brand-gold to-amber-500 text-white px-8 py-4 rounded-lg font-bold text-lg hover:shadow-lg transition-all inline-flex items-center gap-2"
                    >
                        Next — Add {productType === 'CURTAINS' ? 'Sheers' : 'Blinds'}
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        );
    }

    // STEP 2: Form view
    return (
        <FormProvider {...methods}>
            <div className="space-y-6 max-w-5xl mx-auto p-6 pb-24">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setStep('details')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Create New Order</h1>
                        <p className="text-gray-500 mt-1">
                            {editingIndex !== null
                                ? `Editing ${itemLabel} #${editingIndex + 1}`
                                : savedItems.length === 0
                                    ? `Add your first ${itemLabel.toLowerCase()}`
                                    : `Adding ${itemLabel} #${savedItems.length + 1}`
                            }
                        </p>
                    </div>
                </div>

                {/* Item Form */}
                <form className="space-y-6">
                    {isCurtain ? (
                        <CurtainItemForm
                            index={0}
                            curtainNumber={editingIndex !== null ? editingIndex + 1 : savedCurtains.length + 1}
                            highlightEmpty={highlightEmpty}
                        />
                    ) : (
                        <BlindItemForm
                            index={0}
                            blindNumber={editingIndex !== null ? editingIndex + 1 : savedBlinds.length + 1}
                            highlightEmpty={highlightEmpty}
                        />
                    )}

                    {/* ACTION BUTTONS */}
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6">
                        <div className="flex gap-4 flex-wrap">
                            <button
                                type="button"
                                onClick={handleUpdateAndCopy}
                                className="flex-1 min-w-[200px] bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:from-blue-600 hover:to-blue-700 transition-all hover:shadow-lg"
                            >
                                <Copy className="h-5 w-5" />
                                {editingIndex !== null ? 'Update & Copy' : 'Add & Copy'}
                            </button>

                            <button
                                type="button"
                                onClick={handleUpdateAndContinueAdding}
                                className="flex-1 min-w-[200px] bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:from-green-600 hover:to-green-700 transition-all hover:shadow-lg"
                            >
                                <PlusCircle className="h-5 w-5" />
                                {editingIndex !== null ? 'Update' : 'Add'}
                            </button>

                            <button
                                type="button"
                                onClick={handleDiscardCurrentItem}
                                className="bg-gray-200 text-gray-700 px-6 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:bg-gray-300 transition-all"
                            >
                                <X className="h-5 w-5" />
                                Cancel
                            </button>
                        </div>

                        {editingIndex === null && savedItems.length > 0 && (
                            <div className="pt-6 border-t border-gray-300 mt-6 text-center">
                                <button
                                    type="button"
                                    onClick={handleFinishAndReview}
                                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-purple-600 hover:to-purple-700 transition-all hover:shadow-lg inline-flex items-center gap-2"
                                >
                                    <CheckCircle className="h-5 w-5" />
                                    Finish & Review Order ({savedItems.length + 1} {itemLabel.toLowerCase()}{savedItems.length + 1 !== 1 ? 's' : ''})
                                </button>
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </FormProvider>
    );
}
