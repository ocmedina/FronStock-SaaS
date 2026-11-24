import { NextResponse } from "next/server";
import { requireOrganizationPermission } from "@/actions/_permissions";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { customers } = body;

        if (!Array.isArray(customers) || customers.length === 0) {
            return NextResponse.json({ error: "No se proporcionaron datos de clientes." }, { status: 400 });
        }

        const guard = await requireOrganizationPermission("customers", "create");
        if (!guard.allowed || !guard.organizationId) {
            return NextResponse.json({ error: guard.error || "No autorizado." }, { status: 403 });
        }

        const supabase = await createClient();
        const organization_id = guard.organizationId;

        const results = {
            successCount: 0,
            errorCount: 0,
            errors: [] as string[]
        };

        // Procesar clientes en serie o lotes pequeños en vez de insert masivo total
        // para asegurar que los registros válidos se inserten sin que un registro inválido aborte toda la petición.
        for (const customer of customers) {
            if (!customer.name) {
                results.errorCount++;
                continue;
            }

            let parsedCustomerType = "retail";
            if (customer.customer_type) {
                const typeStr = String(customer.customer_type).toLowerCase();
                if (typeStr.includes("mayor") || typeStr.includes("wholesale")) {
                    parsedCustomerType = "wholesale";
                }
            }

            const importedBalance = customer.balance === undefined || customer.balance === null
                ? 0
                : Number(customer.balance);
            if (!Number.isFinite(importedBalance)) {
                results.errorCount++;
                results.errors.push(`Saldo inicial inválido para cliente: ${customer.name}`);
                continue;
            }

            const cleanCustomer = {
                organization_id,
                name: String(customer.name).trim(),
                tax_id: customer.tax_id ? String(customer.tax_id).trim() : null,
                email: customer.email ? String(customer.email).trim() : null,
                phone: customer.phone ? String(customer.phone).trim() : null,
                address: customer.address ? String(customer.address).trim() : null,
                balance: importedBalance,
                customer_type: parsedCustomerType,
            };

            const { error: insertError } = await supabase
                .from("customers")
                .insert([cleanCustomer]);

            if (insertError) {
                console.error("Error inserting customer:", cleanCustomer.name, insertError.message);
                results.errorCount++;
                results.errors.push(insertError.message);
            } else {
                results.successCount++;
            }
        }

        return NextResponse.json(results);

    } catch (error: any) {
        console.error("Import customers API error:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor." }, { status: 500 });
    }
}
