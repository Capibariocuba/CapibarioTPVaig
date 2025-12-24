import { View, Role, LicenseTier } from '../types';

/**
 * Claves para límites cuantitativos del sistema.
 */
export type LimitKey = 'WAREHOUSES' | 'OPERATORS' | 'AUDIT_DAYS' | 'CLIENTS' | 'CURRENCIES';

/**
 * Identificadores únicos para acciones atómicas de usuario.
 */
export type ActionID = 
  | 'ADD_PRODUCT' | 'EDIT_PRODUCT' | 'DELETE_PRODUCT' 
  | 'OPEN_SHIFT' | 'CLOSE_SHIFT' 
  | 'MANAGE_USERS' | 'MANAGE_CONFIG' 
  | 'APPLY_DISCOUNT' | 'DELETE_SALE'
  | 'MANAGE_CLIENTS' | 'LOAD_CREDIT'
  | 'MANAGE_CURRENCIES';

/**
 * Contrato de capacidades por plan de licencia.
 */
export interface PlanCapabilities {
  allowedViews: View[];
  limits: Record<LimitKey, number>; // -1 = Ilimitado, 0 = Bloqueado
  features: {
    multiCurrency: boolean;
    advancedMarketing: boolean;
    customBranding: boolean;
  };
}

/**
 * CONFIGURACIÓN DE CAPIBARIO-LPE (Licensing & Permissions Engine)
 * 
 * GOLD: Plan base (1 Almacén, 0 Clientes, 5 días de Auditoría)
 * SAPPHIRE: Crecimiento (3 Almacenes, 500 Clientes, 30 días de Auditoría)
 * PLATINUM: Control Maestro (Ilimitado en todo)
 */
export const PLAN_CAPABILITIES: Record<LicenseTier, PlanCapabilities> = {
  GOLD: {
    allowedViews: [View.POS, View.INVENTORY, View.DASHBOARD, View.LEDGER, View.CONFIGURATION],
    limits: {
      WAREHOUSES: 1,    // Estricto: Solo se permite 1 almacén.
      OPERATORS: 5,     // Hasta 5 operadores.
      AUDIT_DAYS: 5,    // Historial visible de solo 5 días.
      CLIENTS: 0,       // Bloqueado: No puede gestionar base de clientes.
      CURRENCIES: 1     // Moneda única base.
    },
    features: {
      multiCurrency: false,
      advancedMarketing: false,
      customBranding: false
    }
  },
  SAPPHIRE: {
    allowedViews: [View.POS, View.INVENTORY, View.DASHBOARD, View.LEDGER, View.CONFIGURATION, View.CLIENTS],
    limits: {
      WAREHOUSES: 3,
      OPERATORS: 15,
      AUDIT_DAYS: 30,
      CLIENTS: 500,
      CURRENCIES: 3
    },
    features: {
      multiCurrency: true,
      advancedMarketing: true,
      customBranding: false
    }
  },
  PLATINUM: {
    allowedViews: [View.POS, View.INVENTORY, View.DASHBOARD, View.LEDGER, View.CONFIGURATION, View.CLIENTS],
    limits: {
      WAREHOUSES: -1,   // Ilimitado
      OPERATORS: -1,    // Ilimitado
      AUDIT_DAYS: -1,   // Ilimitado
      CLIENTS: -1,      // Ilimitado
      CURRENCIES: -1    // Ilimitado
    },
    features: {
      multiCurrency: true,
      advancedMarketing: true,
      customBranding: true
    }
  }
};

/**
 * PERMISOS ATÓMICOS POR ROL
 */
export const ROLE_PERMISSIONS: Record<Role, ActionID[]> = {
  [Role.ADMIN]: [
    'ADD_PRODUCT', 'EDIT_PRODUCT', 'DELETE_PRODUCT', 
    'OPEN_SHIFT', 'CLOSE_SHIFT', 
    'MANAGE_USERS', 'MANAGE_CONFIG', 
    'APPLY_DISCOUNT', 'DELETE_SALE',
    'MANAGE_CLIENTS', 'LOAD_CREDIT',
    'MANAGE_CURRENCIES'
  ],
  [Role.ACCOUNTANT]: [
    'ADD_PRODUCT', 'EDIT_PRODUCT',
    'OPEN_SHIFT', 'CLOSE_SHIFT',
    'APPLY_DISCOUNT',
    'MANAGE_CLIENTS', 'LOAD_CREDIT'
  ],
  [Role.DEPENDENT]: [
    'OPEN_SHIFT', 'CLOSE_SHIFT',
    'APPLY_DISCOUNT',
    'MANAGE_CLIENTS'
  ]
};
