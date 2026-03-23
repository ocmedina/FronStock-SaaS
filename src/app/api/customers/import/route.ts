import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { customers } = body;

        if (!Array.isArray(customers) || customers.length === 0) {
            return NextResponse.json({ error: "No se proporcionaron datos de clientes." }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado." }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

        if (profileError || !profile?.organization_id) {
            return NextResponse.json({ error: "No se pudo obtener la organización del usuario." }, { status: 403 });
        }

        const organization_id = profile.organization_id;

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

            const cleanCustomer = {
                organization_id,
                name: String(customer.name).trim(),
                tax_id: customer.tax_id ? String(customer.tax_id).trim() : null,
                email: customer.email ? String(customer.email).trim() : null,
                phone: customer.phone ? String(customer.phone).trim() : null,
                address: customer.address ? String(customer.address).trim() : null,
                balance: typeof customer.balance === "number" ? customer.balance : 0,
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
