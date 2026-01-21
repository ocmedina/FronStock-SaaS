'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, Tags } from 'lucide-react';

interface Category {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    created_at: string;
}

export default function CategoriesPage() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);

    const supabase = createClient();

    const fetchCategories = async () => {
        if (!organizationId) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name');

        if (!error && data) {
            setCategories(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (organizationId) {
            fetchCategories();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId) return;

        setSaving(true);

        if (editingCategory) {
            await supabase
                .from('categories')
                .update({ name: formData.name, description: formData.description || null })
                .eq('id', editingCategory.id);
        } else {
            await supabase
                .from('categories')
                .insert({
                    organization_id: organizationId,
                    name: formData.name,
                    description: formData.description || null,
                });
        }

        setSaving(false);
        setShowModal(false);
        setEditingCategory(null);
        setFormData({ name: '', description: '' });
        fetchCategories();
    };

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar esta categoría?')) {
            await supabase.from('categories').delete().eq('id', id);
            fetchCategories();
        }
    };

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setFormData({ name: category.name, description: category.description || '' });
        setShowModal(true);
    };

    if (orgLoading || isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Categorías</h1>
                    <p className="text-muted-foreground">{categories.length} categorías</p>
                </div>
                <Button onClick={() => { setEditingCategory(null); setFormData({ name: '', description: '' }); setShowModal(true); }}>
                    <Plus /> Nueva Categoría
                </Button>
            </div>

            {/* Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            No hay categorías. ¡Crea la primera!
                        </CardContent>
                    </Card>
                ) : (
                    categories.map((category) => (
                        <Card key={category.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                            <Tags className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{category.name}</h3>
                                            {category.description && (
                                                <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => openEditModal(category)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleDelete(category.id)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal */}
            <Dialog open={showModal} onOpenChange={() => { setShowModal(false); setEditingCategory(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descripción</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => { setShowModal(false); setEditingCategory(null); }} className="flex-1">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving} className="flex-1">
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {saving ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
