import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { webOrderApi } from '../../services/api';
import { Order, BlindItem } from '../../types/order';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader2, ArrowLeft, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

export default function OrderDetails() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedItem, setExpandedItem] = useState<number | null>(null);

    const hasPriceBreakdown = (item: BlindItem) =>
        item.fabricPrice != null || item.motorPrice != null || item.bracketPrice != null;

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) return;
            try {
                const data = await webOrderApi.getOrder(orderId);
                setOrder(data);
            } catch (error) {
                console.error('Failed to fetch order:', error);
                toast.error('Order not found');
                navigate('/orders');
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [orderId, navigate]);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    if (!order) return null;

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'CONFIRMED': return 'success';
            case 'PRODUCTION': return 'default';
            case 'COMPLETED': return 'secondary';
            case 'CANCELLED': return 'destructive';
            default: return 'outline';
        }
    };

    return (
        <div className="space-y-6 p-6 max-w-5xl mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">{order.orderNumber}</h1>
                            <Badge variant={getStatusVariant(order.status)} className="text-sm">
                                {order.status}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground">
                            Placed on {format(new Date(order.createdAt), 'MMMM d, yyyy')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                    {order.status === 'PENDING' && (
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                if (confirm('Are you sure you want to cancel this order?')) {
                                    try {
                                        await webOrderApi.cancelOrder(order.id);
                                        toast.success('Order cancelled');
                                        setOrder({ ...order, status: 'CANCELLED' });
                                    } catch (error) {
                                        console.error(error);
                                        toast.error('Failed to cancel order');
                                    }
                                }
                            }}
                        >
                            Cancel Order
                        </Button>
                    )}
                </div>
            </div>

            {/* Order Summary Cards */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Customer Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="grid grid-cols-[100px_1fr] text-sm">
                            <span className="text-muted-foreground">Name:</span>
                            <span className="font-medium">{order.customerName}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] text-sm">
                            <span className="text-muted-foreground">Email:</span>
                            <span className="font-medium">{order.customerEmail || 'N/A'}</span>
                        </div>
                        {order.notes && (
                            <div className="grid grid-cols-[100px_1fr] text-sm pt-2">
                                <span className="text-muted-foreground">Notes:</span>
                                <span className="font-medium">{order.notes}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal ({order.items.length} items):</span>
                            <span>${Number(order.subtotal).toFixed(2)}</span>
                        </div>
                        {Number(order.discount) > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Discount:</span>
                                <span>-${Number(order.discount).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                            <span>Total:</span>
                            <span>${Number(order.total).toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Line Items */}
            <Card>
                <CardHeader>
                    <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm text-left">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-8"></th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Location</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Details</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Dimensions</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Control</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {order.items.map((item, index) => {
                                    const itemKey = item.id || index;
                                    const isExpanded = expandedItem === itemKey;
                                    const hasBreakdown = hasPriceBreakdown(item);

                                    return (
                                        <>
                                            <tr
                                                key={itemKey}
                                                className={`border-b transition-colors hover:bg-muted/50 ${hasBreakdown ? 'cursor-pointer' : ''}`}
                                                onClick={() => hasBreakdown && setExpandedItem(isExpanded ? null : itemKey)}
                                            >
                                                <td className="p-4 align-middle">
                                                    {hasBreakdown && (
                                                        isExpanded
                                                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </td>
                                                <td className="p-4 align-middle font-medium">{item.location}</td>
                                                <td className="p-4 align-middle">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{item.material} - {item.fabricType}</span>
                                                        <span className="text-xs text-muted-foreground">{item.fabricColour}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    {item.width}mm x {item.drop}mm
                                                </td>
                                                <td className="p-4 align-middle">
                                                    {item.controlSide} / {item.roll}
                                                </td>
                                                <td className="p-4 align-middle text-right font-medium">
                                                    ${Number(item.price || 0).toFixed(2)}
                                                    {item.discountPercent != null && Number(item.discountPercent) > 0 && (
                                                        <span className="block text-xs text-green-600">
                                                            {Number(item.discountPercent)}% off
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                            {isExpanded && hasBreakdown && (
                                                <tr key={`${itemKey}-breakdown`} className="border-b bg-muted/30">
                                                    <td colSpan={6} className="px-8 py-3">
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1 text-sm">
                                                            {item.fabricPrice != null && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Fabric:</span>
                                                                    <span>${Number(item.fabricPrice).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            {item.motorPrice != null && Number(item.motorPrice) > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Motor/Chain:</span>
                                                                    <span>${Number(item.motorPrice).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            {item.bracketPrice != null && Number(item.bracketPrice) > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Brackets:</span>
                                                                    <span>${Number(item.bracketPrice).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            {item.chainPrice != null && Number(item.chainPrice) > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Chain:</span>
                                                                    <span>${Number(item.chainPrice).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            {item.clipsPrice != null && Number(item.clipsPrice) > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Clips:</span>
                                                                    <span>${Number(item.clipsPrice).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            {item.componentPrice != null && Number(item.componentPrice) > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Accessories:</span>
                                                                    <span>${Number(item.componentPrice).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                        </div>
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
