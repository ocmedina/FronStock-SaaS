'use server';

import { createClient } from '@/lib/supabase/server';

type AuditAction = 'insert' | 'update' | 'delete' | 'custom';

type LogAuditInput = {
  organizationId: string;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  // Si se pasa actorUserId explícitamente (casos edge). Si no, se lee del contexto auth.
  actorUserId?: string | null;
};

/**
 * Registra un evento de auditoría en la tabla audit_logs.
 * El actor se lee del usuario autenticado en el servidor automáticamente.
 */
export async function logAuditEvent(input: LogAuditInput) {
  if (!input.organizationId || !input.action || !input.entity) {
    return;
  }

  try {
    const supabase = await createClient();

    // Obtener el usuario autenticado en el servidor para el actor_user_id
    let actorUserId: string | null = input.actorUserId ?? null;
    if (!actorUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      actorUserId = user?.id ?? null;
    }

    await supabase.from('audit_logs').insert({
      organization_id: input.organizationId,
      actor_user_id: actorUserId,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    // La auditoría nunca debe romper el flujo principal
    console.error('No se pudo registrar evento de auditoria:', error);
  }
}
