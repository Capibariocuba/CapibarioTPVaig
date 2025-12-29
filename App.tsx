
import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Sidebar } from './components/Sidebar';
import { POS } from './pages/POS';
import { AdminDashboard } from './pages/AdminDashboard';
import { Inventory } from './pages/Inventory';
import { Clients } from './pages/Clients';
import { Configuration } from './pages/Configuration';
import { Ledger } from './pages/Ledger';
import { Employees } from './pages/Employees';
import { WebCatalogView } from './pages/WebCatalogView';
import { View, Role } from './types';
import { Key, Cpu, Globe, MessageCircle, AlertCircle, Menu } from 'lucide-react';
import { CAPIBARIO_LOGO } from './constants';

const ActivationScreen: React.FC = () => {
  const { applyLicenseKey, businessConfig } = useStore();
  const [key, setKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLicense, setSuccessLicense] = useState<{tier: string, expiry: string} | null>(null);

  const handleActivate = async () => {
    setError(null);
    setIsLoading(true);
    const success = await applyLicenseKey(key);
    if (!success) {
      setError("La llave de activación es incorrecta, ha expirado o no coincide con el HWID de este equipo.");
      setIsLoading(false);
    } else {
        let tier = 'TRIAL';
        if (key.includes('GOLD')) tier = 'GOLD';
        else if (key.includes('SAPPHIRE')) tier = 'SAPPHIRE';
        else if (key.includes('PLATINUM')) tier = 'PLATINUM';
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24);
        setSuccessLicense({ tier, expiry: expiry.toLocaleString() });
    }
  };

  if (successLicense) {
      return (
          <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6 overflow-hidden relative">
              <div className="bg-white/5 backdrop-blur-2xl p-12 rounded-[4rem] border border-emerald-500/30 shadow-2xl max-w-2xl w-full text-center animate-in zoom-in duration-500">
                  <div className="mb-8 inline-flex p-4 bg-white rounded-[2.5rem] border border-emerald-500/30 shadow-xl overflow-hidden">
                      <img src={CAPIBARIO_LOGO} alt="Logo" className="w-24 h-24 object-contain" />
                  </div>
                  <h1 className="text-4xl font-black text-white mb-4 tracking-tighter">¡Activación Exitosa!</h1>
                  <div className="space-y-4 mb-8">
                      <p className="text-slate-300 text-lg">Bienvenido al ecosistema Capibario.</p>
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/5 inline-block mx-auto">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Licencia Activada</p>
                          <p className="text-2xl font-black text-emerald-400 uppercase tracking-widest">{successLicense.tier} EDITION</p>
                      </div>
                  </div>
                  <p className="text-slate-400 animate-pulse text-xs font-bold uppercase tracking-widest">Iniciando sistema...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6 overflow-hidden relative">
      <div className="bg-white/5 backdrop-blur-2xl p-12 rounded-[4rem] border border-white/10 shadow-2xl max-w-2xl w-full text-center relative z-10 animate-in zoom-in duration-500">
          <div className="mb-10 inline-flex p-4 bg-white rounded-[2.5rem] border border-brand-500/30 shadow-2xl overflow-hidden scale-110">
              <img src={CAPIBARIO_LOGO} alt="Capibario Logo" className="w-32 h-32 object-contain" />
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">Bienvenido a Capibario TPV</h1>
          <p className="text-brand-400 font-black uppercase tracking-[0.2em] text-[10px] mb-12">Desarrollado por CAPIBARIO (+53 50019541)</p>

          <div className="space-y-6 text-left mb-12">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-center gap-5">
                  <div className="p-4 bg-slate-900 rounded-2xl text-brand-400 shadow-xl"><Cpu size={24}/></div>
                  <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware ID (HWID)</p>
                      <p className="text-sm font-black text-white font-mono">{businessConfig.security.hwid}</p>
                  </div>
              </div>
              <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Llave de Licencia Maestro</label>
                  <div className="relative">
                      <Key className="absolute left-5 top-5 text-brand-500" size={24} />
                      <input 
                        className={`w-full bg-slate-900 border-2 ${error ? 'border-red-500/50' : 'border-brand-500/20'} p-5 pl-14 rounded-2xl font-black text-white tracking-widest outline-none focus:border-brand-500 transition-all placeholder:text-slate-700`} 
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        value={key}
                        onChange={e => setKey(e.target.value.toUpperCase())}
                      />
                  </div>
                  {error && (
                    <div className="mt-6 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in fade-in">
                        <p className="text-xs font-bold text-red-200 leading-relaxed mb-4">{error}</p>
                        <a href="https://wa.me/5350019541" target="_blank" className="inline-flex items-center gap-2 bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
                          <MessageCircle size={14} /> Contactar Soporte
                        </a>
                    </div>
                  )}
              </div>
          </div>
          <button onClick={handleActivate} disabled={isLoading || !key} className="w-full bg-brand-500 hover:bg-brand-400 text-slate-950 font-black py-6 rounded-3xl shadow-xl transition-all uppercase tracking-widest text-xs">
            {isLoading ? "Validando Firma..." : "Activar Sistema"} <Globe size={18} />
          </button>
      </div>
    </div>
  );
};

const RootRouter: React.FC = () => {
  const { view, setView, isLicenseValid, employees } = useStore();
  
  // DETECCIÓN DE MODO CATÁLOGO (Ruta Pública)
  // Si la URL contiene /catalog, forzamos renderizado del catálogo sin Sidebar ni Guards del TPV.
  const [isCatalogMode, setIsCatalogMode] = useState(() => window.location.hash.includes('#/catalog'));

  useEffect(() => {
    const handleHashChange = () => setIsCatalogMode(window.location.hash.includes('#/catalog'));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isCatalogMode) {
    return <WebCatalogView />;
  }

  if (!isLicenseValid) return <ActivationScreen />;

  return <MainLayout />;
}

const MainLayout: React.FC = () => {
  const { view, setView, isLicenseValid, employees } = useStore();
  
  const [sidebarPinned, setSidebarPinned] = useState(() => localStorage.getItem('_sidebar_pinned') === 'true');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('_sidebar_pinned', String(sidebarPinned));
  }, [sidebarPinned]);

  // Setup Gate: Si no hay administrador en empleados, forzar vista empleados (Solo en modo TPV)
  useEffect(() => {
    const hasAdmin = employees.some((e: any) => e.role === Role.ADMIN);
    if (isLicenseValid && !hasAdmin && view !== View.EMPLOYEES) {
      setView(View.EMPLOYEES);
    }
  }, [isLicenseValid, employees, view, setView]);

  const hasAdmin = employees.some((e: any) => e.role === Role.ADMIN);

  const renderContent = () => {
    switch (view) {
      case View.POS: return <POS />;
      case View.DASHBOARD: return <AdminDashboard />;
      case View.INVENTORY: return <Inventory />;
      case View.CLIENTS: return <Clients />;
      case View.CONFIGURATION: return <Configuration />;
      case View.LEDGER: return <Ledger />;
      case View.EMPLOYEES: return <Employees />;
      default: return <POS />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <Sidebar 
        isPinned={sidebarPinned} 
        isOpen={sidebarOpen} 
        onTogglePin={() => setSidebarPinned(!sidebarPinned)}
        onSetOpen={setSidebarOpen}
      />
      
      <main className="flex-1 h-full overflow-hidden relative">
        {!sidebarPinned && !sidebarOpen && hasAdmin && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="fixed top-6 left-6 z-40 bg-white p-3 rounded-2xl shadow-xl border border-gray-100 text-slate-600 hover:text-brand-500 transition-all active:scale-95 lg:flex hidden"
          >
            <Menu size={20} />
          </button>
        )}
        
        {renderContent()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <RootRouter />
    </StoreProvider>
  );
};

export default App;
