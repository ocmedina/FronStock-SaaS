export function resolveDashboardModuleFromPath(pathname: string): string | null {
  const path = String(pathname || "").toLowerCase();

  if (!path.startsWith("/dashboard")) return null;
  if (path === "/dashboard") return "dashboard";

  if (path.startsWith("/dashboard/users")) return "users";
  if (path.startsWith("/dashboard/cash-registers")) return "settings";
  if (path.startsWith("/dashboard/permissions")) return "permissions";
  if (path.startsWith("/dashboard/settings")) return "settings";
  if (path.startsWith("/dashboard/reports")) return "reports";
  if (path.startsWith("/dashboard/cash-closing")) return "reports";

  if (
    path.startsWith("/dashboard/products")
  ) {
    return "products";
  }

  if (path.startsWith("/dashboard/stock")) return "stock";
  if (path.startsWith("/dashboard/categories")) return "categories";
  if (path.startsWith("/dashboard/suppliers")) return "suppliers";
  if (path.startsWith("/dashboard/purchases")) return "purchases";

  if (path.startsWith("/dashboard/customers")) return "customers";

  if (path.startsWith("/dashboard/sales")) return "sales";
  if (path.startsWith("/dashboard/invoices")) return "invoices";
  if (path.startsWith("/dashboard/promotions")) return "promotions";
  if (path.startsWith("/dashboard/orders")) return "orders";
  if (path.startsWith("/dashboard/delivery")) return "delivery";

  return "dashboard";
}
