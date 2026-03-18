import { useEffect, useState } from 'react';
import { adminUserApi } from '../../services/api';
import { User } from '../../types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import {
    Loader2, UserX, UserCheck, X, ShoppingBag, FileText,
    Phone, MapPin, Building2, Calendar, Pencil, Save
} from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import { confirmToast } from '../../utils/confirmToast';
import { format } from 'date-fns';

interface UserWithCounts extends User {
    _count?: { orders: number; quotes: number };
}

interface UserDetail extends UserWithCounts {
    phone?: string;
    address?: string;
    updatedAt?: string;
    orders?: Array<{
        id: string;
        orderNumber: string;
        customerReference?: string;
        status: string;
        total: number;
        createdAt: string;
    }>;
    quotes?: Array<{
        id: string;
        quoteNumber: string;
        customerReference?: string;
        total: number;
        convertedToOrder?: string;
        createdAt: string;
        expiresAt: string;
    }>;
}

const STATUS_COLOURS: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PRODUCTION: 'bg-purple-100 text-purple-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

// ─── User Detail / Edit Dialog ─────────────────────────────────────────────
function UserDialog({
    userId,
    onClose,
    onUpdated,
}: {
    userId: string;
    onClose: () => void;
    onUpdated: (updated: Partial<UserWithCounts>) => void;
}) {
    const [user, setUser] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '', email: '', phone: '', company: '', address: '',
        role: 'CUSTOMER' as 'CUSTOMER' | 'ADMIN', isActive: true,
    });

    useEffect(() => {
        adminUserApi.getUserById(userId).then((data) => {
            setUser(data);
            setForm({
                name: data.name || '',
                email: data.email || '',
                phone: data.phone || '',
                company: data.company || '',
                address: data.address || '',
                role: data.role || 'CUSTOMER',
                isActive: data.isActive ?? true,
            });
        }).catch(() => {
            gooeyToast.error('Failed to load user details');
        }).finally(() => setLoading(false));
    }, [userId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await adminUserApi.updateUser(userId, form);
            gooeyToast.success('User updated');
            setEditing(false);
            onUpdated(form);
            if (user) setUser({ ...user, ...form });
        } catch (error) {
            gooeyToast.error('Failed to update user');
        } finally {
            setSaving(false);
        }
    };

    const fmtDate = (d: string) => format(new Date(d), 'MMM d, yyyy');

    return (
        /* Backdrop */
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Dialog Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-xl font-bold">
                        {loading ? 'Loading...' : user?.name}
                    </h2>
                    <div className="flex items-center gap-2">
                        {!loading && !editing && (
                            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                                <Pencil className="mr-1 h-3 w-3" />
                                Edit
                            </Button>
                        )}
                        {editing && (
                            <>
                                <Button size="sm" onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
                                    {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                                    Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                            </>
                        )}
                        <Button size="icon" variant="ghost" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Dialog Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : user ? (
                        <>
                            {/* Profile Section */}
                            {editing ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>Full Name</Label>
                                        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Email</Label>
                                        <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Phone</Label>
                                        <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Company</Label>
                                        <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1 sm:col-span-2">
                                        <Label>Address</Label>
                                        <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Role</Label>
                                        <select
                                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={form.role}
                                            onChange={e => setForm(f => ({ ...f, role: e.target.value as 'CUSTOMER' | 'ADMIN' }))}
                                        >
                                            <option value="CUSTOMER">CUSTOMER</option>
                                            <option value="ADMIN">ADMIN</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1 flex items-center gap-3 mt-6">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            checked={form.isActive}
                                            onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <Label htmlFor="isActive">Account Active</Label>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div className="flex items-start gap-2">
                                        <Phone className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Phone</p>
                                            <p className="font-medium">{user.phone || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Building2 className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Company</p>
                                            <p className="font-medium">{user.company || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Address</p>
                                            <p className="font-medium">{user.address || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Member Since</p>
                                            <p className="font-medium">{user.createdAt ? fmtDate(user.createdAt) : '—'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Orders & Quotes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Orders */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <ShoppingBag className="h-4 w-4 text-blue-500" />
                                        Recent Orders ({user.orders?.length ?? 0})
                                    </h4>
                                    {!user.orders?.length ? (
                                        <p className="text-xs text-gray-500 italic">No orders yet.</p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                            {user.orders.map(order => (
                                                <div key={order.id} className="flex items-center justify-between text-xs bg-gray-50 border rounded px-3 py-2">
                                                    <div>
                                                        <span className="font-mono font-medium">{order.orderNumber}</span>
                                                        {order.customerReference && (
                                                            <span className="text-gray-400 ml-1.5">({order.customerReference})</span>
                                                        )}
                                                        <span className="text-gray-400 ml-2">{fmtDate(order.createdAt)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                                                            {order.status}
                                                        </span>
                                                        <span className="font-semibold">${Number(order.total).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Quotes */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <FileText className="h-4 w-4 text-purple-500" />
                                        Recent Quotes ({user.quotes?.length ?? 0})
                                    </h4>
                                    {!user.quotes?.length ? (
                                        <p className="text-xs text-gray-500 italic">No quotes yet.</p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                            {user.quotes.map(quote => (
                                                <div key={quote.id} className="flex items-center justify-between text-xs bg-gray-50 border rounded px-3 py-2">
                                                    <div>
                                                        <span className="font-mono font-medium">{quote.quoteNumber}</span>
                                                        {quote.customerReference && (
                                                            <span className="text-gray-400 ml-1.5">({quote.customerReference})</span>
                                                        )}
                                                        <span className="text-gray-400 ml-2">{fmtDate(quote.createdAt)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {quote.convertedToOrder ? (
                                                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Converted</span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Active</span>
                                                        )}
                                                        <span className="font-semibold">${Number(quote.total).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function UserManagement() {
    const [users, setUsers] = useState<UserWithCounts[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (searchTerm) params.search = searchTerm;
            const data = await adminUserApi.getAllUsers(params);
            setUsers(data.users as UserWithCounts[]);
        } catch (error) {
            gooeyToast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handler = setTimeout(() => { fetchUsers(); }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const toggleStatus = async (user: UserWithCounts, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!await confirmToast({
            title: user.isActive ? 'Deactivate User' : 'Activate User',
            message: `Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} ${user.name}?`,
            confirmText: user.isActive ? 'Deactivate' : 'Activate',
            variant: user.isActive ? 'danger' : 'info',
        })) return;
        try {
            await adminUserApi.updateUser(user.id, { isActive: !user.isActive });
            gooeyToast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
            setUsers(users.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
        } catch {
            gooeyToast.error('Failed to update user');
        }
    };

    const handleUserUpdated = (userId: string, updates: Partial<UserWithCounts>) => {
        setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u));
    };

    return (
        <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">Manage customer and admin accounts. Click a name to view profile and edit details.</p>
                </div>
                <div className="w-1/3">
                    <Input
                        placeholder="Search by name, email or company..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Users ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                        </div>
                    ) : (
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm text-left">
                                <thead>
                                    <tr className="border-b">
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Name</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Email</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Company</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground text-center">Orders</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground text-center">Quotes</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Role</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Status</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr
                                            key={user.id}
                                            className="border-b transition-colors hover:bg-muted/50"
                                        >
                                            <td className="p-4">
                                                <button
                                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                                                    onClick={() => setSelectedUserId(user.id)}
                                                >
                                                    {user.name}
                                                </button>
                                            </td>
                                            <td className="p-4">{user.email}</td>
                                            <td className="p-4">{user.company || <span className="text-gray-400">—</span>}</td>
                                            <td className="p-4 text-center">
                                                <span className="inline-flex items-center gap-1 text-xs font-medium">
                                                    <ShoppingBag className="h-3 w-3 text-blue-500" />
                                                    {user._count?.orders ?? 0}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="inline-flex items-center gap-1 text-xs font-medium">
                                                    <FileText className="h-3 w-3 text-purple-500" />
                                                    {user._count?.quotes ?? 0}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                                                    {user.role}
                                                </Badge>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant={user.isActive ? 'success' : 'destructive'}>
                                                    {user.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => toggleStatus(user, e)}
                                                    className={user.isActive
                                                        ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        : "text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    }
                                                >
                                                    {user.isActive ? (
                                                        <><UserX className="mr-2 h-4 w-4" />Deactivate</>
                                                    ) : (
                                                        <><UserCheck className="mr-2 h-4 w-4" />Activate</>
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                                No users found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* User Detail Dialog */}
            {selectedUserId && (
                <UserDialog
                    userId={selectedUserId}
                    onClose={() => setSelectedUserId(null)}
                    onUpdated={(updates) => handleUserUpdated(selectedUserId, updates)}
                />
            )}
        </div>
    );
}
