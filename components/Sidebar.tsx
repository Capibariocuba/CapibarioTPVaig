
import React from 'react';
import { LayoutDashboard, Package, Settings, LogOut, Store, Users, FileText, Lock, Pin, PinOff, UserCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { View, Role } from '../types';
import { CAPIBARIO_LOGO } from '../constants';

interface SidebarProps {
  isPinned: boolean;
  isOpen: boolean;
  onTogglePin: () => void;
  onSetOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isPinned, isOpen, onTogglePin, onSetOpen }) => {
  const { view, setView, currentUser, logout, checkModuleAccess } = useStore();

  const menuItems = [
    { id: View.POS, label: 'TPV (Venta)', icon: Store },
    { id: View.CLIENTS, label: 'Clientes y Marketing', icon: Users },
    { id: View.EMPLOYEES, label: 'Empleados', icon: UserCheck },
    { id: View.LEDGER, label: 'Auditoría', icon: FileText },
    { id: View.DASHBOARD, label: 'Estadísticas', icon: LayoutDashboard },
    { id: View.INVENTORY, label: 'Inventario', icon: Package },
    { id: View.CONFIGURATION, label: 'Configuración', icon: Settings },
  ];

  // FILTRADO POR ROL SEGÚN MATRIZ
  const filteredMenu = menuItems.filter(item => checkModuleAccess(item.id));

  const isExpanded = isPinned || isOpen;

  return (
    <div 
      onMouseEnter={() => !isPinned && onSetOpen(true)}
      onMouseLeave={() => !isPinned && onSetOpen(false)}
      className={`bg-slate-900 text-white flex flex-col h-screen transition-all duration-300 shadow-xl z-50 flex-shrink-0 relative ${
        isExpanded ? 'w-64' : 'w-20'
      } ${!isPinned && !isOpen ? 'lg:w-20' : ''} h-screen`}
    >
      {/* Header Sidebar */}
      <div className="p-4 flex items-center justify-between border-b border-slate-700 bg-slate-950 overflow-hidden min-h-[73px]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white p-1 flex-shrink-0">
            <img src={CAPIBARIO_LOGO} alt="Logo" className="w-full h-full object-contain" />
          </div>
          {isExpanded && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <h1 className="font-bold text-lg tracking-wide leading-none whitespace-nowrap">Capibario</h1>
              <span className="text-xs text-brand-400 font-medium whitespace-nowrap">Software TPV</span>
            </div>
          )}
        </div>
        
        {isExpanded && (
          <button 
            onClick={onTogglePin}
            className="p-2 text-slate-500 hover:text-white transition-colors lg:block hidden"
          >
            {isPinned ? <Pin size={16} className="text-brand-500" /> : <PinOff size={16} />}
          </button>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-6 space-y-2 overflow-y-auto px-3 overflow-x-hidden">
        {filteredMenu.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                if (!isPinned) onSetOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all relative group ${
                isActive ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className="relative flex-shrink-0">
                <Icon size={20} className={isActive ? 'text-white' : 'group-hover:text-brand-400'} />
              </div>
              {isExpanded && (
                <span className="font-bold text-[11px] uppercase tracking-widest whitespace-nowrap truncate animate-in fade-in duration-300">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Sidebar */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 overflow-hidden">
        <button 
          onClick={logout}
          className="flex items-center gap-4 text-red-400 hover:text-white hover:bg-red-600/20 transition-all w-full px-4 py-3 rounded-xl"
        >
          <LogOut size={20} className="flex-shrink-0" />
          {isExpanded && (
            <span className="font-bold text-[11px] uppercase tracking-widest whitespace-nowrap animate-in fade-in duration-300">
              Cerrar Sesión
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
