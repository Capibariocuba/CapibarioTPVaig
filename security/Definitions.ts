
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
  };
}

export const PLAN_CAPABILITIES: Record<LicenseTier, PlanCapabilities> = {
  GOLD: {
    allowedViews: [View.POS, View.INVENTORY, View.DASHBOARD, View.LEDGER, View.CONFIGURATION],
    limits: {
      WAREHOUSES: 1,
      OPERATORS: 3,
      AUDIT_DAYS: 5,
      CLIENTS: 0,
      CURRENCIES: 1,
      POS_TERMINALS: 1
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
      CURRENCIES: 3,
      POS_TERMINALS: 3
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
      customBranding: true
    }
  }
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
