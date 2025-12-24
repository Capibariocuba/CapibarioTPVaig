import { useStore } from '../context/StoreContext';
import { PermissionEngine } from './PermissionEngine';
import { View, LicenseTier } from '../types';
import { ActionID, LimitKey, PlanCapabilities } from './Definitions';

/**
 * Hook Centralizado de Permisos CAPIBARIO-LPE.
 * Consumido por módulos para validar accesos, límites y features en tiempo real.
 * 
 * Este hook es reactivo a cambios en BusinessConfig y CurrentUser.
 */
export const usePermissions = () => {
  const { businessConfig, currentUser } = useStore();
  
  // Reactividad total: Estos valores se recalculan si cambia la licencia o el usuario en StoreContext.
  const tier = (businessConfig.license?.tier || 'GOLD') as LicenseTier;
  const role = currentUser?.role;
  const security = businessConfig.security;

  return {
    /**
     * Valida si el usuario puede acceder a un módulo específico.
     * Integra automáticamente el chequeo de integridad del sistema.
     */
    canAccessModule: (view: View) => 
      PermissionEngine.validateModuleAccess(view, tier, security),

    /**
     * Valida si el rol actual permite ejecutar una acción sensible.
     */
    canDo: (action: ActionID) => 
      role ? PermissionEngine.canPerformAction(action, role) : false,

    /**
     * Valida límites cuantitativos del plan actual.
     * Ejemplo: isWithinLimit('WAREHOUSES', warehouses.length)
     */
    isWithinLimit: (limit: LimitKey, count: number) => 
      PermissionEngine.enforcePlanLimits(limit, count, tier),

    /**
     * Consulta si una característica avanzada (Ej: 'multiCurrency') está habilitada.
     */
    hasFeature: (key: keyof PlanCapabilities['features']) =>
      PermissionEngine.hasFeature(key, tier),

    /**
     * Días de auditoría permitidos por el plan (-1 = ilimitado).
     */
    auditDays: PermissionEngine.getAuditVisibilityDays(tier),
    
    /**
     * Propiedades de estado para lógica condicional en UI
     */
    tier,
    role,
    isIntegrityValid: PermissionEngine.isSystemIntegrityValid(security),
    
    /**
     * Ejecuta una auditoría interna de los límites para reportar inconsistencias.
     */
    runComplianceAudit: () => PermissionEngine.runInternalComplianceTest()
  };
};
