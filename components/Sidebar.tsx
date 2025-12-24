
import React from 'react';
import { LayoutDashboard, Package, Settings, LogOut, Store, Users, FileText, Lock } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { View, Role } from '../types';
import { CAPIBARIO_LOGO } from '../constants';

export const Sidebar: React.FC = () => {
  const { view, setView, currentUser, logout, checkModuleAccess } = useStore();

  const menuItems = [
    { id: View.POS, label: 'TPV (Venta)', icon: Store, roles: [Role.ADMIN, Role.ACCOUNTANT, Role.DEPENDENT] },
    { id: View.CLIENTS, label: 'Clientes', icon: Users, roles: [Role.ADMIN, Role.ACCOUNTANT, Role.DEPENDENT] },
    { id: View.LEDGER, label: 'Auditoría', icon: FileText, roles: [Role.ADMIN, Role.ACCOUNTANT] },
    { id: View.DASHBOARD, label: 'Estadísticas', icon: LayoutDashboard, roles: [Role.ADMIN, Role.ACCOUNTANT] },
    { id: View.INVENTORY, label: 'Inventario', icon: Package, roles: [Role.ADMIN, Role.ACCOUNTANT] },
    { id: View.CONFIGURATION, label: 'Configuración', icon: Settings, roles: [Role.ADMIN] },
  ];

  // Si no hay usuario, permitimos ver los módulos de venta por defecto o nada
  const filteredMenu = menuItems.filter(item => 
    !currentUser || item.roles.includes(currentUser.role)
  );

  return (
    <div className="w-20 lg:w-64 bg-slate-900 text-white flex flex-col h-screen transition-all duration-300 shadow-xl z-30 flex-shrink-0">
      <div className="p-4 flex items-center justify-center lg:justify-start gap-3 border-b border-slate-700 bg-slate-950">
        <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white p-1">
          <img src={CAPIBARIO_LOGO} alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="hidden lg:block">
          <h1 className="font-bold text-lg tracking-wide leading-none">Capibario</h1>
          <span className="text-xs text-brand-400 font-medium">Software TPV</span>
        </div>
      </div>

      <nav className="flex-1 py-6 space-y-2 overflow-y-auto px-3">
        {filteredMenu.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;
          const isRestricted = !checkModuleAccess(item.id);

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all relative group ${
                isActive ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              } ${isRestricted ? 'opacity-50 grayscale' : ''}`}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? 'text-white' : 'group-hover:text-brand-400'} />
                {isRestricted && <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5"><Lock size={8} /></div>}
              </div>
              <span className={`hidden lg:block font-bold text-[11px] uppercase tracking-widest ${isActive ? 'text-white' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <button 
          onClick={logout}
          className="flex items-center gap-4 text-red-400 hover:text-white hover:bg-red-600/20 transition-all w-full px-4 py-3 rounded-xl"
        >
          <LogOut size={20} />
          <span className="hidden lg:block font-bold text-[11px] uppercase tracking-widest">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};
