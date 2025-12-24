
import { View, Role, LicenseTier, SecurityConfig } from '../types';
import { PLAN_CAPABILITIES, ROLE_PERMISSIONS, LimitKey, ActionID, PlanCapabilities } from './Definitions';

export class PermissionEngine {
  static validateModuleAccess(view: View, tier: LicenseTier, security: SecurityConfig): boolean {
    if (!this.isSystemIntegrityValid(security) && view !== View.CONFIGURATION) return false;
    return PLAN_CAPABILITIES[tier].allowedViews.includes(view);
  }

  static enforcePlanLimits(limitType: LimitKey, currentCount: number, tier: LicenseTier): boolean {
    const limit = PLAN_CAPABILITIES[tier].limits[limitType];
    if (limit === -1) return true;
    if (limit === 0) return false;
    return currentCount < limit;
  }

  /**
   * Política SOFT-LOCK (Fase 2):
   * Valida si un elemento existente en una posición específica del array 
   * está bloqueado por el plan actual tras un downgrade.
   */
  static isItemSoftLocked(limitType: LimitKey, index: number, tier: LicenseTier): boolean {
    const limit = PLAN_CAPABILITIES[tier].limits[limitType];
    
    // Si el plan permite ilimitado, nada está bloqueado
    if (limit === -1) return false;
    
    // Si el índice del elemento es mayor o igual al límite permitido, está bloqueado.
    // Ej: GOLD (Límite 1), Almacén en index 0 -> OK, Almacén en index 1 -> LOCKED.
    return index >= limit;
  }

  static canPerformAction(action: ActionID, role: Role): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    return permissions ? permissions.includes(action) : false;
  }

  static hasFeature(key: keyof PlanCapabilities['features'], tier: LicenseTier): boolean {
    return PLAN_CAPABILITIES[tier].features[key];
  }

  static getAuditVisibilityDays(tier: LicenseTier): number {
    return PLAN_CAPABILITIES[tier].limits.AUDIT_DAYS;
  }

  static isSystemIntegrityValid(security: SecurityConfig): boolean {
    const now = new Date();
    const lastSaved = new Date(security.lastSystemTime);
    if (now < lastSaved) return false;
    const currentHwid = localStorage.getItem('_app_hwid');
    if (security.hwid !== currentHwid) return false;
    return true;
  }

  static runInternalComplianceTest(): Record<string, boolean> {
    const testResults: Record<string, boolean> = {};
    console.group("CAPIBARIO-LPE: Compliance Audit");
    testResults['GOLD_STRICT_WAREHOUSE_FAIL'] = !this.enforcePlanLimits('WAREHOUSES', 1, 'GOLD');
    testResults['SOFT_LOCK_CHECK_INDEX_1_ON_GOLD'] = this.isItemSoftLocked('WAREHOUSES', 1, 'GOLD');
    console.groupEnd();
    return testResults;
  }
}
