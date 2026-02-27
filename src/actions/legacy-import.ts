'use server';

import { requireOrganizationPermission } from '@/actions/_permissions';
import { importLegacyBundle } from '@/lib/legacy-import';

export async function runLegacyImport(bundlePath: string) {
  const guard = await requireOrganizationPermission('settings', 'edit');
  if (!guard.allowed) {
    return { error: guard.error || 'No autorizado' };
  }

  if (!guard.organizationId) {
    return { error: 'No se pudo determinar la organización actual' };
  }

  const normalizedPath = String(bundlePath || '').trim();
  if (!normalizedPath) {
    return { error: 'Debes indicar un bundlePath válido' };
  }

  try {
    const result = await importLegacyBundle(normalizedPath, {
      enforceOrganizationId: guard.organizationId,
    });

    return {
      success: true,
      result: {
        ...result,
        errors: result.errors.slice(0, 200),
        tableResults: result.tableResults.map((table) => ({
          ...table,
          rowErrors: table.rowErrors.slice(0, 50),
        })),
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }
}
