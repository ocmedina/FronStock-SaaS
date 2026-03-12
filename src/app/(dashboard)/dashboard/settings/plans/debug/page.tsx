import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

export default async function PlansDebugPage() {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // 1. Get Current User
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return <div>No authenticated user found.</div>;
    }

    // 2. Fetch Organization via User Client (RLS Applied)
    // We assume the user has a profile linking to an organization
    let userViewOrg = null;
    let userViewError = null;

    try {
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

        if (profile?.organization_id) {
            const { data, error } = await supabase
                .from("organizations")
                .select("*")
                .eq("id", profile.organization_id)
                .single();
            userViewOrg = data;
            userViewError = error;
        }
    } catch (e: any) {
        userViewError = e.message;
    }

    // 3. Fetch Organization via Admin Client (RLS Bypassed)
    let adminViewOrg = null;
    let adminViewError = null;
    let adminProfile = null;

    try {
        // We fetch the profile again with admin to be sure we have the ID to query orgs
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

        adminProfile = profile;

        if (profile?.organization_id) {
            const { data, error } = await supabaseAdmin
                .from("organizations")
                .select("*")
                .eq("id", profile.organization_id)
                .single();
            adminViewOrg = data;
            adminViewError = error;
        }
    } catch (e: any) {
        adminViewError = e.message;
    }

    return (
        <div className="p-8 space-y-8">
            <h1 className="text-2xl font-bold">Plans Diagnostic / Debug</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* User View Card */}
                <Card className="border-blue-200 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-blue-700">User View (RLS Applied)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-500">
                            Data seen by the standard authenticated client.
                        </p>

                        <div className="bg-gray-100 p-4 rounded text-xs font-mono overflow-auto max-h-60">
                            <pre>{JSON.stringify({ userViewOrg, userViewError }, null, 2)}</pre>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between border-b pb-1">
                                <span className="font-semibold">Plan Type:</span>
                                <Badge variant={userViewOrg?.plan_type ? "default" : "destructive"}>
                                    {userViewOrg?.plan_type || "UNKNOWN"}
                                </Badge>
                            </div>
                            <div className="flex justify-between border-b pb-1">
                                <span className="font-semibold">Updated At:</span>
                                <span>{userViewOrg?.updated_at || "N/A"}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Admin View Card */}
                <Card className="border-red-200 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-red-700">Admin View (RLS Bypassed)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-500">
                            Data seen by the Service Role client (Database Truth).
                        </p>

                        <div className="bg-gray-100 p-4 rounded text-xs font-mono overflow-auto max-h-60">
                            <pre>{JSON.stringify({ adminProfile, adminViewOrg, adminViewError }, null, 2)}</pre>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between border-b pb-1">
                                <span className="font-semibold">Plan Type:</span>
                                <Badge variant={adminViewOrg?.plan_type ? "default" : "destructive"}>
                                    {adminViewOrg?.plan_type || "UNKNOWN"}
                                </Badge>
                            </div>
                            <div className="flex justify-between border-b pb-1">
                                <span className="font-semibold">Updated At:</span>
                                <span>{adminViewOrg?.updated_at || "N/A"}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Discrepancy Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    {adminViewOrg?.plan_type === userViewOrg?.plan_type ? (
                        <div className="p-4 bg-green-100 text-green-800 rounded flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" /> Match: User and Admin see the same plan.
                        </div>
                    ) : (
                        <div className="p-4 bg-red-100 text-red-800 rounded flex items-center gap-2">
                            <XCircle className="h-5 w-5" /> mismatch: There is an RLS or Sync issue!
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
