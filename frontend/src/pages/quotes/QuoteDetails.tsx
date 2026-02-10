import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader2, ArrowLeft, ShoppingCart, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

interface QuoteItem {
    location: string;
    width: number;
    drop: number;
    material?: string;
    fabricType?: string;
    fabricColour?: string;
    controlSide?: string;
    roll?: string;
    chainOrMotor?: string;
    bracketType?: string;
    bracketColour?: string;
    bottomRailType?: string;
    bottomRailColour?: string;
    price?: number;
    discountPercent?: number;
}

interface QuoteDetail {
    id: string;
    quoteNumber: string;
    productType: string;
    items: QuoteItem[];
    subtotal: number;
    total: number;
    notes?: string;
    expiresAt: string;
    convertedToOrder?: string;
    createdAt: string;
}

export default function QuoteDetails() {
    const { quoteId } = useParams<{ quoteId: string }>();
    const navigate = useNavigate();
    const [quote, setQuote] = useState<QuoteDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuote = async () => {
            if (!quoteId) return;
            try {
                const response = await api.get(`/quotes/${quoteId}`);
                setQuote(response.data.quote);
            } catch (error) {
                console.error('Failed to fetch quote:', error);
                toast.error('Quote not found');
                navigate('/quotes');
            } finally {
                setLoading(false);
            }
        };
        fetchQuote();
    }, [quoteId, navigate]);

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

    const handleConvertToOrder = async () => {
        if (!confirm('Convert this quote to an order?')) return;
        try {
            await api.post(`/quotes/${quote.id}/convert-to-order`);
            toast.success('Quote converted to order!');
            navigate('/orders');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to convert');
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
                {!isConverted && !isExpired && (
                    <Button onClick={handleConvertToOrder} className="bg-green-600 hover:bg-green-700">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Convert to Order
                    </Button>
                )}
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

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Items ({quote.items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm text-left">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b">
                                    <th className="h-12 px-4 font-medium text-muted-foreground">#</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground">Location</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground">Fabric</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground">Dimensions</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground">Motor</th>
                                    <th className="h-12 px-4 font-medium text-muted-foreground text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quote.items.map((item, index) => (
                                    <tr key={index} className="border-b hover:bg-muted/50">
                                        <td className="p-4 text-muted-foreground">{index + 1}</td>
                                        <td className="p-4 font-medium">{item.location}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{item.material} - {item.fabricType}</span>
                                                <span className="text-xs text-muted-foreground">{item.fabricColour}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">{item.width}mm x {item.drop}mm</td>
                                        <td className="p-4 text-xs">{item.chainOrMotor || '-'}</td>
                                        <td className="p-4 text-right font-medium">
                                            ${Number(item.price || 0).toFixed(2)}
                                            {item.discountPercent != null && Number(item.discountPercent) > 0 && (
                                                <span className="block text-xs text-green-600">
                                                    {Number(item.discountPercent)}% off
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
