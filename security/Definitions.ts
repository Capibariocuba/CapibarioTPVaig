
import { View, Role, LicenseTier } from '../types';

export type LimitKey = 'WAREHOUSES' | 'OPERATORS' | 'AUDIT_DAYS' | 'CLIENTS' | 'CURRENCIES' | 'POS_TERMINALS';

export type ActionID = 
  | 'ADD_PRODUCT' | 'EDIT_PRODUCT' | 'DELETE_PRODUCT' 
  | 'OPEN_SHIFT' | 'CLOSE_SHIFT' 
  | 'MANAGE_USERS' | 'MANAGE_CONFIG' 
  | 'APPLY_DISCOUNT' | 'DELETE_SALE'
  | 'MANAGE_CLIENTS' | 'LOAD_CREDIT'
  | 'MANAGE_CURRENCIES' | 'MANAGE_POS';

export interface PlanCapabilities {
  allowedViews: View[];
  limits: Record<LimitKey, number>;
  features: {
    multiCurrency: boolean;
    advancedMarketing: boolean;
    customBranding: boolean;
    webCatalog: boolean;
  };
}

export const PLAN_CAPABILITIES: Record<LicenseTier, PlanCapabilities> = {
  GOLD: {
    // GOLD permite ver los módulos base, incluyendo empleados para gestión inicial
    allowedViews: [View.POS, View.CLIENTS, View.EMPLOYEES], 
    limits: {
      WAREHOUSES: 1,
      OPERATORS: 5,
      AUDIT_DAYS: 7,
      CLIENTS: -1,
      CURRENCIES: 1, // Solo CUP
      POS_TERMINALS: 1
    },
    features: {
      multiCurrency: false,
      advancedMarketing: false,
      customBranding: false,
      webCatalog: false
    }
  },
  PLATINUM: {
    allowedViews: Object.values(View),
    limits: {
      WAREHOUSES: -1,
      OPERATORS: -1,
      AUDIT_DAYS: -1,
      CLIENTS: -1,
      CURRENCIES: -1,
      POS_TERMINALS: -1
    },
    features: {
      multiCurrency: true,
      advancedMarketing: true,
      customBranding: true,
      webCatalog: true
    }
  }
};

// MATRIZ DE ACCESO POR ROL (REQUISITO OBLIGATORIO)
export const ROLE_VIEWS: Record<Role, View[]> = {
  [Role.DEPENDENT]: [View.POS, View.CLIENTS],
  [Role.ACCOUNTANT]: [View.POS, View.CLIENTS, View.EMPLOYEES, View.LEDGER, View.DASHBOARD, View.INVENTORY],
  [Role.ADMIN]: Object.values(View)
};

export const ROLE_PERMISSIONS: Record<Role, ActionID[]> = {
  [Role.ADMIN]: [
    'ADD_PRODUCT', 'EDIT_PRODUCT', 'DELETE_PRODUCT', 
    'OPEN_SHIFT', 'CLOSE_SHIFT', 
    'MANAGE_USERS', 'MANAGE_CONFIG', 
    'APPLY_DISCOUNT', 'DELETE_SALE',
    'MANAGE_CLIENTS', 'LOAD_CREDIT',
    'MANAGE_CURRENCIES', 'MANAGE_POS'
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
