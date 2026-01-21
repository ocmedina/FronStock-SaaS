'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { TenantEntity } from '@/types/database.types';

interface UseSupabaseTableOptions {
    table: string;
}

interface QueryOptions {
    select?: string;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    offset?: number;
    filters?: Record<string, unknown>;
}

interface UseSupabaseTableReturn<T extends TenantEntity> {
    data: T[];
    isLoading: boolean;
    error: string | null;
    getAll: (options?: QueryOptions) => Promise<T[]>;
    getById: (id: string) => Promise<T | null>;
    create: (data: Omit<T, keyof TenantEntity>) => Promise<T | null>;
    update: (id: string, data: Partial<Omit<T, keyof TenantEntity>>) => Promise<T | null>;
    remove: (id: string) => Promise<boolean>;
}

/**
 * Hook multi-tenant para operaciones CRUD en Supabase
 * Inyecta automáticamente organization_id en insert y filtra en select
 */
export function useSupabaseTable<T extends TenantEntity>({
    table,
}: UseSupabaseTableOptions): UseSupabaseTableReturn<T> {
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { organizationId } = useOrganization();
    const supabase = createClient();

    const ensureOrganizationId = useCallback(() => {
        if (!organizationId) {
            throw new Error('No organization context available');
        }
        return organizationId;
    }, [organizationId]);

    /**
     * Obtener todos los registros (filtrados por organization_id)
     */
    const getAll = useCallback(async (options?: QueryOptions): Promise<T[]> => {
        try {
            setIsLoading(true);
            setError(null);

            const orgId = ensureOrganizationId();

            let query = supabase
                .from(table)
                .select(options?.select || '*')
                .eq('organization_id', orgId);

            // Aplicar filtros adicionales
            if (options?.filters) {
                Object.entries(options.filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        query = query.eq(key, value);
                    }
                });
            }

            // Ordenamiento
            if (options?.orderBy) {
                query = query.order(options.orderBy.column, {
                    ascending: options.orderBy.ascending ?? true,
                });
            }

            // Paginación
            if (options?.limit) {
                query = query.limit(options.limit);
            }
            if (options?.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
            }

            const { data: result, error: queryError } = await query;

            if (queryError) {
                throw new Error(queryError.message);
            }

            const typedResult = (result ?? []) as unknown as T[];
            setData(typedResult);
            return typedResult;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error fetching data';
            setError(message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [supabase, table, ensureOrganizationId]);

    /**
     * Obtener un registro por ID (verificando organization_id)
     */
    const getById = useCallback(async (id: string): Promise<T | null> => {
        try {
            setIsLoading(true);
            setError(null);

            const orgId = ensureOrganizationId();

            const { data: result, error: queryError } = await supabase
                .from(table)
                .select('*')
                .eq('id', id)
                .eq('organization_id', orgId)
                .single();

            if (queryError) {
                throw new Error(queryError.message);
            }

            return result as T;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error fetching record';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [supabase, table, ensureOrganizationId]);

    /**
     * Crear un nuevo registro (inyecta organization_id automáticamente)
     */
    const create = useCallback(async (
        insertData: Omit<T, keyof TenantEntity>
    ): Promise<T | null> => {
        try {
            setIsLoading(true);
            setError(null);

            const orgId = ensureOrganizationId();

            const { data: result, error: insertError } = await supabase
                .from(table)
                .insert({
                    ...insertData,
                    organization_id: orgId,
                })
                .select()
                .single();

            if (insertError) {
                throw new Error(insertError.message);
            }

            // Actualizar lista local
            setData((prev) => [...prev, result as T]);

            return result as T;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error creating record';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [supabase, table, ensureOrganizationId]);

    /**
     * Actualizar un registro (verifica organization_id)
     */
    const update = useCallback(async (
        id: string,
        updateData: Partial<Omit<T, keyof TenantEntity>>
    ): Promise<T | null> => {
        try {
            setIsLoading(true);
            setError(null);

            const orgId = ensureOrganizationId();

            const { data: result, error: updateError } = await supabase
                .from(table)
                .update({
                    ...updateData,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('organization_id', orgId)
                .select()
                .single();

            if (updateError) {
                throw new Error(updateError.message);
            }

            // Actualizar lista local
            setData((prev) =>
                prev.map((item) => (item.id === id ? (result as T) : item))
            );

            return result as T;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error updating record';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [supabase, table, ensureOrganizationId]);

    /**
     * Eliminar un registro (verifica organization_id)
     */
    const remove = useCallback(async (id: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);

            const orgId = ensureOrganizationId();

            const { error: deleteError } = await supabase
                .from(table)
                .delete()
                .eq('id', id)
                .eq('organization_id', orgId);

            if (deleteError) {
                throw new Error(deleteError.message);
            }

            // Actualizar lista local
            setData((prev) => prev.filter((item) => item.id !== id));

            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error deleting record';
            setError(message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [supabase, table, ensureOrganizationId]);

    return {
        data,
        isLoading,
        error,
        getAll,
        getById,
        create,
        update,
        remove,
    };
}
