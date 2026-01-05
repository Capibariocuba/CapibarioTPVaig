
import React from 'react';
import { usePermissions } from './usePermissions';
import { View } from '../types';
import { ActionID } from './Definitions';
import { Crown, AlertOctagon, Lock } from 'lucide-react';

interface GuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * LicenseGuard: Bloquea módulos enteros si el Plan no los incluye o si el sistema ha sido alterado.
 */
export const LicenseGuard: React.FC<GuardProps & { view: View }> = ({ view, children, fallback }) => {
  const { canAccessModule, isIntegrityValid, tier } = usePermissions();
  
  // 1. Bloqueo por Manipulación (Reloj/HWID) - z-index reducido para no tapar sidebar
  if (!isIntegrityValid && view !== View.CONFIGURATION) {
    return (
      <div className="absolute inset-0 z-[40] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl rounded-[inherit]">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center max-w-sm border-4 border-red-500 animate-in zoom-in duration-300">
          <AlertOctagon className="mx-auto mb-4 text-red-500" size={64} />
          <h3 className="font-black text-xl uppercase tracking-tighter text-slate-900 mb-2">Seguridad Comprometida</h3>
          <p className="text-[10px] text-slate-400 font-bold mb-6 leading-relaxed uppercase">
            Detectada discrepancia en el tiempo del sistema. Acceso revocado para proteger la integridad de los datos.
          </p>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Re-sincronizar</button>
        </div>
      </div>
    );
  }

  // 2. Bloqueo por Nivel de Licencia
  if (!canAccessModule(view)) {
    const requiredPlan = 'PLATINUM'; // En este modelo, casi todo está en GOLD salvo features avanzadas
    return fallback || (
      <div className="absolute inset-0 z-[10] flex items-center justify-center bg-white/40 backdrop-blur-sm rounded-[inherit]">
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl text-center max-w-xs border border-white/10 animate-in fade-in duration-500">
          <Crown className="mx-auto mb-4 text-brand-400" size={48} />
          <h3 className="font-black text-lg uppercase tracking-widest mb-2">Plan {tier}</h3>
          <p className="text-[10px] text-slate-400 font-bold mb-6 uppercase leading-tight">
            Este módulo o característica avanzada requiere actualización a nivel <span className="text-white">{requiredPlan}</span>.
          </p>
          <a href="https://wa.me/5350019541" target="_blank" className="inline-block bg-brand-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-500 transition-colors shadow-lg">Solicitar Upgrade</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * ActionGuard: Oculta componentes de UI (botones, menús) si el ROL no tiene permiso.
 */
export const ActionGuard: React.FC<GuardProps & { action: ActionID }> = ({ action, children, fallback }) => {
  const { canDo } = usePermissions();

  if (!canDo(action)) {
    return fallback || null;
  }

  return <>{children}</>;
};
