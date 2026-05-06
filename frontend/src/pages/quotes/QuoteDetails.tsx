import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Loader2, ArrowLeft, ShoppingCart, Calendar, ChevronDown, ChevronUp, Pencil, Save, X, Plus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { gooeyToast } from 'goey-toast';
import { confirmToast } from '../../utils/confirmToast';
import api, { quoteApi, pricingApi } from '../../services/api';
import { FABRIC_DATA } from '../../utils/pricing';
import {
    OPENING_TYPES,
    FULLNESS_OPTIONS,
    SHEER_BRACKET_TYPES,
    INSTALLATION_TYPES,
    TRACK_TYPES,
    MOTOR_TYPES,
    TRACK_CONTROL_SIDES,
    REMOTE_OPTIONS,
    CHARGER_HUB_OPTIONS,
    TRACK_COLORS,
} from '../../data/sheerHardware';
import { getSheerFabricGroup } from '../../data/sheerFabrics';

const BRACKET_TYPES = ['Single', 'Single Extension', 'Dual Left', 'Dual Right'];
const BRACKET_COLOURS = ['White', 'Black', 'Dune', 'Bone', 'Anodised'];
const RAIL_TYPES = ['D30', 'Oval'];
const RAIL_COLOURS = ['White', 'Black', 'Dune', 'Bone', 'Anodised'];
const MOTOR_OPTIONS = [
    'TBS winder-32mm', 'Acmeda winder-29mm',
    'Automate 1.1NM Li-Ion Quiet Motor', 'Automate 0.7NM Li-Ion Quiet Motor',
    'Automate 2NM Li-Ion Quiet Motor', 'Automate 3NM Li-Ion Motor', 'Automate E6 6NM Motor',
    'Alpha 1NM Battery Motor', 'Alpha 2NM Battery Motor', 'Alpha 3NM Battery Motor', 'Alpha AC 5NM Motor',
];
const CHAIN_TYPE_OPTIONS = ['Stainless Steel', 'Plastic Pure White'];

interface QuoteItem {
    location: string;
    width: number;
    drop: number;
    // Blind fields
    material?: string;
    fabricType?: string;
    fabricColour?: string;
    fixing?: string;
    controlSide?: string;
    roll?: string;
    chainOrMotor?: string;
    chainType?: string;
    bracketType?: string;
    bracketColour?: string;
    bottomRailType?: string;
    bottomRailColour?: string;
    // Curtain fields
    fabric?: string;
    fabricGroup?: string;
    openingType?: string;
    fullness?: number;
    curtainType?: string;
    hem?: number;
    installation?: string;
    trackColour?: string;
    wandSize?: number;
    requiresTracks?: boolean;
    trackType?: string;
    motorType?: string;
    trackControlSide?: string;
    remotes?: string;
    chargerHub?: string;
    trackColor?: string;
    // Shared pricing
    price?: number;
    discountPercent?: number;
    fabricPrice?: number;
    motorPrice?: number;
    bracketPrice?: number;
}

interface QuoteDetail {
    id: string;
    quoteNumber: string;
    customerReference?: string;
    productType: string;
    items: QuoteItem[];
    subtotal: number;
    total: number;
    notes?: string;
    expiresAt: string;
    convertedToOrder?: string;
    createdAt: string;
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
    if (!value && value !== 0) return null;
    return (
        <div className="flex justify-between text-sm py-0.5">
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}

const sel = "h-8 text-xs px-2 rounded-md border border-input bg-background w-full";
const inp = "h-8 text-xs px-2";

// ─── Blind edit item ─────────────────────────────────────────────────────────
function EditBlindItem({ item, index, onChange, onRemove, onRecalculate }: {
    item: QuoteItem;
    index: number;
    onChange: (idx: number, field: keyof QuoteItem, value: any) => void;
    onRemove: (idx: number) => void;
    onRecalculate: (idx: number) => void;
}) {
    const f = (field: keyof QuoteItem, value: any) => onChange(index, field, value);
    return (
        <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">Blind {index + 1}</span>
                <div className="flex gap-2">
                    <button onClick={() => onRecalculate(index)} className="text-blue-500 hover:text-blue-700 text-xs flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />Recalculate
                    </button>
                    <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="text-xs text-gray-500">Location</label><Input className={inp} value={item.location || ''} onChange={e => f('location', e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Width (mm)</label><Input className={inp} type="number" value={item.width || ''} onChange={e => f('width', Number(e.target.value))} /></div>
                <div><label className="text-xs text-gray-500">Drop (mm)</label><Input className={inp} type="number" value={item.drop || ''} onChange={e => f('drop', Number(e.target.value))} /></div>
                <div><label className="text-xs text-gray-500">Roll</label>
                    <select className={sel} value={item.roll || 'Front'} onChange={e => f('roll', e.target.value)}>
                        <option>Front</option><option>Back</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="text-xs text-gray-500">Fixing</label>
                    <select className={sel} value={item.fixing || ''} onChange={e => f('fixing', e.target.value)}>
                        <option value="">-</option><option>Face</option><option>Recess</option>
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Control Side</label>
                    <select className={sel} value={item.controlSide || 'Left'} onChange={e => f('controlSide', e.target.value)}>
                        <option>Left</option><option>Right</option>
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Bracket Type</label>
                    <select className={sel} value={item.bracketType || ''} onChange={e => f('bracketType', e.target.value)}>
                        <option value="">-</option>
                        {BRACKET_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Bracket Colour</label>
                    <select className={sel} value={item.bracketColour || ''} onChange={e => f('bracketColour', e.target.value)}>
                        <option value="">-</option>
                        {BRACKET_COLOURS.map(c => <option key={c}>{c}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="text-xs text-gray-500">Material</label>
                    <select className={sel} value={item.material || ''} onChange={e => { f('material', e.target.value); f('fabricType', ''); f('fabricColour', ''); }}>
                        <option value="">-</option>
                        {Object.keys(FABRIC_DATA).map(brand => <option key={brand}>{brand}</option>)}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Fabric Type</label>
                    <select className={sel} value={item.fabricType || ''} onChange={e => { f('fabricType', e.target.value); f('fabricColour', ''); }}>
                        <option value="">-</option>
                        {item.material && FABRIC_DATA[item.material]
                            ? Object.keys(FABRIC_DATA[item.material]).map(t => <option key={t}>{t}</option>)
                            : null}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Fabric Colour</label>
                    <select className={sel} value={item.fabricColour || ''} onChange={e => f('fabricColour', e.target.value)}>
                        <option value="">-</option>
                        {item.material && item.fabricType && FABRIC_DATA[item.material]?.[item.fabricType]
                            ? FABRIC_DATA[item.material][item.fabricType].colors.map(c => <option key={c}>{c}</option>)
                            : null}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Chain/Motor</label>
                    <select className={sel} value={item.chainOrMotor || ''} onChange={e => f('chainOrMotor', e.target.value)}>
                        <option value="">-</option>
                        {MOTOR_OPTIONS.map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="text-xs text-gray-500">Bottom Rail</label>
                    <select className={sel} value={item.bottomRailType || ''} onChange={e => f('bottomRailType', e.target.value)}>
                        <option value="">-</option>
                        {RAIL_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Rail Colour</label>
                    <select className={sel} value={item.bottomRailColour || ''} onChange={e => f('bottomRailColour', e.target.value)}>
                        <option value="">-</option>
                        {RAIL_COLOURS.map(c => <option key={c}>{c}</option>)}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Chain Type</label>
                    <select className={sel} value={item.chainType || ''} onChange={e => f('chainType', e.target.value)}>
                        <option value="">-</option>
                        {CHAIN_TYPE_OPTIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Price ($)</label>
                    <Input className={inp} type="number" step="0.01" value={item.price || 0} onChange={e => f('price', Number(e.target.value))} />
                </div>
            </div>
        </div>
    );
}

// ─── Curtain edit item ────────────────────────────────────────────────────────
function EditCurtainItem({ item, index, onChange, onRemove, onRecalculate, fabrics }: {
    item: QuoteItem;
    index: number;
    onChange: (idx: number, field: keyof QuoteItem, value: any) => void;
    onRemove: (idx: number) => void;
    onRecalculate: (idx: number) => void;
    fabrics: Array<{ fabricName: string; fabricGroup: string }>;
}) {
    const f = (field: keyof QuoteItem, value: any) => onChange(index, field, value);
    return (
        <div className="border rounded-lg p-3 space-y-2 bg-purple-50">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-purple-700">Curtain {index + 1}</span>
                <div className="flex gap-2">
                    <button onClick={() => onRecalculate(index)} className="text-blue-500 hover:text-blue-700 text-xs flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />Recalculate
                    </button>
                    <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="text-xs text-gray-500">Location</label><Input className={inp} value={item.location || ''} onChange={e => f('location', e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Width (mm)</label><Input className={inp} type="number" value={item.width || ''} onChange={e => f('width', Number(e.target.value))} /></div>
                <div><label className="text-xs text-gray-500">Drop (mm)</label><Input className={inp} type="number" value={item.drop || ''} onChange={e => f('drop', Number(e.target.value))} /></div>
                <div><label className="text-xs text-gray-500">Installation</label>
                    <select className={sel} value={item.installation || 'Wall'} onChange={e => f('installation', e.target.value)}>
                        {INSTALLATION_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="col-span-2"><label className="text-xs text-gray-500">Fabric</label>
                    <select className={sel} value={item.fabric || ''} onChange={e => {
                        const fg = getSheerFabricGroup(e.target.value);
                        f('fabric', e.target.value);
                        f('fabricGroup', fg || '');
                    }}>
                        <option value="">Select fabric</option>
                        {fabrics.map(fab => <option key={fab.fabricName} value={fab.fabricName}>{fab.fabricName} ({fab.fabricGroup})</option>)}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Colour</label><Input className={inp} value={item.fabricColour || ''} onChange={e => f('fabricColour', e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Bracket Type</label>
                    <select className={sel} value={item.bracketType || 'Standard'} onChange={e => f('bracketType', e.target.value)}>
                        {SHEER_BRACKET_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="text-xs text-gray-500">Opening Type</label>
                    <select className={sel} value={item.openingType || 'Single Open'} onChange={e => f('openingType', e.target.value)}>
                        {OPENING_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Fullness</label>
                    <select className={sel} value={item.fullness || 120} onChange={e => f('fullness', Number(e.target.value))}>
                        {FULLNESS_OPTIONS.map(f => <option key={f} value={f}>{f}mm</option>)}
                    </select>
                </div>
                <div><label className="text-xs text-gray-500">Track Colour</label><Input className={inp} value={item.trackColour || ''} onChange={e => f('trackColour', e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Price ($)</label>
                    <Input className={inp} type="number" step="0.01" value={item.price || 0} onChange={e => f('price', Number(e.target.value))} />
                </div>
            </div>
            {/* Track section */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="text-xs text-gray-500">Requires Tracks</label>
                    <select className={sel} value={item.requiresTracks ? 'Yes' : 'No'} onChange={e => f('requiresTracks', e.target.value === 'Yes')}>
                        <option>No</option><option>Yes</option>
                    </select>
                </div>
                {item.requiresTracks && <>
                    <div><label className="text-xs text-gray-500">Track Type</label>
                        <select className={sel} value={item.trackType || 'Standard'} onChange={e => f('trackType', e.target.value)}>
                            {TRACK_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    {item.trackType === 'Motorised' && (
                        <div><label className="text-xs text-gray-500">Motor Type</label>
                            <select className={sel} value={item.motorType || ''} onChange={e => f('motorType', e.target.value)}>
                                <option value="">-</option>
                                {MOTOR_TYPES.map(m => <option key={m}>{m}</option>)}
                            </select>
                        </div>
                    )}
                    <div><label className="text-xs text-gray-500">Track Color</label>
                        <select className={sel} value={item.trackColor || 'White'} onChange={e => f('trackColor', e.target.value)}>
                            {TRACK_COLORS.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                </>}
            </div>
            {item.requiresTracks && item.trackType === 'Motorised' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div><label className="text-xs text-gray-500">Remotes</label>
                        <select className={sel} value={item.remotes || 'Not Required'} onChange={e => f('remotes', e.target.value)}>
                            {REMOTE_OPTIONS.map(r => <option key={r}>{r}</option>)}
                        </select>
                    </div>
                    <div><label className="text-xs text-gray-500">Charger/Hub</label>
                        <select className={sel} value={item.chargerHub || 'Not Required'} onChange={e => f('chargerHub', e.target.value)}>
                            {CHARGER_HUB_OPTIONS.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div><label className="text-xs text-gray-500">Control Side</label>
                        <select className={sel} value={item.trackControlSide || 'Right'} onChange={e => f('trackControlSide', e.target.value)}>
                            {TRACK_CONTROL_SIDES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function QuoteDetails() {
    const { quoteId } = useParams<{ quoteId: string }>();
    const navigate = useNavigate();
    const [quote, setQuote] = useState<QuoteDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedItem, setExpandedItem] = useState<number | null>(null);
    const [editing, setEditing] = useState(false);
    const [editItems, setEditItems] = useState<QuoteItem[]>([]);
    const [editNotes, setEditNotes] = useState('');
    const [editRef, setEditRef] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [fabrics, setFabrics] = useState<Array<{ fabricName: string; fabricGroup: string }>>([]);

    const isCurtainQuote = quote?.productType === 'CURTAINS';

    useEffect(() => {
        const fetchQuote = async () => {
            if (!quoteId) return;
            try {
                const response = await api.get(`/quotes/${quoteId}`);
                setQuote(response.data.quote);
            } catch (error) {
                console.error('Failed to fetch quote:', error);
                gooeyToast.error('Quote not found');
                navigate('/quotes');
            } finally {
                setLoading(false);
            }
        };
        fetchQuote();
    }, [quoteId, navigate]);

    useEffect(() => {
        pricingApi.getAllSheerFabrics().then(list => setFabrics(list)).catch(() => {});
    }, []);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    if (!quote) return null;

    const isExpired = new Date(quote.expiresAt) < new Date();
    const isConverted = !!quote.convertedToOrder;

    const startEditing = () => {
        if (!quote) return;
        setEditItems(quote.items.map(it => ({ ...it })));
        setEditNotes(quote.notes || '');
        setEditRef(quote.customerReference || '');
        setEditing(true);
    };

    const handleItemChange = (idx: number, field: keyof QuoteItem, value: any) => {
        setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    };

    const handleRemoveItem = (idx: number) => {
        setEditItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleAddItem = () => {
        if (isCurtainQuote) {
            setEditItems(prev => [...prev, { location: '', width: 1000, drop: 1500, fabric: '', fabricColour: '', openingType: 'Single Open', fullness: 120, bracketType: 'Standard', price: 0 }]);
        } else {
            setEditItems(prev => [...prev, { location: '', width: 1000, drop: 1500, roll: 'Front', controlSide: 'Left', price: 0 }]);
        }
    };

    const handleRecalculate = async (idx: number) => {
        const item = editItems[idx];
        if (!item) return;
        try {
            if (isCurtainQuote) {
                if (!item.fabric || !item.openingType || !item.fullness || !item.bracketType || !item.fabricGroup) {
                    gooeyToast.error('Fill in fabric, opening type, fullness and bracket type first');
                    return;
                }
                const calc = await pricingApi.calculateCurtainPrice({
                    width: Number(item.width),
                    drop: Number(item.drop),
                    openingType: item.openingType!,
                    fullness: Number(item.fullness),
                    bracketType: item.bracketType!,
                    fabric: item.fabric!,
                    fabricGroup: item.fabricGroup!,
                    requiresDropDeduction: true,
                    dropDeductionValue: 35,
                    requiresTracks: item.requiresTracks || false,
                    trackType: item.trackType,
                    motorType: item.motorType,
                    remotes: item.remotes,
                    chargerHub: item.chargerHub,
                });
                handleItemChange(idx, 'price', calc.total);
                gooeyToast.success(`Price updated: $${calc.total.toFixed(2)}`);
            } else {
                if (!item.material || !item.fabricType || !item.fabricColour || !item.chainOrMotor || !item.bracketType || !item.bracketColour || !item.bottomRailType || !item.bottomRailColour) {
                    gooeyToast.error('Fill in all fabric and hardware fields first');
                    return;
                }
                const result = await pricingApi.calculateBlindPrice({
                    width: Number(item.width),
                    drop: Number(item.drop),
                    material: item.material!,
                    fabricType: item.fabricType!,
                    fabricColour: item.fabricColour!,
                    chainOrMotor: item.chainOrMotor!,
                    chainType: item.chainType,
                    bracketType: item.bracketType!,
                    bracketColour: item.bracketColour!,
                    bottomRailType: item.bottomRailType!,
                    bottomRailColour: item.bottomRailColour!,
                });
                setEditItems(prev => prev.map((it, i) => i === idx ? {
                    ...it,
                    price: result.totalPrice,
                    discountPercent: result.discountPercent,
                    fabricPrice: result.fabricPrice,
                    motorPrice: result.motorChainPrice,
                    bracketPrice: result.bracketPrice,
                } : it));
                gooeyToast.success(`Price updated: $${result.totalPrice.toFixed(2)}`);
            }
        } catch (err: any) {
            gooeyToast.error(err.response?.data?.message || 'Failed to recalculate price');
        }
    };

    const handleSaveEdit = async () => {
        if (!quote) return;
        if (editItems.length === 0) { gooeyToast.error('At least one item required'); return; }
        setSavingEdit(true);
        // Recalculate subtotal/total from items
        const subtotal = editItems.reduce((sum, it) => sum + (Number(it.price) || 0), 0);
        try {
            const updated = await quoteApi.updateQuote(quote.id, {
                items: editItems,
                notes: editNotes,
                customerReference: editRef || null,
            });
            setQuote({ ...quote, ...updated, items: editItems, notes: editNotes, customerReference: editRef, subtotal, total: subtotal });
            setEditing(false);
            gooeyToast.success('Quote updated');
        } catch (err: any) {
            gooeyToast.error(err.response?.data?.message || 'Failed to save changes');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleConvertToOrder = async () => {
        if (!await confirmToast({ title: 'Convert to Order', message: 'Convert this quote to an order?', confirmText: 'Convert', variant: 'info' })) return;
        try {
            await api.post(`/quotes/${quote.id}/convert-to-order`);
            gooeyToast.success('Quote converted to order!');
            navigate('/orders');
        } catch (error: any) {
            gooeyToast.error(error.response?.data?.message || 'Failed to convert');
        }
    };

    return (
        <div className="space-y-6 p-6 max-w-5xl mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/quotes')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">{quote.quoteNumber}</h1>
                            {isConverted ? (
                                <Badge variant="success">Converted</Badge>
                            ) : isExpired ? (
                                <Badge variant="destructive">Expired</Badge>
                            ) : (
                                <Badge variant="default">Active</Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground">
                            Created {format(new Date(quote.createdAt), 'MMMM d, yyyy')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!isConverted && !isExpired && !editing && (
                        <Button variant="outline" onClick={startEditing}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Quote
                        </Button>
                    )}
                    {!isConverted && !isExpired && (
                        <Button onClick={handleConvertToOrder} className="bg-green-600 hover:bg-green-700">
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Convert to Order
                        </Button>
                    )}
                </div>
            </div>

            {/* Quote Info Cards */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Quote Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="grid grid-cols-[120px_1fr] text-sm">
                            <span className="text-muted-foreground">Product:</span>
                            <span className="font-medium">{quote.productType}</span>
                        </div>
                        {quote.customerReference && (
                            <div className="grid grid-cols-[120px_1fr] text-sm">
                                <span className="text-muted-foreground">Reference:</span>
                                <span className="font-medium">{quote.customerReference}</span>
                            </div>
                        )}
                        <div className="grid grid-cols-[120px_1fr] text-sm">
                            <span className="text-muted-foreground">Expires:</span>
                            <span className="font-medium flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(quote.expiresAt), 'MMMM d, yyyy')}
                            </span>
                        </div>
                        {quote.notes && (
                            <div className="grid grid-cols-[120px_1fr] text-sm pt-2">
                                <span className="text-muted-foreground">Notes:</span>
                                <span className="font-medium">{quote.notes}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Pricing Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal ({quote.items.length} items):</span>
                            <span>${Number(quote.subtotal).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                            <span>Total:</span>
                            <span>${Number(quote.total).toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Edit Mode */}
            {editing && (
                <Card className="border-blue-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-lg text-blue-800">Edit Quote</CardTitle>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit} className="bg-blue-600 hover:bg-blue-700">
                                {savingEdit ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                                Save Changes
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Customer Reference</label>
                                <Input className="mt-1" value={editRef} onChange={e => setEditRef(e.target.value)} placeholder="Optional reference" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700">Notes</label>
                                <Input className="mt-1" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Quote notes" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-700">
                                    {isCurtainQuote ? 'Curtain' : 'Blind'} Items ({editItems.length})
                                </span>
                                <Button size="sm" variant="outline" onClick={handleAddItem}>
                                    <Plus className="mr-1 h-3 w-3" />Add Item
                                </Button>
                            </div>
                            {editItems.map((item, idx) =>
                                isCurtainQuote ? (
                                    <EditCurtainItem
                                        key={idx}
                                        item={item}
                                        index={idx}
                                        onChange={handleItemChange}
                                        onRemove={handleRemoveItem}
                                        onRecalculate={handleRecalculate}
                                        fabrics={fabrics}
                                    />
                                ) : (
                                    <EditBlindItem
                                        key={idx}
                                        item={item}
                                        index={idx}
                                        onChange={handleItemChange}
                                        onRemove={handleRemoveItem}
                                        onRecalculate={handleRecalculate}
                                    />
                                )
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Items ({quote.items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="h-12 px-4 font-medium text-muted-foreground w-8"></th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground">#</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground">Location</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground">Fabric</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground">Dimensions</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground">{isCurtainQuote ? 'Opening' : 'Motor'}</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quote.items.map((item, index) => {
                                    const isExpanded = expandedItem === index;
                                    const discountPct = Number(item.discountPercent || 0);
                                    const finalPrice = Number(item.price || 0);
                                    const originalPrice = discountPct > 0
                                        ? finalPrice / (1 - discountPct / 100)
                                        : finalPrice;

                                    const fabricLabel = isCurtainQuote
                                        ? (item.fabric || item.material || '-')
                                        : (`${item.material || '-'} - ${item.fabricType || '-'}`);

                                    const motorLabel = isCurtainQuote
                                        ? (item.openingType || '-')
                                        : (item.chainOrMotor || '-');

                                    return (
                                        <>
                                            <tr
                                                key={index}
                                                className="border-b hover:bg-muted/50 cursor-pointer"
                                                onClick={() => setExpandedItem(isExpanded ? null : index)}
                                            >
                                                <td className="p-4 text-gray-400">
                                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </td>
                                                <td className="p-4 text-muted-foreground">{index + 1}</td>
                                                <td className="p-4 font-medium">{item.location}</td>
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{fabricLabel}</span>
                                                        <span className="text-xs text-muted-foreground">{item.fabricColour}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">{item.width}mm × {item.drop}mm</td>
                                                <td className="p-4 text-xs">{motorLabel}</td>
                                                <td className="p-4 text-right font-medium">
                                                    {discountPct > 0 && (
                                                        <span className="block text-xs text-gray-400 line-through">
                                                            ${originalPrice.toFixed(2)}
                                                        </span>
                                                    )}
                                                    ${finalPrice.toFixed(2)}
                                                    {discountPct > 0 && (
                                                        <span className="block text-xs text-green-600">
                                                            {discountPct}% off
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr key={`${index}-details`} className={`border-b ${isCurtainQuote ? 'bg-purple-50' : 'bg-blue-50'}`}>
                                                    <td colSpan={7} className="px-8 py-4">
                                                        {isCurtainQuote ? (
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1">
                                                                <DetailRow label="Opening Type" value={item.openingType} />
                                                                <DetailRow label="Fullness" value={item.fullness ? `${item.fullness}mm` : null} />
                                                                <DetailRow label="Bracket Type" value={item.bracketType} />
                                                                <DetailRow label="Installation" value={item.installation} />
                                                                <DetailRow label="Track Colour" value={item.trackColour} />
                                                                {item.requiresTracks && <>
                                                                    <DetailRow label="Track Type" value={item.trackType} />
                                                                    {item.motorType && <DetailRow label="Motor Type" value={item.motorType} />}
                                                                    {item.remotes && item.remotes !== 'Not Required' && <DetailRow label="Remotes" value={item.remotes} />}
                                                                    {item.chargerHub && item.chargerHub !== 'Not Required' && <DetailRow label="Charger/Hub" value={item.chargerHub} />}
                                                                    <DetailRow label="Track Color" value={item.trackColor} />
                                                                </>}
                                                                {item.fabricPrice != null && (
                                                                    <div className="col-span-full mt-2 pt-2 border-t border-purple-200 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1">
                                                                        <DetailRow label="Fabric Cost" value={`$${Number(item.fabricPrice).toFixed(2)}`} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1">
                                                                <DetailRow label="Fixing" value={item.fixing} />
                                                                <DetailRow label="Control Side" value={item.controlSide} />
                                                                <DetailRow label="Roll" value={item.roll} />
                                                                <DetailRow label="Bracket Type" value={item.bracketType} />
                                                                <DetailRow label="Bracket Colour" value={item.bracketColour} />
                                                                <DetailRow label="Chain/Motor" value={item.chainOrMotor} />
                                                                {item.chainType && <DetailRow label="Chain Type" value={item.chainType} />}
                                                                <DetailRow label="Bottom Rail" value={item.bottomRailType} />
                                                                <DetailRow label="Rail Colour" value={item.bottomRailColour} />
                                                                {(item.fabricPrice != null || item.motorPrice != null || item.bracketPrice != null) && (
                                                                    <div className="col-span-full mt-3 pt-3 border-t border-blue-200 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1">
                                                                        {item.fabricPrice != null && <DetailRow label="Fabric Price" value={`$${Number(item.fabricPrice).toFixed(2)}`} />}
                                                                        {item.motorPrice != null && Number(item.motorPrice) > 0 && <DetailRow label="Motor/Chain" value={`+$${Number(item.motorPrice).toFixed(2)}`} />}
                                                                        {item.bracketPrice != null && Number(item.bracketPrice) > 0 && <DetailRow label="Bracket" value={`+$${Number(item.bracketPrice).toFixed(2)}`} />}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
