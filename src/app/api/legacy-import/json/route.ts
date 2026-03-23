import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';

// Allow large JSON bodies for full system migration
export const maxDuration = 120; // seconds
import { createClient } from '@/lib/supabase/server';
import { importLegacyBundle } from '@/lib/legacy-import';

async function canRunImport(): Promise<{ allowed: boolean; error?: string; organizationId?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, error: 'No autorizado' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.role || !profile.organization_id) {
    return { allowed: false, error: 'Perfil no válido' };
  }

  if (profile.role === 'owner') {
    return { allowed: true, organizationId: profile.organization_id };
  }

  const { data: perm } = await supabase
    .from('organization_permissions')
    .select('can_edit')
    .eq('organization_id', profile.organization_id)
    .eq('role', profile.role)
    .eq('module', 'settings')
    .maybeSingle();

  return {
    allowed: Boolean(perm?.can_edit),
    error: perm?.can_edit ? undefined : 'No tienes permisos para importar',
    organizationId: profile.organization_id,
  };
}

export async function POST(request: Request) {
  try {
    const auth = await canRunImport();
    if (!auth.allowed) {
      return NextResponse.json({ error: auth.error || 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const jsonData = body.data;

    if (!jsonData || typeof jsonData !== 'object') {
      return NextResponse.json({ error: 'El JSON no tiene una estructura válida' }, { status: 400 });
    }

    // Create a temporary bundle directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'json-import-'));
    const jsonDir = path.join(tempDir, 'json');
    await fs.mkdir(jsonDir, { recursive: true });

    // Extract source system info
    const sourceSystem = jsonData._source_system || jsonData.source_system || 'json_import';

    // Write export_report.json for source system detection
    await fs.writeFile(
      path.join(tempDir, 'export_report.json'),
      JSON.stringify({ source_system: sourceSystem }),
      'utf-8'
    );

    // Write each table as a separate JSON file in the json/ subdirectory
    const tableNames: string[] = [];

    // Many legacy exports structure data inside a "tables" key
    const tablesSource = (jsonData.tables && typeof jsonData.tables === 'object') ? jsonData.tables : jsonData;

    for (const [key, value] of Object.entries(tablesSource)) {
      // Skip metadata keys
      if (key.startsWith('_')) continue;

      if (Array.isArray(value)) {
        tableNames.push(key);
        await fs.writeFile(
          path.join(jsonDir, `${key}.json`),
          JSON.stringify(value, null, 2),
          'utf-8'
        );
      }
    }

    if (tableNames.length === 0) {
      await fs.rm(tempDir, { recursive: true, force: true });
      return NextResponse.json(
        { error: 'No se encontraron tablas en el JSON. Cada clave del objeto debe ser un array de filas.' },
        { status: 400 }
      );
    }

    try {
      const result = await importLegacyBundle(tempDir, {
        enforceOrganizationId: auth.organizationId,
      });

      return NextResponse.json({
        success: true,
        result: {
          ...result,
          errors: result.errors.slice(0, 200),
          tableResults: result.tableResults.map((table) => ({
            ...table,
            rowErrors: table.rowErrors.slice(0, 50),
          })),
        },
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
