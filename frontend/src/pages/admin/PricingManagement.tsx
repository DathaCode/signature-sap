import { useEffect, useState } from 'react';
import { adminPricingApi, pricingApi } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Loader2, Save } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import { Input } from '../../components/ui/Input';

interface PricingEntry {
    width: number;
    drop: number;
    price: number;
}

interface ComponentItem {
    id: string;
    category: string;
    name: string;
    variant: string | null;
    price: number;
    unit: string;
}

const COMPONENT_CATEGORIES = ['ACMEDA', 'TBS', 'MOTOR'];

// Which item names are motors (charged) vs brackets (charged only for Extended/Dual)
const isMotorItem = (name: string) =>
    name.toLowerCase().includes('winder') || name.toLowerCase().includes('motor');

const isChargeableBracket = (name: string) =>
    name.toLowerCase().includes('extended') ||
    name.toLowerCase().includes('duel') ||
    name.toLowerCase().includes('dual');

// 3 bracket pricing groups (colour/side agnostic)
interface BracketGroup {
    label: string;
    matchFn: (item: ComponentItem) => boolean;
    price: number;
    itemIds: string[];
}

function buildBracketGroups(items: ComponentItem[]): BracketGroup[] {
    const groups: BracketGroup[] = [
        {
            label: 'Acmeda Dual Bracket set Left/Right',
            matchFn: (c) => c.category !== 'TBS' && (c.name.toLowerCase().includes('dual') || c.name.toLowerCase().includes('duel')),
            price: 0,
            itemIds: [],
        },
        {
            label: 'Acmeda Extended Bracket set',
            matchFn: (c) => c.name.toLowerCase().includes('extended'),
            price: 0,
            itemIds: [],
        },
        {
            label: 'TBS Dual Bracket set Left/Right',
            matchFn: (c) => c.category === 'TBS' && (c.name.toLowerCase().includes('dual') || c.name.toLowerCase().includes('duel')),
            price: 0,
            itemIds: [],
        },
    ];

    for (const item of items) {
        for (const group of groups) {
            if (group.matchFn(item)) {
                group.itemIds.push(item.id);
                // Use first found price as the displayed price
                if (group.price === 0) group.price = item.price;
                break;
            }
        }
    }

    return groups;
}

export default function PricingManagement() {
    const [activeTab, setActiveTab] = useState<'fabric' | 'components'>('fabric');

    // Fabric matrix state
    const [loading, setLoading] = useState(true);
    const [fabricGroup, setFabricGroup] = useState(1);
    const [pricingData, setPricingData] = useState<PricingEntry[]>([]);
    const [widths, setWidths] = useState<number[]>([]);
    const [drops, setDrops] = useState<number[]>([]);
    const [editedCells, setEditedCells] = useState<Map<string, number>>(new Map());

    // Component pricing state
    const [componentsLoading, setComponentsLoading] = useState(false);
    const [components, setComponents] = useState<ComponentItem[]>([]);
    const [editedComponents, setEditedComponents] = useState<Map<string, number>>(new Map());
    const [savingComponents, setSavingComponents] = useState(false);

    // Bracket groups (3 rows)
    const [bracketGroups, setBracketGroups] = useState<BracketGroup[]>([]);
    const [editedBracketGroups, setEditedBracketGroups] = useState<Map<number, number>>(new Map());

    useEffect(() => {
        fetchPricing();
    }, [fabricGroup]);

    useEffect(() => {
        if (activeTab === 'components') {
            fetchComponents();
        }
    }, [activeTab]);

    const fetchPricing = async () => {
        setLoading(true);
        try {
            const data = await adminPricingApi.getPricing(fabricGroup);
            setPricingData(data);
            const uniqueWidths = Array.from(new Set(data.map((item: any) => item.width))).sort((a, b) => a - b);
            const uniqueDrops = Array.from(new Set(data.map((item: any) => item.drop))).sort((a, b) => a - b);
            setWidths(uniqueWidths);
            setDrops(uniqueDrops);
        } catch (error) {
            console.error('Failed to fetch pricing:', error);
            gooeyToast.error('Failed to load pricing data');
        } finally {
            setLoading(false);
        }
    };

    const fetchComponents = async () => {
        setComponentsLoading(true);
        try {
            const result = await pricingApi.getAllComponentPrices();
            // Filter to motors and bracket categories only
            const filtered = result.components.filter(c =>
                COMPONENT_CATEGORIES.includes(c.category) &&
                (isMotorItem(c.name) || isChargeableBracket(c.name))
            );
            setComponents(filtered);

            // Build bracket groups from chargeable brackets
            const bracketItems = filtered.filter(c => isChargeableBracket(c.name));
            setBracketGroups(buildBracketGroups(bracketItems));
            setEditedBracketGroups(new Map());
        } catch (error) {
            console.error('Failed to fetch components:', error);
            gooeyToast.error('Failed to load component prices');
        } finally {
            setComponentsLoading(false);
        }
    };

    const handlePriceChange = (width: number, drop: number, newPrice: string) => {
        const price = parseFloat(newPrice);
        if (isNaN(price)) return;
        const key = `${width}-${drop}`;
        setEditedCells(prev => new Map(prev).set(key, price));
    };

    const getPrice = (width: number, drop: number) => {
        const key = `${width}-${drop}`;
        if (editedCells.has(key)) return editedCells.get(key);
        const entry = pricingData.find(p => p.width === width && p.drop === drop);
        return entry ? entry.price : '';
    };

    const saveChanges = async () => {
        if (editedCells.size === 0) return;
        const promises: Promise<void>[] = [];
        editedCells.forEach((price, key) => {
            const [width, drop] = key.split('-').map(Number);
            promises.push(adminPricingApi.updatePrice(fabricGroup, width, drop, price));
        });
        try {
            await Promise.all(promises);
            gooeyToast.success('Pricing updated successfully');
            setEditedCells(new Map());
            fetchPricing();
        } catch (error) {
            console.error(error);
            gooeyToast.error('Failed to update some prices');
        }
    };

    const handleComponentPriceChange = (id: string, newPrice: string) => {
        const price = parseFloat(newPrice);
        if (isNaN(price) || price < 0) return;
        setEditedComponents(prev => new Map(prev).set(id, price));
    };

    const getComponentPrice = (item: ComponentItem) => {
        if (editedComponents.has(item.id)) return editedComponents.get(item.id);
        return item.price;
    };

    const handleBracketGroupPriceChange = (groupIndex: number, newPrice: string) => {
        const price = parseFloat(newPrice);
        if (isNaN(price) || price < 0) return;
        setEditedBracketGroups(prev => new Map(prev).set(groupIndex, price));
    };

    const getBracketGroupPrice = (groupIndex: number) => {
        if (editedBracketGroups.has(groupIndex)) return editedBracketGroups.get(groupIndex);
        return bracketGroups[groupIndex]?.price ?? 0;
    };

    const saveComponentChanges = async () => {
        if (editedComponents.size === 0 && editedBracketGroups.size === 0) return;
        setSavingComponents(true);
        try {
            const promises: Promise<void>[] = [];

            // Save individual motor price changes
            editedComponents.forEach((price, id) => {
                promises.push(pricingApi.updateComponentPrice(id, price));
            });

            // Save bracket group changes — update ALL items in each group
            editedBracketGroups.forEach((price, groupIndex) => {
                const group = bracketGroups[groupIndex];
                if (group) {
                    for (const itemId of group.itemIds) {
                        promises.push(pricingApi.updateComponentPrice(itemId, price));
                    }
                }
            });

            await Promise.all(promises);
            gooeyToast.success('Component prices updated');
            setEditedComponents(new Map());
            setEditedBracketGroups(new Map());
            fetchComponents();
        } catch (error) {
            console.error(error);
            gooeyToast.error('Failed to update some component prices');
        } finally {
            setSavingComponents(false);
        }
    };

    // Group components by category for display
    const motors = components.filter(c => isMotorItem(c.name));

    return (
        <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pricing Management</h1>
                    <p className="text-muted-foreground">Manage fabric matrix prices and motor/bracket charges.</p>
                </div>
                <div className="flex gap-4">
                    {activeTab === 'fabric' && editedCells.size > 0 && (
                        <Button onClick={saveChanges}>
                            <Save className="mr-2 h-4 w-4" />
                            Save {editedCells.size} Changes
                        </Button>
                    )}
                    {activeTab === 'components' && (editedComponents.size > 0 || editedBracketGroups.size > 0) && (
                        <Button onClick={saveComponentChanges} disabled={savingComponents}>
                            {savingComponents ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save {editedComponents.size + editedBracketGroups.size} Changes
                        </Button>
                    )}
                </div>
            </div>

            {/* Top-level tabs */}
            <div className="flex gap-2 border-b pb-0">
                <button
                    onClick={() => setActiveTab('fabric')}
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'fabric'
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Fabric Matrix
                </button>
                <button
                    onClick={() => setActiveTab('components')}
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'components'
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Blind Parts
                </button>
            </div>

            {/* FABRIC MATRIX TAB */}
            {activeTab === 'fabric' && (
                <>
                    <div className="flex gap-2 overflow-x-auto">
                        {[1, 2, 3].map(group => (
                            <Button
                                key={group}
                                variant={fabricGroup === group ? 'default' : 'outline'}
                                onClick={() => setFabricGroup(group)}
                            >
                                Group {group}
                            </Button>
                        ))}
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Pricing Matrix - Group {fabricGroup}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                                </div>
                            ) : (
                                <div className="relative w-full overflow-auto max-h-[70vh]">
                                    <table className="w-full caption-bottom text-sm text-left border-collapse">
                                        <thead className="bg-muted sticky top-0 z-10">
                                            <tr>
                                                <th className="p-2 border font-medium sticky left-0 bg-muted z-20">Drop \ Width</th>
                                                {widths.map(width => (
                                                    <th key={width} className="p-2 border font-medium text-center min-w-[80px]">{width}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {drops.map(drop => (
                                                <tr key={drop}>
                                                    <th className="p-2 border font-medium sticky left-0 bg-muted">{drop}</th>
                                                    {widths.map(width => (
                                                        <td key={`${width}-${drop}`} className="p-1 border text-center">
                                                            <Input
                                                                type="number"
                                                                className="h-8 w-full text-center px-1"
                                                                value={getPrice(width, drop)}
                                                                onChange={(e) => handlePriceChange(width, drop, e.target.value)}
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {drops.length === 0 && (
                                                <tr>
                                                    <td colSpan={widths.length + 1} className="p-8 text-center text-muted-foreground">
                                                        No pricing data found for this group. Run seed script first.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* MOTORS & BRACKETS TAB */}
            {activeTab === 'components' && (
                <div className="space-y-6">
                    <p className="text-sm text-muted-foreground">
                        Set the price charged to customers for each motor and extended/dual bracket.
                        Single brackets are not charged. Changes take effect on new orders immediately.
                    </p>

                    {componentsLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Motors */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Motors & Winders</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="py-2 text-left font-medium text-muted-foreground">Motor / Winder</th>
                                                <th className="py-2 text-left font-medium text-muted-foreground w-8">Brand</th>
                                                <th className="py-2 text-right font-medium text-muted-foreground w-28">Price ($)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {motors.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                                                        No motors found. Ensure inventory is seeded.
                                                    </td>
                                                </tr>
                                            )}
                                            {motors.map(item => (
                                                <tr key={item.id} className="border-b last:border-0">
                                                    <td className="py-2 pr-4">{item.name}</td>
                                                    <td className="py-2 pr-4 text-xs text-muted-foreground">{item.category}</td>
                                                    <td className="py-2">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            className="h-8 w-full text-right px-2"
                                                            value={getComponentPrice(item)}
                                                            onChange={(e) => handleComponentPriceChange(item.id, e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>

                            {/* Extended / Dual Brackets — 3 grouped rows */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Extended & Dual Brackets</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Single brackets are not charged. Set one price per bracket type — applies to all colours and sides.
                                    </p>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="py-2 text-left font-medium text-muted-foreground">Bracket Type</th>
                                                <th className="py-2 text-right font-medium text-muted-foreground w-28">Price ($)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bracketGroups.length === 0 && (
                                                <tr>
                                                    <td colSpan={2} className="py-6 text-center text-muted-foreground">
                                                        No bracket items found. Ensure inventory is seeded.
                                                    </td>
                                                </tr>
                                            )}
                                            {bracketGroups.map((group, idx) => (
                                                <tr key={idx} className="border-b last:border-0">
                                                    <td className="py-3 pr-4 font-medium">{group.label}</td>
                                                    <td className="py-3">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            className="h-8 w-full text-right px-2"
                                                            value={getBracketGroupPrice(idx)}
                                                            onChange={(e) => handleBracketGroupPriceChange(idx, e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
