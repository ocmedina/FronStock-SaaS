import { redirect } from "next/navigation";
import { DeveloperConsole } from "@/components/developer/DeveloperConsole";
import { requireDeveloperAccess } from "@/lib/developer-access";

export default async function DeveloperConsolePage() {
  const guard = await requireDeveloperAccess();
  if (!guard.allowed) redirect("/dashboard");
  return <DeveloperConsole />;
}
