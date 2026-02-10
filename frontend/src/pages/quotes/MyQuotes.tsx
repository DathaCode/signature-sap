import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { FileText, Calendar, CheckCircle, XCircle, Trash2, ShoppingCart, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

interface Quote {
    id: string;
    quoteNumber: string;
    productType: string;
    subtotal: number;
    total: number;
    expiresAt: string;
    convertedToOrder?: string;
    createdAt: string;
}

export default function MyQuotesPage() {
    const navigate = useNavigate();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuotes();
    }, []);

    const fetchQuotes = async () => {
        try {
            const response = await api.get('/quotes/my-quotes');
            setQuotes(response.data.quotes);
        } catch (error) {
            console.error('Failed to fetch quotes:', error);
            toast.error('Failed to load quotes');
        } finally {
            setLoading(false);
        }
    };

    const handleConvertToOrder = async (quoteId: string) => {
        if (!confirm('Convert this quote to an order?')) return;

        try {
            await api.post(`/quotes/${quoteId}/convert-to-order`);
            toast.success('Quote converted to order successfully!');
            fetchQuotes(); // Refresh list
            navigate('/dashboard');
        } catch (error: any) {
            console.error('Failed to convert quote:', error);
            toast.error(error.response?.data?.message || 'Failed to convert quote');
        }
    };

    const handleDeleteQuote = async (quoteId: string) => {
        if (!confirm('Delete this quote? This action cannot be undone.')) return;

        try {
            await api.delete(`/quotes/${quoteId}`);
            toast.success('Quote deleted successfully');
            fetchQuotes(); // Refresh list
        } catch (error) {
            console.error('Failed to delete quote:', error);
            toast.error('Failed to delete quote');
        }
    };

    const isExpired = (expiresAt: string) => {
        return new Date(expiresAt) < new Date();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading quotes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Quotes</h1>
                    <p className="text-muted-foreground">View and manage your saved quotes</p>
                </div>
                <Button onClick={() => navigate('/new-order')} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    New Quote
                </Button>
            </div>

            {/* Quotes List */}
            {quotes.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No quotes yet</h3>
                        <p className="text-gray-600 mb-4">Create your first quote to get started</p>
                        <Button onClick={() => navigate('/new-order')} variant="outline">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Quote
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {quotes.map((quote) => {
                        const expired = isExpired(quote.expiresAt);
                        const converted = !!quote.convertedToOrder;

                        return (
                            <Card key={quote.id} className={`${expired ? 'opacity-60' : ''} ${converted ? 'border-green-500' : ''}`}>
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            <FileText className="h-5 w-5" />
                                            {quote.quoteNumber}
                                        </CardTitle>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Calendar className="h-4 w-4" />
                                            Created: {new Date(quote.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-right space-y-2">
                                        <p className="text-2xl font-bold text-blue-600">${quote.total.toFixed(2)}</p>
                                        {converted ? (
                                            <Badge variant="success" className="flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3" />
                                                Converted to Order
                                            </Badge>
                                        ) : expired ? (
                                            <Badge variant="destructive" className="flex items-center gap-1">
                                                <XCircle className="h-3 w-3" />
                                                Expired
                                            </Badge>
                                        ) : (
                                            <Badge variant="default">
                                                Expires: {new Date(quote.expiresAt).toLocaleDateString()}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600">Product Type: {quote.productType}</p>
                                            <p className="text-sm text-gray-600">Subtotal: ${quote.subtotal.toFixed(2)}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigate(`/quotes/${quote.id}`)}
                                            >
                                                <FileText className="h-4 w-4 mr-2" />
                                                View Details
                                            </Button>
                                            {!converted && !expired && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleConvertToOrder(quote.id)}
                                                    className="bg-green-600 hover:bg-green-700"
                                                >
                                                    <ShoppingCart className="h-4 w-4 mr-2" />
                                                    Convert to Order
                                                </Button>
                                            )}
                                            {!converted && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteQuote(quote.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
