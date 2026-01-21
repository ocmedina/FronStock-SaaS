// Sistema de roles y permisos dinámicos para FrontStock SaaS

export type Role = 'owner' | 'admin' | 'manager' | 'employee' | 'viewer';

export const MODULES = [
    'dashboard',
    'products',
    'categories',
    'customers',
    'sales',
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

// Permisos por defecto (se pueden personalizar por organización)
export const defaultRolePermissions: Record<Role, Record<string, PermissionActions>> = {
    owner: {
        dashboard: { view: true, create: true, edit: true, delete: true },
        products: { view: true, create: true, edit: true, delete: true },
        categories: { view: true, create: true, edit: true, delete: true },
        customers: { view: true, create: true, edit: true, delete: true },
        sales: { view: true, create: true, edit: true, delete: true },
        reports: { view: true, create: true, edit: true, delete: true },
        settings: { view: true, create: true, edit: true, delete: true },
        users: { view: true, create: true, edit: true, delete: true },
        permissions: { view: true, create: true, edit: true, delete: true },
    },
    admin: {
        dashboard: { view: true, create: true, edit: true, delete: true },
        products: { view: true, create: true, edit: true, delete: true },
        categories: { view: true, create: true, edit: true, delete: true },
        customers: { view: true, create: true, edit: true, delete: true },
        sales: { view: true, create: true, edit: true, delete: true },
        reports: { view: true, create: true, edit: true, delete: true },
        settings: { view: true, create: true, edit: true, delete: false },
        users: { view: true, create: true, edit: true, delete: false },
        permissions: { view: true, create: true, edit: true, delete: false },
    },
    manager: {
        dashboard: { view: true, create: false, edit: false, delete: false },
        products: { view: true, create: true, edit: true, delete: false },
        categories: { view: true, create: true, edit: true, delete: false },
        customers: { view: true, create: true, edit: true, delete: false },
        sales: { view: true, create: true, edit: true, delete: false },
        reports: { view: true, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        users: { view: true, create: false, edit: false, delete: false },
        permissions: { view: false, create: false, edit: false, delete: false },
    },
    employee: {
        dashboard: { view: true, create: false, edit: false, delete: false },
        products: { view: true, create: false, edit: false, delete: false },
        categories: { view: true, create: false, edit: false, delete: false },
        customers: { view: true, create: true, edit: false, delete: false },
        sales: { view: true, create: true, edit: false, delete: false },
        reports: { view: false, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        users: { view: false, create: false, edit: false, delete: false },
        permissions: { view: false, create: false, edit: false, delete: false },
    },
    viewer: {
        dashboard: { view: true, create: false, edit: false, delete: false },
        products: { view: true, create: false, edit: false, delete: false },
        categories: { view: true, create: false, edit: false, delete: false },
        customers: { view: true, create: false, edit: false, delete: false },
        sales: { view: true, create: false, edit: false, delete: false },
        reports: { view: true, create: false, edit: false, delete: false },
        settings: { view: false, create: false, edit: false, delete: false },
        users: { view: false, create: false, edit: false, delete: false },
        permissions: { view: false, create: false, edit: false, delete: false },
    },
};

// Etiquetas de roles en español
export const roleLabels: Record<Role, string> = {
    owner: 'Propietario',
    admin: 'Administrador',
    manager: 'Gerente',
    employee: 'Empleado',
    viewer: 'Solo lectura',
};

// Etiquetas de módulos en español
export const moduleLabels: Record<Module, string> = {
    dashboard: 'Dashboard',
    products: 'Productos',
    categories: 'Categorías',
    customers: 'Clientes',
    sales: 'Ventas',
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
    viewer: 'Solo puede ver información',
};

// Helper para verificar si un rol puede asignar otro rol
export function canAssignRole(currentRole: Role, targetRole: Role): boolean {
    const roleHierarchy: Record<Role, number> = {
        owner: 5,
        admin: 4,
        manager: 3,
        employee: 2,
        viewer: 1,
    };
    return roleHierarchy[currentRole] > roleHierarchy[targetRole];
}

// Helper para verificar si puede editar permisos
export function canEditPermissions(role: Role | string | undefined): boolean {
    return role === 'owner' || role === 'admin';
}
