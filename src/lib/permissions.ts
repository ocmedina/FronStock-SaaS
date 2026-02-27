// Sistema de roles y permisos dinámicos para FrontStock SaaS

export type Role = 'owner' | 'admin' | 'manager' | 'employee' | 'delivery' | 'viewer';

export const MODULES = [
    'dashboard',
    'products',
    'stock',
    'categories',
    'customers',
    'suppliers',
    'purchases',
    'sales',
    'invoices',
    'promotions',
    'orders',
    'delivery',
    'reports',
    'settings',
    'users',
    'permissions',
] as const;

export type Module = typeof MODULES[number];

export interface PermissionActions {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}


// Sub-módulos o Permisos Granulares
export const SUB_MODULES = [
    // Products
    'products:cost_price',
    'products:import',
    'products:export',
    // Sales
    'sales:view_all', // Ver ventas de todos. Si falso, solo ve las suyas
    'sales:view_metrics', // Ver métricas financieras
    // Users
    'users:manage_roles',
] as const;

export type SubModule = typeof SUB_MODULES[number];

export const subModuleLabels: Record<SubModule, string> = {
    'products:cost_price': 'Ver Precio de Costo',
    'products:import': 'Importar Productos (Excel)',
    'products:export': 'Exportar Productos',
    'sales:view_all': 'Ver Todas las Ventas',
    'sales:view_metrics': 'Ver Métricas Financieras',
    'users:manage_roles': 'Gestionar Roles',
};

// Permisos por defecto (se pueden personalizar por organización)
export const defaultRolePermissions: Record<Role, Record<string, PermissionActions>> = {
    owner: {
        dashboard: { view: true, create: true, edit: true, delete: true },
        products: { view: true, create: true, edit: true, delete: true },
        stock: { view: true, create: true, edit: true, delete: true },
        categories: { view: true, create: true, edit: true, delete: true },
        customers: { view: true, create: true, edit: true, delete: true },
        suppliers: { view: true, create: true, edit: true, delete: true },
        purchases: { view: true, create: true, edit: true, delete: true },
        sales: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: true, delete: true },
        promotions: { view: true, create: true, edit: true, delete: true },
        orders: { view: true, create: true, edit: true, delete: true },
        delivery: { view: true, create: true, edit: true, delete: true },
        reports: { view: true, create: true, edit: true, delete: true },
        settings: { view: true, create: true, edit: true, delete: true },
        users: { view: true, create: true, edit: true, delete: true },
        permissions: { view: true, create: true, edit: true, delete: true },
        // Granular defaults
        'products:cost_price': { view: true, create: false, edit: false, delete: false },
        'products:import': { view: true, create: false, edit: false, delete: false },
        'products:export': { view: true, create: false, edit: false, delete: false },
        'sales:view_all': { view: true, create: false, edit: false, delete: false },
        'sales:view_metrics': { view: true, create: false, edit: false, delete: false },
        'users:manage_roles': { view: true, create: false, edit: false, delete: false },
    },
    admin: {
        dashboard: { view: true, create: true, edit: true, delete: true },
        products: { view: true, create: true, edit: true, delete: true },
        stock: { view: true, create: true, edit: true, delete: true },
        categories: { view: true, create: true, edit: true, delete: true },
        customers: { view: true, create: true, edit: true, delete: true },
        suppliers: { view: true, create: true, edit: true, delete: true },
        purchases: { view: true, create: true, edit: true, delete: true },
        sales: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: true, delete: true },
        promotions: { view: true, create: true, edit: true, delete: true },
        orders: { view: true, create: true, edit: true, delete: true },
        delivery: { view: true, create: true, edit: true, delete: true },
        reports: { view: true, create: true, edit: true, delete: true },
        settings: { view: true, create: true, edit: true, delete: false },
        users: { view: true, create: true, edit: true, delete: false },
        permissions: { view: true, create: true, edit: true, delete: false },
        // Granular defaults
        'products:cost_price': { view: true, create: false, edit: false, delete: false },
        'products:import': { view: true, create: false, edit: false, delete: false },
        'products:export': { view: true, create: false, edit: false, delete: false },
        'sales:view_all': { view: true, create: false, edit: false, delete: false },
        'sales:view_metrics': { view: true, create: false, edit: false, delete: false },
        'users:manage_roles': { view: true, create: false, edit: false, delete: false },
    },
    manager: {
        dashboard: { view: true, create: false, edit: false, delete: false },
        products: { view: true, create: true, edit: true, delete: false },
        stock: { view: true, create: true, edit: true, delete: false },
        categories: { view: true, create: true, edit: true, delete: false },
        customers: { view: true, create: true, edit: true, delete: false },
        suppliers: { view: true, create: true, edit: true, delete: false },
        purchases: { view: true, create: true, edit: true, delete: false },
        sales: { view: true, create: true, edit: true, delete: false },
        invoices: { view: true, create: true, edit: true, delete: false },
        promotions: { view: true, create: true, edit: true, delete: false },
        orders: { view: true, create: true, edit: true, delete: false },
        delivery: { view: true, create: true, edit: true, delete: false },
        reports: { view: true, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        users: { view: true, create: false, edit: false, delete: false },
        permissions: { view: false, create: false, edit: false, delete: false },
        // Granular defaults
        'products:cost_price': { view: true, create: false, edit: false, delete: false },
        'products:import': { view: true, create: false, edit: false, delete: false },
        'products:export': { view: true, create: false, edit: false, delete: false },
        'sales:view_all': { view: true, create: false, edit: false, delete: false },
        'sales:view_metrics': { view: true, create: false, edit: false, delete: false },
        'users:manage_roles': { view: false, create: false, edit: false, delete: false },
    },
    employee: {
        dashboard: { view: true, create: false, edit: false, delete: false },
        products: { view: true, create: false, edit: false, delete: false },
        stock: { view: true, create: false, edit: false, delete: false },
        categories: { view: true, create: false, edit: false, delete: false },
        customers: { view: true, create: true, edit: false, delete: false },
        suppliers: { view: true, create: false, edit: false, delete: false },
        purchases: { view: true, create: false, edit: false, delete: false },
        sales: { view: true, create: true, edit: false, delete: false },
        invoices: { view: true, create: true, edit: false, delete: false },
        promotions: { view: true, create: true, edit: false, delete: false },
        orders: { view: true, create: true, edit: false, delete: false },
        delivery: { view: true, create: true, edit: false, delete: false },
        reports: { view: false, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        users: { view: false, create: false, edit: false, delete: false },
        permissions: { view: false, create: false, edit: false, delete: false },
        // Granular defaults
        'products:cost_price': { view: false, create: false, edit: false, delete: false }, // No ve costos
        'products:import': { view: false, create: false, edit: false, delete: false },
        'products:export': { view: false, create: false, edit: false, delete: false },
        'sales:view_all': { view: false, create: false, edit: false, delete: false }, // Solo sus ventas
        'sales:view_metrics': { view: false, create: false, edit: false, delete: false },
        'users:manage_roles': { view: false, create: false, edit: false, delete: false },
    },
    delivery: {
        dashboard: { view: true, create: false, edit: false, delete: false },
        products: { view: false, create: false, edit: false, delete: false },
        stock: { view: false, create: false, edit: false, delete: false },
        categories: { view: false, create: false, edit: false, delete: false },
        customers: { view: true, create: false, edit: false, delete: false },
        suppliers: { view: false, create: false, edit: false, delete: false },
        purchases: { view: false, create: false, edit: false, delete: false },
        sales: { view: true, create: false, edit: true, delete: false }, // Can see/edit sales (deliveries)
        invoices: { view: true, create: false, edit: true, delete: false },
        promotions: { view: true, create: false, edit: true, delete: false },
        orders: { view: true, create: false, edit: true, delete: false },
        delivery: { view: true, create: false, edit: true, delete: false },
        reports: { view: false, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        users: { view: false, create: false, edit: false, delete: false },
        permissions: { view: false, create: false, edit: false, delete: false },
        // Granular defaults
        'products:cost_price': { view: false, create: false, edit: false, delete: false },
        'products:import': { view: false, create: false, edit: false, delete: false },
        'products:export': { view: false, create: false, edit: false, delete: false },
        'sales:view_all': { view: false, create: false, edit: false, delete: false },
        'sales:view_metrics': { view: false, create: false, edit: false, delete: false },
        'users:manage_roles': { view: false, create: false, edit: false, delete: false },
    },
    viewer: {
        dashboard: { view: true, create: false, edit: false, delete: false },
        products: { view: true, create: false, edit: false, delete: false },
        stock: { view: true, create: false, edit: false, delete: false },
        categories: { view: true, create: false, edit: false, delete: false },
        customers: { view: true, create: false, edit: false, delete: false },
        suppliers: { view: true, create: false, edit: false, delete: false },
        purchases: { view: true, create: false, edit: false, delete: false },
        sales: { view: true, create: false, edit: false, delete: false },
        invoices: { view: true, create: false, edit: false, delete: false },
        promotions: { view: true, create: false, edit: false, delete: false },
        orders: { view: true, create: false, edit: false, delete: false },
        delivery: { view: true, create: false, edit: false, delete: false },
        reports: { view: true, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        users: { view: false, create: false, edit: false, delete: false },
        permissions: { view: false, create: false, edit: false, delete: false },
        // Granular defaults
        'products:cost_price': { view: true, create: false, edit: false, delete: false },
        'products:import': { view: false, create: false, edit: false, delete: false },
        'products:export': { view: false, create: false, edit: false, delete: false },
        'sales:view_all': { view: true, create: false, edit: false, delete: false },
        'sales:view_metrics': { view: true, create: false, edit: false, delete: false },
        'users:manage_roles': { view: false, create: false, edit: false, delete: false },
    },
};

// Etiquetas de roles en español
export const roleLabels: Record<Role, string> = {
    owner: 'Propietario',
    admin: 'Administrador',
    manager: 'Gerente',
    employee: 'Empleado',
    delivery: 'Repartidor',
    viewer: 'Solo lectura',
};

// Etiquetas de módulos en español
export const moduleLabels: Record<Module, string> = {
    dashboard: 'Dashboard',
    products: 'Productos',
    stock: 'Stock',
    categories: 'Categorías',
    customers: 'Clientes',
    suppliers: 'Proveedores',
    purchases: 'Compras',
    sales: 'Ventas',
    invoices: 'Facturación',
    promotions: 'Promociones',
    orders: 'Pedidos',
    delivery: 'Logística',
    reports: 'Reportes',
    settings: 'Configuración',
    users: 'Usuarios',
    permissions: 'Permisos',
};

// Descripciones de roles
export const roleDescriptions: Record<Role, string> = {
    owner: 'Control total del sistema y facturación',
    admin: 'Gestión completa excepto facturación',
    manager: 'Gestión de inventario y ventas',
    employee: 'Realizar ventas y ver productos',
    delivery: 'Gestión de entregas y repartos',
    viewer: 'Solo puede ver información',
};

// Helper para verificar si un rol puede asignar otro rol
export function canAssignRole(currentRole: Role, targetRole: Role): boolean {
    const roleHierarchy: Record<Role, number> = {
        owner: 5,
        admin: 4,
        manager: 3,
        employee: 2,
        delivery: 1,
        viewer: 0,
    };
    return roleHierarchy[currentRole] > roleHierarchy[targetRole];
}

// Helper para verificar si puede editar permisos
export function canEditPermissions(role: Role | string | undefined): boolean {
    return role === 'owner' || role === 'admin';
}
