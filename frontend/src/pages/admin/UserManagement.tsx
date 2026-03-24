import { useEffect, useState } from 'react';
import { adminUserApi } from '../../services/api';
import { User } from '../../types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import {
    Loader2, UserX, UserCheck, X,
    Phone, MapPin, Building2, Calendar, Pencil, Save, ShieldCheck, Trash2
} from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import { confirmToast } from '../../utils/confirmToast';
import { format } from 'date-fns';

interface UserWithCounts extends User {
    _count?: { orders: number; quotes: number };
    isApproved?: boolean;
}

interface UserDetail extends UserWithCounts {
    phone?: string;
    address?: string;
    updatedAt?: string;
    isApproved?: boolean;
    discounts?: {
        G1: { acmeda: number; tbs: number; motorised: number };
        G2: { acmeda: number; tbs: number; motorised: number };
        G3: { acmeda: number; tbs: number; motorised: number };
        G4: { acmeda: number; tbs: number; motorised: number };
    } | null;
}

type DialogTab = 'discounts' | 'account';

const GROUPS = ['G1', 'G2', 'G3', 'G4'] as const;

const DEFAULT_DISCOUNTS = {
    G1: { acmeda: 0, tbs: 0, motorised: 0 },
    G2: { acmeda: 0, tbs: 0, motorised: 0 },
    G3: { acmeda: 0, tbs: 0, motorised: 0 },
    G4: { acmeda: 0, tbs: 0, motorised: 0 },
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
    const [activeTab, setActiveTab] = useState<DialogTab>('discounts');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingDiscounts, setSavingDiscounts] = useState(false);

    const [form, setForm] = useState({
        name: '', email: '', phone: '', company: '', address: '', isActive: true,
    });
    const [approving, setApproving] = useState(false);

    const [discounts, setDiscounts] = useState(DEFAULT_DISCOUNTS);

    useEffect(() => {
        adminUserApi.getUserById(userId).then((data) => {
            setUser(data);
            setForm({
                name: data.name || '',
                email: data.email || '',
                phone: data.phone || '',
                company: data.company || '',
                address: data.address || '',
                isActive: data.isActive ?? true,
            });
            if (data.discounts) {
                setDiscounts({
                    G1: { acmeda: 0, tbs: 0, motorised: 0, ...data.discounts.G1 },
                    G2: { acmeda: 0, tbs: 0, motorised: 0, ...data.discounts.G2 },
                    G3: { acmeda: 0, tbs: 0, motorised: 0, ...data.discounts.G3 },
                    G4: { acmeda: 0, tbs: 0, motorised: 0, ...data.discounts.G4 },
                });
            } else {
                setDiscounts(DEFAULT_DISCOUNTS);
            }
        }).catch(() => {
            gooeyToast.error('Failed to load user details');
        }).finally(() => setLoading(false));
    }, [userId]);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await adminUserApi.updateUser(userId, form);
            gooeyToast.success('Profile updated');
            setEditing(false);
            onUpdated(form);
            if (user) setUser({ ...user, ...form });
        } catch {
            gooeyToast.error('Failed to update user');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDiscounts = async () => {
        setSavingDiscounts(true);
        try {
            await adminUserApi.setUserDiscounts(userId, discounts);
            gooeyToast.success('Discounts saved');
            if (user) setUser({ ...user, discounts });
        } catch {
            gooeyToast.error('Failed to save discounts');
        } finally {
            setSavingDiscounts(false);
        }
    };

    const handleResetDiscounts = () => {
        setDiscounts(DEFAULT_DISCOUNTS);
    };

    const handleApprove = async () => {
        setApproving(true);
        try {
            await adminUserApi.updateUser(userId, { isApproved: true } as any);
            gooeyToast.success('User approved');
            if (user) setUser({ ...user, isApproved: true });
            onUpdated({ isApproved: true } as any);
        } catch {
            gooeyToast.error('Failed to approve user');
        } finally {
            setApproving(false);
        }
    };

    const setDiscount = (group: typeof GROUPS[number], supplier: 'acmeda' | 'tbs' | 'motorised', value: string) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 100) return;
        setDiscounts(prev => ({ ...prev, [group]: { ...prev[group], [supplier]: num } }));
    };

    const fmtDate = (d: string) => format(new Date(d), 'MMM d, yyyy');

    const tabClass = (tab: DialogTab) =>
        `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
        }`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
                {/* Header */}
                <div className="px-6 pt-5 pb-3 border-b">
                    <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                {loading ? '?' : user?.name?.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold leading-tight">
                                    {loading ? 'Loading...' : user?.name}
                                </h2>
                                {!loading && user && (
                                    <p className="text-xs text-gray-500">
                                        {user.company || '—'} · Member since {user.createdAt ? fmtDate(user.createdAt) : '—'}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {user && !user.isApproved && (
                                <Button size="sm" onClick={handleApprove} disabled={approving} className="bg-amber-500 hover:bg-amber-600 text-white">
                                    {approving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
                                    Approve
                                </Button>
                            )}
                            {activeTab === 'account' && !editing && (
                                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                                    <Pencil className="mr-1 h-3 w-3" />
                                    Edit profile
                                </Button>
                            )}
                            {activeTab === 'account' && editing && (
                                <>
                                    <Button size="sm" onClick={handleSaveProfile} disabled={saving} className="bg-green-600 hover:bg-green-700">
                                        {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                                        Save
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                                </>
                            )}
                            <Button size="icon" variant="ghost" onClick={onClose} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-0 mt-3 -mb-3">
                        <button className={tabClass('discounts')} onClick={() => setActiveTab('discounts')}>
                            Customer discounts
                        </button>
                        <button className={tabClass('account')} onClick={() => setActiveTab('account')}>
                            Account info
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : user ? (
                        <>
                            {/* ── Discounts Tab ── */}
                            {activeTab === 'discounts' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-500">
                                        Set per-group fabric discounts for Acmeda, TBS, and Motorised suppliers. These override the default pricing for this customer.
                                    </p>

                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Fabric Group</th>
                                                    <th className="px-4 py-3 text-left font-medium text-blue-600 text-xs uppercase tracking-wide">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                                                            Acmeda (%)
                                                        </span>
                                                    </th>
                                                    <th className="px-4 py-3 text-left font-medium text-green-600 text-xs uppercase tracking-wide">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                                                            TBS (%)
                                                        </span>
                                                    </th>
                                                    <th className="px-4 py-3 text-left font-medium text-purple-600 text-xs uppercase tracking-wide">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span className="h-2 w-2 rounded-full bg-purple-500 inline-block" />
                                                            Motorised (%)
                                                        </span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {GROUPS.map((group) => (
                                                    <tr key={group} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-3 font-semibold text-gray-800">
                                                            Group {group.replace('G', '')}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    step={0.5}
                                                                    value={discounts[group].acmeda}
                                                                    onChange={e => setDiscount(group, 'acmeda', e.target.value)}
                                                                    className="w-16 h-9 rounded-lg border border-gray-300 px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                />
                                                                <span className="text-gray-400 text-sm">%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    step={0.5}
                                                                    value={discounts[group].tbs}
                                                                    onChange={e => setDiscount(group, 'tbs', e.target.value)}
                                                                    className="w-16 h-9 rounded-lg border border-gray-300 px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                                                />
                                                                <span className="text-gray-400 text-sm">%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    step={0.5}
                                                                    value={discounts[group].motorised}
                                                                    onChange={e => setDiscount(group, 'motorised', e.target.value)}
                                                                    className="w-16 h-9 rounded-lg border border-gray-300 px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                                />
                                                                <span className="text-gray-400 text-sm">%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button variant="outline" onClick={handleResetDiscounts}>
                                            Reset
                                        </Button>
                                        <Button onClick={handleSaveDiscounts} disabled={savingDiscounts} className="bg-blue-600 hover:bg-blue-700">
                                            {savingDiscounts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Save discounts
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ── Account Info Tab ── */}
                            {activeTab === 'account' && (
                                <div>
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
                                            {user?.role !== 'ADMIN' && (
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
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="flex items-start gap-3">
                                                <Phone className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Phone</p>
                                                    <p className="font-medium text-sm">{user.phone || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Building2 className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Company</p>
                                                    <p className="font-medium text-sm">{user.company || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <MapPin className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Address</p>
                                                    <p className="font-medium text-sm">{user.address || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Calendar className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Member Since</p>
                                                    <p className="font-medium text-sm">{user.createdAt ? fmtDate(user.createdAt) : '—'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
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

    const deleteUser = async (user: UserWithCounts, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!await confirmToast({
            title: 'Delete User',
            message: `Permanently delete ${user.name}? This cannot be undone. Users with existing orders cannot be deleted.`,
            confirmText: 'Delete',
            variant: 'danger',
        })) return;
        try {
            await adminUserApi.deleteUser(user.id);
            gooeyToast.success('User deleted');
            setUsers(users.filter(u => u.id !== user.id));
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to delete user';
            gooeyToast.error(msg);
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
                                                <span className="text-xs font-medium text-gray-600">{user._count?.orders ?? 0}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-xs font-medium text-gray-600">{user._count?.quotes ?? 0}</span>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                                                    {user.role}
                                                </Badge>
                                            </td>
                                            <td className="p-4">
                                                {user.isApproved === false ? (
                                                    <Badge variant="outline" className="text-amber-600 border-amber-400">Pending</Badge>
                                                ) : (
                                                    <Badge variant={user.isActive ? 'success' : 'destructive'}>
                                                        {user.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                {user.role !== 'ADMIN' && (
                                                    <div className="flex items-center justify-end gap-1">
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
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => deleteUser(user, e)}
                                                            className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                            title="Delete user permanently"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
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
