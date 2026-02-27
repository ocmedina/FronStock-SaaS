import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importLegacyBundle } from '@/lib/legacy-import';

function normalizeRelativePath(input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '');
  const safe = normalized
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
  return safe;
}

async function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

function detectBundleRoot(tempDir: string, relativePaths: string[]): string {
  if (relativePaths.length === 0) {
    return tempDir;
  }

  const firstSegments = relativePaths
    .map((p) => normalizeRelativePath(p).split('/')[0])
    .filter(Boolean);

  const first = firstSegments[0];
  if (!first) {
    return tempDir;
  }

  const sameTop = firstSegments.every((segment) => segment === first);
  if (sameTop) {
    return path.join(tempDir, first);
  }

  return tempDir;
}

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

    const formData = await request.formData();
    const files = formData.getAll('files').filter((item): item is File => item instanceof File);
    const paths = formData
      .getAll('paths')
      .map((item) => String(item || ''))
      .filter((value) => value.trim().length > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 });
    }

    if (paths.length !== files.length) {
      return NextResponse.json({ error: 'El payload de paths/files es inconsistente' }, { status: 400 });
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > 250 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            'El bundle supera 250MB para subida web. Usa Importación por Ruta local del servidor para bundles grandes.',
        },
        { status: 413 }
      );
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-import-'));

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const relativePath = normalizeRelativePath(paths[index] || file.name);
      if (!relativePath) {
        continue;
      }

      const absolutePath = path.join(tempDir, relativePath);
      await ensureDirForFile(absolutePath);

      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(absolutePath, buffer);
    }

    try {
      const bundleRoot = detectBundleRoot(tempDir, paths);
      const result = await importLegacyBundle(bundleRoot, {
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
