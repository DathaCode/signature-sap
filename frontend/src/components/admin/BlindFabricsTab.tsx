import { useState, KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fabricsApi, AdminFabricSupplier } from '../../services/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { gooeyToast } from 'goey-toast';

const GROUP_STYLES: Record<string, string> = {
    G1: 'bg-blue-100 text-blue-700 border border-blue-200',
    G2: 'bg-green-100 text-green-700 border border-green-200',
    G3: 'bg-orange-100 text-orange-700 border border-orange-200',
    Budget: 'bg-purple-100 text-purple-700 border border-purple-200',
};
const GROUPS = ['G1', 'G2', 'G3', 'Budget'];

interface EditState {
    fabricType: string;
    fabricGroup: string;
    colors: string[];
    colorInput: string;
}

interface NewFabricState {
    fabricType: string;
    fabricGroup: string;
    colors: string[];
    colorInput: string;
}

interface AddSupplierState {
    supplierName: string;
    fabricType: string;
    fabricGroup: string;
    colors: string[];
    colorInput: string;
}

function ColorChips({
    colors,
    onRemove,
    colorInput,
    onColorInputChange,
    onColorInputKeyDown,
    placeholder = 'Add colour…',
}: {
    colors: string[];
    onRemove: (c: string) => void;
    colorInput: string;
    onColorInputChange: (v: string) => void;
    onColorInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
}) {
    return (
        <div className="flex flex-wrap gap-1 items-center border rounded-md px-2 py-1.5 min-h-[38px] bg-white">
            {colors.map(c => (
                <span
                    key={c}
                    className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs"
                >
                    {c}
                    <button
                        type="button"
                        onClick={() => onRemove(c)}
                        className="text-gray-400 hover:text-red-500"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </span>
            ))}
            <input
                type="text"
                value={colorInput}
                onChange={e => onColorInputChange(e.target.value)}
                onKeyDown={onColorInputKeyDown}
                placeholder={colors.length === 0 ? placeholder : ''}
                className="flex-1 min-w-[100px] text-xs outline-none bg-transparent"
            />
        </div>
    );
}

function addColorFromInput(colors: string[], colorInput: string): { colors: string[]; colorInput: string } {
    const trimmed = colorInput.trim().replace(/,$/, '').trim();
    if (!trimmed) return { colors, colorInput: '' };
    if (colors.includes(trimmed)) return { colors, colorInput: '' };
    return { colors: [...colors, trimmed], colorInput: '' };
}

export default function BlindFabricsTab() {
    const queryClient = useQueryClient();

    const { data: suppliers = [], isLoading } = useQuery<AdminFabricSupplier[]>({
        queryKey: ['blind-fabrics-admin'],
        queryFn: fabricsApi.getAdmin,
    });

    const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set(
        suppliers.map(s => s.name)
    ));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editState, setEditState] = useState<EditState>({ fabricType: '', fabricGroup: 'G1', colors: [], colorInput: '' });
    const [addingToSupplier, setAddingToSupplier] = useState<string | null>(null);
    const [newFabric, setNewFabric] = useState<NewFabricState>({ fabricType: '', fabricGroup: 'G1', colors: [], colorInput: '' });
    const [showAddSupplier, setShowAddSupplier] = useState(false);
    const [addSupplier, setAddSupplier] = useState<AddSupplierState>({
        supplierName: '', fabricType: '', fabricGroup: 'G1', colors: [], colorInput: '',
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['blind-fabrics-admin'] });
        queryClient.invalidateQueries({ queryKey: ['blind-fabrics'] });
    };

    const addMutation = useMutation({
        mutationFn: fabricsApi.addFabric,
        onSuccess: () => { invalidate(); gooeyToast.success('Fabric added'); },
        onError: (e: any) => gooeyToast.error(e?.response?.data?.message || 'Failed to add fabric'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: { fabricType?: string; fabricGroup?: string; colors?: string[] } }) =>
            fabricsApi.updateFabric(id, data),
        onSuccess: () => { invalidate(); gooeyToast.success('Fabric updated'); setEditingId(null); },
        onError: () => gooeyToast.error('Failed to update fabric'),
    });

    const deleteFabricMutation = useMutation({
        mutationFn: fabricsApi.deleteFabric,
        onSuccess: () => { invalidate(); gooeyToast.success('Fabric removed'); },
        onError: () => gooeyToast.error('Failed to delete fabric'),
    });

    const deleteSupplierMutation = useMutation({
        mutationFn: fabricsApi.deleteSupplier,
        onSuccess: () => { invalidate(); gooeyToast.success('Supplier removed'); },
        onError: () => gooeyToast.error('Failed to delete supplier'),
    });

    const toggleSupplier = (name: string) => {
        setExpandedSuppliers(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const startEdit = (id: string, fabricType: string, fabricGroup: string, colors: string[]) => {
        setEditingId(id);
        setEditState({ fabricType, fabricGroup, colors: [...colors], colorInput: '' });
        setAddingToSupplier(null);
    };

    const saveEdit = () => {
        if (!editingId) return;
        const finalColors = editState.colorInput.trim()
            ? [...editState.colors, editState.colorInput.trim()]
            : editState.colors;
        updateMutation.mutate({
            id: editingId,
            data: { fabricType: editState.fabricType, fabricGroup: editState.fabricGroup, colors: finalColors },
        });
    };

    const handleEditColorKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const result = addColorFromInput(editState.colors, editState.colorInput);
            setEditState(s => ({ ...s, ...result }));
        } else if (e.key === 'Backspace' && !editState.colorInput && editState.colors.length > 0) {
            setEditState(s => ({ ...s, colors: s.colors.slice(0, -1) }));
        }
    };

    const handleNewFabricColorKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const result = addColorFromInput(newFabric.colors, newFabric.colorInput);
            setNewFabric(s => ({ ...s, ...result }));
        } else if (e.key === 'Backspace' && !newFabric.colorInput && newFabric.colors.length > 0) {
            setNewFabric(s => ({ ...s, colors: s.colors.slice(0, -1) }));
        }
    };

    const handleAddSupplierColorKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const result = addColorFromInput(addSupplier.colors, addSupplier.colorInput);
            setAddSupplier(s => ({ ...s, ...result }));
        } else if (e.key === 'Backspace' && !addSupplier.colorInput && addSupplier.colors.length > 0) {
            setAddSupplier(s => ({ ...s, colors: s.colors.slice(0, -1) }));
        }
    };

    const submitAddFabric = (supplier: string) => {
        const finalColors = newFabric.colorInput.trim()
            ? [...newFabric.colors, newFabric.colorInput.trim()]
            : newFabric.colors;
        if (!newFabric.fabricType.trim()) {
            gooeyToast.error('Fabric name is required');
            return;
        }
        addMutation.mutate(
            { supplier, fabricType: newFabric.fabricType.trim(), fabricGroup: newFabric.fabricGroup, colors: finalColors },
            {
                onSuccess: () => {
                    setAddingToSupplier(null);
                    setNewFabric({ fabricType: '', fabricGroup: 'G1', colors: [], colorInput: '' });
                },
            }
        );
    };

    const submitAddSupplier = () => {
        const finalColors = addSupplier.colorInput.trim()
            ? [...addSupplier.colors, addSupplier.colorInput.trim()]
            : addSupplier.colors;
        if (!addSupplier.supplierName.trim() || !addSupplier.fabricType.trim()) {
            gooeyToast.error('Supplier name and fabric name are required');
            return;
        }
        addMutation.mutate(
            {
                supplier: addSupplier.supplierName.trim(),
                fabricType: addSupplier.fabricType.trim(),
                fabricGroup: addSupplier.fabricGroup,
                colors: finalColors,
            },
            {
                onSuccess: () => {
                    setShowAddSupplier(false);
                    setAddSupplier({ supplierName: '', fabricType: '', fabricGroup: 'G1', colors: [], colorInput: '' });
                    setExpandedSuppliers(prev => new Set([...prev, addSupplier.supplierName.trim()]));
                },
            }
        );
    };

    const confirmDeleteSupplier = (name: string, count: number) => {
        if (!window.confirm(`Delete supplier "${name}" and all ${count} fabric(s) under it? This cannot be undone.`)) return;
        deleteSupplierMutation.mutate(name);
    };

    const confirmDeleteFabric = (id: string, name: string) => {
        if (!window.confirm(`Delete fabric "${name}"?`)) return;
        deleteFabricMutation.mutate(id);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {suppliers.reduce((acc, s) => acc + s.fabrics.length, 0)} fabrics across {suppliers.length} suppliers
                </p>
                <Button
                    size="sm"
                    onClick={() => { setShowAddSupplier(v => !v); setAddingToSupplier(null); }}
                    variant={showAddSupplier ? 'outline' : 'default'}
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Supplier
                </Button>
            </div>

            {/* Add Supplier form */}
            {showAddSupplier && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-blue-700">New Supplier + First Fabric</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Supplier Name</label>
                                <Input
                                    value={addSupplier.supplierName}
                                    onChange={e => setAddSupplier(s => ({ ...s, supplierName: e.target.value }))}
                                    placeholder="e.g. Luxaflex"
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Fabric Name</label>
                                <Input
                                    value={addSupplier.fabricType}
                                    onChange={e => setAddSupplier(s => ({ ...s, fabricType: e.target.value }))}
                                    placeholder="e.g. Pearl Blockout"
                                    className="h-8 text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Fabric Group</label>
                            <div className="flex gap-2">
                                {GROUPS.map(g => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => setAddSupplier(s => ({ ...s, fabricGroup: g }))}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                            addSupplier.fabricGroup === g
                                                ? GROUP_STYLES[g] + ' ring-2 ring-offset-1 ring-current'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Colours (press Enter to add)</label>
                            <ColorChips
                                colors={addSupplier.colors}
                                onRemove={c => setAddSupplier(s => ({ ...s, colors: s.colors.filter(x => x !== c) }))}
                                colorInput={addSupplier.colorInput}
                                onColorInputChange={v => setAddSupplier(s => ({ ...s, colorInput: v }))}
                                onColorInputKeyDown={handleAddSupplierColorKeyDown}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowAddSupplier(false)}>Cancel</Button>
                            <Button size="sm" onClick={submitAddSupplier} disabled={addMutation.isPending}>
                                {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                Create Supplier
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Suppliers accordion */}
            {suppliers.length === 0 && !showAddSupplier && (
                <div className="text-center py-12 text-muted-foreground">
                    No fabrics found. Add a supplier to get started.
                </div>
            )}

            {suppliers.map(supplier => (
                <Card key={supplier.name} className="overflow-hidden">
                    {/* Supplier header */}
                    <div
                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 select-none border-b"
                        onClick={() => toggleSupplier(supplier.name)}
                    >
                        <div className="flex items-center gap-2">
                            {expandedSuppliers.has(supplier.name)
                                ? <ChevronDown className="h-4 w-4 text-gray-500" />
                                : <ChevronRight className="h-4 w-4 text-gray-500" />
                            }
                            <span className="font-semibold text-sm">{supplier.name}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                                {supplier.fabrics.length} fabric{supplier.fabrics.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); confirmDeleteSupplier(supplier.name, supplier.fabrics.length); }}
                            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete supplier"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Fabric rows */}
                    {expandedSuppliers.has(supplier.name) && (
                        <div>
                            {supplier.fabrics.length === 0 && (
                                <div className="px-4 py-3 text-sm text-muted-foreground">No fabrics yet.</div>
                            )}

                            {supplier.fabrics.map(fabric => (
                                <div key={fabric.id} className="border-b last:border-b-0">
                                    {editingId === fabric.id ? (
                                        /* Edit row */
                                        <div className="px-4 py-3 space-y-2 bg-yellow-50">
                                            <div className="flex gap-2 items-start flex-wrap">
                                                <div className="flex-1 min-w-[180px]">
                                                    <Input
                                                        value={editState.fabricType}
                                                        onChange={e => setEditState(s => ({ ...s, fabricType: e.target.value }))}
                                                        className="h-8 text-sm"
                                                        placeholder="Fabric name"
                                                    />
                                                </div>
                                                <div className="flex gap-1 items-center">
                                                    {GROUPS.map(g => (
                                                        <button
                                                            key={g}
                                                            type="button"
                                                            onClick={() => setEditState(s => ({ ...s, fabricGroup: g }))}
                                                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                                editState.fabricGroup === g
                                                                    ? GROUP_STYLES[g] + ' ring-1 ring-current'
                                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            {g}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <ColorChips
                                                colors={editState.colors}
                                                onRemove={c => setEditState(s => ({ ...s, colors: s.colors.filter(x => x !== c) }))}
                                                colorInput={editState.colorInput}
                                                onColorInputChange={v => setEditState(s => ({ ...s, colorInput: v }))}
                                                onColorInputKeyDown={handleEditColorKeyDown}
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingId(null)}
                                                    className="p-1 rounded text-gray-500 hover:bg-gray-200"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={saveEdit}
                                                    disabled={updateMutation.isPending}
                                                    className="p-1 rounded text-green-600 hover:bg-green-100 disabled:opacity-50"
                                                >
                                                    {updateMutation.isPending
                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                        : <Check className="h-4 w-4" />
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Display row */
                                        <div className="px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 group">
                                            <div className="flex items-center gap-2 min-w-[200px] flex-shrink-0 pt-0.5">
                                                <span className="text-sm font-medium text-gray-800">{fabric.fabricType}</span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${GROUP_STYLES[fabric.fabricGroup] ?? 'bg-gray-100 text-gray-600'}`}>
                                                    {fabric.fabricGroup}
                                                </span>
                                            </div>
                                            <div className="flex-1 flex flex-wrap gap-1">
                                                {fabric.colors.length === 0
                                                    ? <span className="text-xs text-muted-foreground italic">No colours</span>
                                                    : fabric.colors.map(c => (
                                                        <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                                            {c}
                                                        </span>
                                                    ))
                                                }
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(fabric.id, fabric.fabricType, fabric.fabricGroup, fabric.colors)}
                                                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => confirmDeleteFabric(fabric.id, fabric.fabricType)}
                                                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Add fabric row */}
                            {addingToSupplier === supplier.name ? (
                                <div className="px-4 py-3 space-y-2 bg-green-50 border-t">
                                    <div className="flex gap-2 items-start flex-wrap">
                                        <div className="flex-1 min-w-[180px]">
                                            <Input
                                                value={newFabric.fabricType}
                                                onChange={e => setNewFabric(s => ({ ...s, fabricType: e.target.value }))}
                                                className="h-8 text-sm"
                                                placeholder="Fabric name"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="flex gap-1 items-center">
                                            {GROUPS.map(g => (
                                                <button
                                                    key={g}
                                                    type="button"
                                                    onClick={() => setNewFabric(s => ({ ...s, fabricGroup: g }))}
                                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                        newFabric.fabricGroup === g
                                                            ? GROUP_STYLES[g] + ' ring-1 ring-current'
                                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <ColorChips
                                        colors={newFabric.colors}
                                        onRemove={c => setNewFabric(s => ({ ...s, colors: s.colors.filter(x => x !== c) }))}
                                        colorInput={newFabric.colorInput}
                                        onColorInputChange={v => setNewFabric(s => ({ ...s, colorInput: v }))}
                                        onColorInputKeyDown={handleNewFabricColorKeyDown}
                                        placeholder="Type a colour and press Enter…"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setAddingToSupplier(null);
                                                setNewFabric({ fabricType: '', fabricGroup: 'G1', colors: [], colorInput: '' });
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => submitAddFabric(supplier.name)}
                                            disabled={addMutation.isPending}
                                        >
                                            {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                            Add Fabric
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-4 py-2 border-t bg-gray-50">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAddingToSupplier(supplier.name);
                                            setEditingId(null);
                                            setNewFabric({ fabricType: '', fabricGroup: 'G1', colors: [], colorInput: '' });
                                        }}
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Fabric
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            ))}
        </div>
    );
}
