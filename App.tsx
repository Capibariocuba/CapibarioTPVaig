
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
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
import { Key, Cpu, Globe, MessageCircle, AlertCircle, Menu, RefreshCcw, ShieldAlert } from 'lucide-react';
import { CAPIBARIO_LOGO, MASTER_KEYS } from './constants';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CAPIBARIO CRITICAL UI ERROR:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-lg border border-red-100">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-4">Error de Interfaz</h2>
            <p className="text-slate-500 text-sm font-bold leading-relaxed mb-8 uppercase tracking-widest">
              Lo sentimos, la vista actual ha experimentado un fallo inesperado. Sus datos están seguros.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-brand-600 transition-all uppercase text-[10px] tracking-widest shadow-xl"
            >
              <RefreshCcw size={18} /> Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ActivationScreen: React.FC = () => {
  const { applyLicenseKey, businessConfig, getFirstAllowedView, setView } = useStore();
  const [key, setKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLicense, setSuccessLicense] = useState<{tier: string, expiry: string} | null>(null);

  const handleActivate = async () => {
    setError(null);
    setIsLoading(true);
    const success = await applyLicenseKey(key);
    if (!success) {
      setError("Llave de activación incorrecta o no válida para este HWID.");
      setIsLoading(false);
    } else {
        let tier = 'GOLD';
        if (key === MASTER_KEYS.PLATINUM) tier = 'PLATINUM';
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24);
        setSuccessLicense({ tier, expiry: expiry.toLocaleString() });
        
        // Redirigir al primer módulo permitido después de un breve delay
        setTimeout(() => {
          setView(getFirstAllowedView());
        }, 2000);
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
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Licencia Activada (24H TEST)</p>
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
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">Capibario TPV</h1>
          <p className="text-brand-400 font-black uppercase tracking-[0.2em] text-[10px] mb-12">Software de Gestión Comercial</p>

          <div className="space-y-6 text-left mb-12">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-center gap-5">
                  <div className="p-4 bg-slate-900 rounded-2xl text-brand-400 shadow-xl"><Cpu size={24}/></div>
                  <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware ID (HWID)</p>
                      <p className="text-sm font-black text-white font-mono">{businessConfig.security.hwid}</p>
                  </div>
              </div>
              <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Llave de Activación</label>
                  <div className="relative">
                      <Key className="absolute left-5 top-5 text-brand-500" size={24} />
                      <input 
                        className={`w-full bg-slate-900 border-2 ${error ? 'border-red-500/50' : 'border-brand-500/20'} p-5 pl-14 rounded-2xl font-black text-white tracking-widest outline-none focus:border-brand-500 transition-all placeholder:text-slate-700`} 
                        placeholder="INGRESE SU LLAVE..."
                        value={key}
                        onChange={e => setKey(e.target.value)}
                      />
                  </div>
                  {error && (
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in fade-in">
                        <p className="text-xs font-bold text-red-200 leading-relaxed">{error}</p>
                    </div>
                  )}
              </div>
          </div>
          <button onClick={handleActivate} disabled={isLoading || !key} className="w-full bg-brand-500 hover:bg-brand-400 text-slate-950 font-black py-6 rounded-3xl shadow-xl transition-all uppercase tracking-widest text-xs">
            {isLoading ? "Validando..." : "Activar Sistema"}
          </button>
      </div>
    </div>
  );
};

const RoleGuard: React.FC<{ view: View, children: ReactNode }> = ({ view, children }) => {
  const { checkModuleAccess, users } = useStore();
  const isAllowed = checkModuleAccess(view);

  // Si no hay usuarios registrados, permitimos ver exclusivamente el módulo de personal (setup inicial)
  // Sin mostrar el cartel de acceso restringido para evitar confusión
  if (users.length === 0) {
    if (view === View.EMPLOYEES) return <>{children}</>;
    return null; // Silenciamos otros módulos mientras el MainLayout redirige
  }

  if (!isAllowed) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50/50 p-6 animate-in fade-in">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-lg border border-gray-100">
           <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
             <ShieldAlert size={40} />
           </div>
           <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-4">Acceso Restringido</h2>
           <p className="text-slate-500 text-[10px] font-bold leading-relaxed mb-8 uppercase tracking-widest">
             Su rol actual no posee los privilegios necesarios para acceder a este módulo.
           </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const RootRouter: React.FC = () => {
  const { isLicenseValid } = useStore();
  const [isCatalogMode, setIsCatalogMode] = useState(() => window.location.hash.includes('#/catalog'));

  useEffect(() => {
    const handleHashChange = () => setIsCatalogMode(window.location.hash.includes('#/catalog'));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isCatalogMode) return <WebCatalogView />;
  if (!isLicenseValid) return <ActivationScreen />;

  return <MainLayout />;
}

const MainLayout: React.FC = () => {
  const { view, setView, isLicenseValid, employees, checkModuleAccess, users } = useStore();
  const [sidebarPinned, setSidebarPinned] = useState(() => localStorage.getItem('_sidebar_pinned') === 'true');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('_sidebar_pinned', String(sidebarPinned));
  }, [sidebarPinned]);

  // Redirección inteligente al iniciar: Solo a Employees si no hay Admin y el usuario actual tiene permiso
  useEffect(() => {
    const hasAdmin = employees.some((e: any) => e.role === Role.ADMIN);
    // Bypass: Si no hay usuarios (users.length === 0), canManageEmployees será true con la nueva lógica de StoreContext
    const canManageEmployees = checkModuleAccess(View.EMPLOYEES);

    if (isLicenseValid && !hasAdmin && canManageEmployees && view !== View.EMPLOYEES) {
      setView(View.EMPLOYEES);
    }
  }, [isLicenseValid, employees, view, setView, checkModuleAccess, users.length]);

  const hasAdmin = employees.some((e: any) => e.role === Role.ADMIN);

  const renderContent = () => {
    switch (view) {
      case View.POS: return <RoleGuard view={View.POS}><POS /></RoleGuard>;
      case View.CLIENTS: return <RoleGuard view={View.CLIENTS}><Clients /></RoleGuard>;
      case View.EMPLOYEES: return <RoleGuard view={View.EMPLOYEES}><Employees /></RoleGuard>;
      case View.LEDGER: return <RoleGuard view={View.LEDGER}><Ledger /></RoleGuard>;
      case View.DASHBOARD: return <RoleGuard view={View.DASHBOARD}><AdminDashboard /></RoleGuard>;
      case View.INVENTORY: return <RoleGuard view={View.INVENTORY}><Inventory /></RoleGuard>;
      case View.CONFIGURATION: return <Configuration />;
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
        {!sidebarPinned && !sidebarOpen && (hasAdmin || users.length === 0) && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="fixed top-6 left-6 z-40 bg-white p-3 rounded-2xl shadow-xl border border-gray-100 text-slate-600 hover:text-brand-500 transition-all active:scale-95 lg:flex hidden"
          >
            <Menu size={20} />
          </button>
        )}
        <ErrorBoundary>{renderContent()}</ErrorBoundary>
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
