import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { webOrderApi, adminOrderApi } from '../../services/api';
import { Order, BlindItem } from '../../types/order';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader2, ArrowLeft, ChevronDown, ChevronUp, Check, Trash2, Factory } from 'lucide-react';
import { format } from 'date-fns';
import { gooeyToast } from 'goey-toast';
import { confirmToast } from '../../utils/confirmToast';
import api from '../../services/api';

export default function AdminOrderDetails() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedItem, setExpandedItem] = useState<number | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

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
                gooeyToast.error('Order not found');
                navigate('/admin/orders');
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

    const handleApprove = async () => {
        if (!await confirmToast({ title: 'Approve Order', message: 'Approve this order and notify the customer?', confirmText: 'Approve', variant: 'info' })) return;
        setActionLoading(true);
        try {
            await adminOrderApi.approveOrder(order.id);
            gooeyToast.success('Order approved');
            setOrder({ ...order, status: 'CONFIRMED' });
        } catch (error) {
            gooeyToast.error('Failed to approve order');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendToProduction = async () => {
        if (!await confirmToast({ title: 'Send to Production', message: 'This will run fabric cut optimization. Continue?', confirmText: 'Send', variant: 'warning' })) return;
        setActionLoading(true);
        try {
            await adminOrderApi.sendToProduction(order.id);
            gooeyToast.success('Sent to production');
            setOrder({ ...order, status: 'PRODUCTION' });
        } catch (error) {
            gooeyToast.error('Failed to send to production');
        } finally {
            setActionLoading(false);
        }
    };

    const handleComplete = async () => {
        if (!await confirmToast({ title: 'Complete Order', message: 'Mark this order as completed?', confirmText: 'Complete', variant: 'info' })) return;
        setActionLoading(true);
        try {
            await adminOrderApi.updateStatus(order.id, 'COMPLETED');
            gooeyToast.success('Order marked as completed');
            setOrder({ ...order, status: 'COMPLETED' });
        } catch (error) {
            gooeyToast.error('Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleTrash = async () => {
        if (!await confirmToast({ title: 'Move to Trash', message: 'Move this order to trash? It will be permanently deleted after 10 days.', confirmText: 'Trash', variant: 'danger' })) return;
        setActionLoading(true);
        try {
            await api.delete(`/web-orders/${order.id}/trash`);
            gooeyToast.success('Order moved to trash');
            navigate('/admin/orders');
        } catch (error) {
            gooeyToast.error('Failed to trash order');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-6 p-6 max-w-5xl mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin/orders')}>
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
                    {order.status === 'PENDING' && (
                        <Button
                            onClick={handleApprove}
                            disabled={actionLoading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                        </Button>
                    )}
                    {order.status === 'CONFIRMED' && (
                        <Button onClick={handleSendToProduction} disabled={actionLoading}>
                            <Factory className="mr-2 h-4 w-4" />
                            Send to Production
                        </Button>
                    )}
                    {order.status === 'PRODUCTION' && (
                        <Button onClick={handleComplete} disabled={actionLoading} variant="outline">
                            Mark Completed
                        </Button>
                    )}
                    {order.status !== 'CANCELLED' && (
                        <Button
                            variant="outline"
                            onClick={handleTrash}
                            disabled={actionLoading}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Move to Trash
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
                        <div className="grid grid-cols-[120px_1fr] text-sm">
                            <span className="text-muted-foreground">Name:</span>
                            <span className="font-medium">{order.customerName}</span>
                        </div>
                        <div className="grid grid-cols-[120px_1fr] text-sm">
                            <span className="text-muted-foreground">Email:</span>
                            <span className="font-medium">{order.customerEmail || 'N/A'}</span>
                        </div>
                        {(order as any).customerReference && (
                            <div className="grid grid-cols-[120px_1fr] text-sm">
                                <span className="text-muted-foreground">Reference:</span>
                                <span className="font-medium">{(order as any).customerReference}</span>
                            </div>
                        )}
                        {order.notes && (
                            <div className="grid grid-cols-[120px_1fr] text-sm pt-2">
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
                    <CardTitle>Items ({order.items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-8"></th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Location</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Details</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Dimensions</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Control</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, index) => {
                                    const itemKey = (item as any).id || index;
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
                                                <td className="p-4 align-middle">{item.width}mm × {item.drop}mm</td>
                                                <td className="p-4 align-middle">{item.controlSide} / {item.roll}</td>
                                                <td className="p-4 align-middle text-right font-medium">
                                                    <span className="text-blue-700">${Number(item.price || 0).toFixed(2)}</span>
                                                </td>
                                            </tr>
                                            {isExpanded && hasBreakdown && (
                                                <tr key={`${itemKey}-breakdown`} className="border-b bg-blue-50">
                                                    <td colSpan={6} className="px-8 py-4">
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm mb-3">
                                                            {item.fixing && <div><span className="text-muted-foreground">Fixing: </span><span className="font-medium">{item.fixing}</span></div>}
                                                            {item.bracketType && <div><span className="text-muted-foreground">Bracket: </span><span className="font-medium">{item.bracketType}</span></div>}
                                                            {item.bracketColour && <div><span className="text-muted-foreground">Bracket Colour: </span><span className="font-medium">{item.bracketColour}</span></div>}
                                                            {item.chainOrMotor && <div><span className="text-muted-foreground">Motor: </span><span className="font-medium">{item.chainOrMotor}</span></div>}
                                                            {(item as any).chainType && <div><span className="text-muted-foreground">Chain Type: </span><span className="font-medium">{(item as any).chainType}</span></div>}
                                                            {item.bottomRailType && <div><span className="text-muted-foreground">Bottom Rail: </span><span className="font-medium">{item.bottomRailType}</span></div>}
                                                            {item.bottomRailColour && <div><span className="text-muted-foreground">Rail Colour: </span><span className="font-medium">{item.bottomRailColour}</span></div>}
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1 text-sm border-t border-blue-200 pt-3">
                                                            {item.fabricPrice != null && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Fabric:</span>
                                                                    <span className="flex items-center gap-2">
                                                                        {item.discountPercent != null && Number(item.discountPercent) > 0 && (
                                                                            <span className="text-xs text-gray-400 line-through bg-yellow-50 px-1 rounded">
                                                                                ${(Number(item.fabricPrice) / (1 - Number(item.discountPercent) / 100)).toFixed(2)}
                                                                            </span>
                                                                        )}
                                                                        <span className="font-semibold text-yellow-700">${Number(item.fabricPrice).toFixed(2)}</span>
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {item.motorPrice != null && Number(item.motorPrice) > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Motor/Chain:</span>
                                                                    <span>+${Number(item.motorPrice).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            {item.bracketPrice != null && Number(item.bracketPrice) > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Brackets:</span>
                                                                    <span>+${Number(item.bracketPrice).toFixed(2)}</span>
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
