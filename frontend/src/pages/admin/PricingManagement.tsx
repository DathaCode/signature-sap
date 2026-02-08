import { useEffect, useState } from 'react';
import { adminPricingApi } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Input } from '../../components/ui/Input';

interface PricingEntry {
    width: number;
    drop: number;
    price: number;
}

export default function PricingManagement() {
    const [loading, setLoading] = useState(true);
    const [fabricGroup, setFabricGroup] = useState(1);
    const [pricingData, setPricingData] = useState<PricingEntry[]>([]);
    const [widths, setWidths] = useState<number[]>([]);
    const [drops, setDrops] = useState<number[]>([]);
    const [editedCells, setEditedCells] = useState<Map<string, number>>(new Map());

    useEffect(() => {
        fetchPricing();
    }, [fabricGroup]);

    const fetchPricing = async () => {
        setLoading(true);
        try {
            const data = await adminPricingApi.getPricing(fabricGroup);
            setPricingData(data);

            // Extract unique widths and drops for matrix headers
            const uniqueWidths = Array.from(new Set(data.map((item: any) => item.width))).sort((a, b) => a - b);
            const uniqueDrops = Array.from(new Set(data.map((item: any) => item.drop))).sort((a, b) => a - b);

            setWidths(uniqueWidths);
            setDrops(uniqueDrops);
        } catch (error) {
            console.error('Failed to fetch pricing:', error);
            toast.error('Failed to load pricing data');
        } finally {
            setLoading(false);
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
            toast.success('Pricing updated successfully');
            setEditedCells(new Map());
            fetchPricing();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update some prices');
        }
    };

    return (
        <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pricing Management</h1>
                    <p className="text-muted-foreground">Manage base prices for each fabric group.</p>
                </div>
                <div className="flex gap-4">
                    {editedCells.size > 0 && (
                        <Button onClick={saveChanges}>
                            <Save className="mr-2 h-4 w-4" />
                            Save {editedCells.size} Changes
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex gap-2 border-b pb-4 overflow-x-auto">
                {[1, 2, 3, 4, 5].map(group => (
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
        </div>
    );
}
