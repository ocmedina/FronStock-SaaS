import { NextResponse } from "next/server";
import { requireOrganizationPermission } from "@/actions/_permissions";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { movements } = body;

        if (!Array.isArray(movements) || movements.length === 0) {
            return NextResponse.json({ error: "No se proporcionaron movimientos." }, { status: 400 });
        }

        const guard = await requireOrganizationPermission("customers", "edit");
        if (!guard.allowed || !guard.organizationId) {
            return NextResponse.json({ error: guard.error || "No autorizado." }, { status: 403 });
        }

        const supabase = await createClient();
        const orgId = guard.organizationId;

        // Fetch all customers for this org to match identifiers
        const { data: customersList, error: customersError } = await supabase
            .from("customers")
            .select("id, name, tax_id")
            .eq("organization_id", orgId);

        if (customersError) {
            console.error("Error fetching customers to map history:", customersError);
            return NextResponse.json({ error: "Error al acceder a la base de clientes." }, { status: 500 });
        }

        const customersByName = new Map<string, string>();
        const customersByTaxId = new Map<string, string>();

        customersList?.forEach(c => {
            if (c.name) customersByName.set(c.name.toLowerCase().trim(), c.id);
            if (c.tax_id) customersByTaxId.set(c.tax_id.toLowerCase().trim(), c.id);
        });

        const results = {
            successCount: 0,
            errorCount: 0,
            errors: [] as string[]
        };

        const recordsToInsert = [];

        for (const mov of movements) {
            if (!mov.customer_identifier || !mov.amount || !mov.type || !mov.date) {
                results.errorCount++;
                continue;
            }

            const identifier = String(mov.customer_identifier).toLowerCase().trim();
            let customerId = customersByTaxId.get(identifier) || customersByName.get(identifier);

            // Si no encuentra coincidencia exacta, a veces puede haber pequeñas diferencias en el texto
            // Pero para historial financiero es mejor fallar que asignar dinero a la persona equivocada.
            if (!customerId) {
                results.errorCount++;
                results.errors.push(`Cliente no encontrado: ${mov.customer_identifier}`);
                continue;
            }

            let movType = "charge";
            const typeStr = String(mov.type).toLowerCase();
            if (typeStr.includes("pago") || typeStr.includes("payment") || typeStr.includes("abono")) {
                movType = "payment";
            }

            // Normalizar monto
            let amount = parseFloat(String(mov.amount).replace(/[^0-9.-]+/g, ""));
            if (isNaN(amount)) amount = 0;
            if (!Number.isFinite(amount) || amount <= 0) {
                results.errorCount++;
                results.errors.push(`Monto inválido para cliente: ${mov.customer_identifier}`);
                continue;
            }

            // Normalizar fecha. Excel puede mandar numeros y Javascript fechas.
            // Tratamos de convertirlo a formato ISO o valid Date
            let createdAt = new Date().toISOString();
            if (mov.date) {
                const parsedDate = new Date(mov.date);
                if (!isNaN(parsedDate.getTime())) {
                    createdAt = parsedDate.toISOString();
                } else {
                    // Si es un número (formato Excel)
                    const excelDate = Number(mov.date);
                    if (!isNaN(excelDate) && excelDate > 25000) {
                        const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
                        createdAt = jsDate.toISOString();
                    }
                }
            }

            recordsToInsert.push({
                customer_id: customerId,
                organization_id: orgId, // Added organization_id explicitly
                type: movType,
                amount: amount,
                description: mov.description ? String(mov.description).trim() : null,
                created_at: createdAt
            });
        }

        if (recordsToInsert.length === 0) {
            return NextResponse.json(results); // Todos fallaron o ninguno mapeable
        }

        const { data, error: importError } = await supabase.rpc("import_customer_account_movements", {
            p_org_id: orgId,
            p_movements: recordsToInsert,
        });

        if (importError) {
            console.error("Bulk import failed:", importError);
            return NextResponse.json({ error: `Db Error: ${importError.message}` }, { status: 500 });
        }

        const importResult = data as { success?: boolean; inserted_count?: number; error?: string } | null;
        if (!importResult?.success) {
            return NextResponse.json({ error: importResult?.error || "No se pudo importar el historial." }, { status: 400 });
        }

        results.successCount = Number(importResult.inserted_count || 0);

        return NextResponse.json(results);

    } catch (error: any) {
        console.error("Import history API error:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor." }, { status: 500 });
    }
}
