
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Role, User, BusinessConfig, CurrencyConfig, PaymentMethodType, LicenseTier, Currency, POSStoreTerminal, View } from '../types';
/* Added missing Info icon to lucide-react imports */
import { 
  Lock, Building2, User as UserIcon, DollarSign, ShieldCheck, 
  Save, Plus, Trash2, Key, Crown, Printer, Barcode, CreditCard, 
  Phone, Mail, MapPin, Hash, Receipt, AlertCircle, Banknote, Globe, Wallet, Camera, Monitor, LogIn, LogOut, CheckSquare, Square, X,
  ArrowRight, Sparkles, Cloud, Zap, ExternalLink, Copy, Info
} from 'lucide-react';

export const Configuration: React.FC = () => {
  const { 
    users, addUser, deleteUser, updateUserPin,
    businessConfig, updateBusinessConfig, 
    currencies, updateCurrency, addCurrency, deleteCurrency, isItemLocked, applyLicenseKey,
    login, currentUser, logout, notify, warehouses, setView
  } = useStore();

  const [isAuthenticated, setIsAuthenticated] = useState(users.length === 0);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState<'BUSINESS' | 'FINANCE' | 'LICENSE' | 'USERS'>('BUSINESS');

  // Lógica de Rescate
  const [isRescueMode, setIsRescueMode] = useState(() => localStorage.getItem('cfg_rescue_mode') === 'true');
  const [failCount, setFailCount] = useState(() => parseInt(localStorage.getItem('cfg_auth_fail_count') || '0'));

  const [tempBiz, setTempBiz] = useState<BusinessConfig>(businessConfig);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ role: Role.DEPENDENT });
  const [editingPinUser, setEditingPinUser] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [licenseKey, setLicenseKey] = useState('');

  // Estados Google Stub
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');

  // Estados Añadir Divisa Modal
  const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);
  const [newCurrency, setNewCurrency] = useState<Partial<CurrencyConfig>>({
    code: '',
    symbol: '$',
    rate: 1,
    allowedPaymentMethods: ['CASH']
  });

  const logoInputRef = useRef<HTMLInputElement>(null);

  const tier = (businessConfig.license?.tier || 'GOLD') as LicenseTier;

  // Efecto para modo rescate: forzar pestaña y modal
  useEffect(() => {
    if (isRescueMode) {
      setActiveTab('USERS');
      const firstAdmin = users.find(u => u.role === Role.ADMIN);
      if (firstAdmin && !editingPinUser) {
        setEditingPinUser(firstAdmin.id);
      }
    }
  }, [isRescueMode, users]);

  const handleAdminLogin = async () => {
    const success = await login(pinInput);
    if (success && currentUser?.role === Role.ADMIN) {
      setIsAuthenticated(true);
      setPinInput('');
      setFailCount(0);
      localStorage.setItem('cfg_auth_fail_count', '0');
    } else {
      // Incrementar contador de fallos
      const newFails = failCount + 1;
      setFailCount(newFails);
      localStorage.setItem('cfg_auth_fail_count', newFails.toString());

      // Validar PIN Maestro si hay >= 10 fallos
      if (newFails >= 10 && pinInput === '9711062300000032601179') {
        setIsRescueMode(true);
        localStorage.setItem('cfg_rescue_mode', 'true');
        setIsAuthenticated(true);
        setPinInput('');
      } else if (success) {
        // Logeado pero no es Admin
        alert("Acceso denegado: Se requiere rol Administrador.");
        logout();
      }
    }
    setPinInput('');
  };

  // --- LÓGICA EMPRESA ---
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 524288) { // 512KB
        notify("Imagen muy grande (máx 512KB)", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempBiz({ ...tempBiz, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveBusinessInfo = () => {
    if (isRescueMode) return;
    // Validaciones
    if (!tempBiz.logo) { notify("El Logo es obligatorio", "error"); return; }
    if (!tempBiz.name.trim()) { notify("Nombre del negocio obligatorio", "error"); return; }
    if (!tempBiz.phone.trim()) { notify("Teléfono obligatorio", "error"); return; }
    if (!tempBiz.email.trim() || !validateEmail(tempBiz.email)) { notify("Email inválido o vacío", "error"); return; }
    if (!tempBiz.address.trim()) { notify("Dirección obligatoria", "error"); return; }
    if (!tempBiz.footerMessage.trim()) { notify("Pie de firma obligatorio", "error"); return; }

    updateBusinessConfig(tempBiz);
    notify("Datos de empresa guardados", "success");
  };

  const handleConnectGoogle = () => {
    if (isRescueMode) return;
    if (!validateEmail(googleEmailInput)) {
      notify("Email de Google inválido", "error");
      return;
    }
    const updatedBiz = {
      ...tempBiz,
      googleAccount: { email: googleEmailInput, connected: true }
    };
    setTempBiz(updatedBiz);
    updateBusinessConfig(updatedBiz);
    setShowGoogleModal(false);
    setGoogleEmailInput('');
    notify("Cuenta Google vinculada (Stub)", "success");
  };

  const handleDisconnectGoogle = () => {
    if (isRescueMode) return;
    const updatedBiz = {
      ...tempBiz,
      googleAccount: { email: '', connected: false }
    };
    setTempBiz(updatedBiz);
    updateBusinessConfig(updatedBiz);
    notify("Cuenta Google desconectada", "success");
  };

  // --- POS TERMINALS ---
  const addPOSTerminal = () => {
    if (isRescueMode) return;
    const terminals = tempBiz.posTerminals || [];
    
    // Validar límites según Definitions
    if (isItemLocked('POS_TERMINALS', terminals.length)) {
      notify(`El Plan ${tier} permite un máximo de ${terminals.length} terminal(es). Actualice su licencia.`, "error");
      return;
    }

    const nextNumber = terminals.length + 1;
    const newTerminal: POSStoreTerminal = { 
      id: Math.random().toString(36).substr(2, 5).toUpperCase(), 
      name: `Punto de venta ${nextNumber}`, 
      warehouseId: warehouses[0]?.id || 'wh-default' 
    };

    const updatedBiz = {
      ...tempBiz,
      posTerminals: [...terminals, newTerminal]
    };

    setTempBiz(updatedBiz);
    updateBusinessConfig(updatedBiz); // Persistencia inmediata
    notify(`${newTerminal.name} creado correctamente`, "success");
  };

  const updatePOSTerminal = (id: string, updates: Partial<POSStoreTerminal>) => {
    if (isRescueMode) return;
    const terminals = tempBiz.posTerminals || [];
    const updatedBiz = {
      ...tempBiz,
      posTerminals: terminals.map(t => t.id === id ? { ...t, ...updates } : t)
    };
    setTempBiz(updatedBiz);
    updateBusinessConfig(updatedBiz);
  };

  const removePOSTerminal = (id: string) => {
    if (isRescueMode) return;
    const terminals = tempBiz.posTerminals || [];
    if (terminals.length <= 1) {
      notify("Debe existir al menos un punto de venta activo", "error");
      return;
    }
    const updatedBiz = {
      ...tempBiz,
      posTerminals: terminals.filter(t => t.id !== id)
    };
    setTempBiz(updatedBiz);
    updateBusinessConfig(updatedBiz);
    notify("Punto de venta eliminado", "success");
  };

  // --- FINANZAS DIVISA ---
  const handleAddCurrency = () => {
    if (isRescueMode) return;
    const { code, rate } = newCurrency;
    if (!code || code.length < 3 || code.length > 5) {
      notify("Código de divisa debe tener entre 3 y 5 caracteres", "error");
      return;
    }
    if (currencies.some(c => c.code === code.toUpperCase())) {
      notify("Esa divisa ya existe", "error");
      return;
    }
    if (!rate || rate <= 0) {
      notify("La tasa debe ser mayor que 0", "error");
      return;
    }

    addCurrency({
      code: code.toUpperCase(),
      symbol: newCurrency.symbol || '$',
      rate: rate,
      allowedPaymentMethods: newCurrency.allowedPaymentMethods || ['CASH']
    });
    setShowAddCurrencyModal(false);
    setNewCurrency({ code: '', symbol: '$', rate: 1, allowedPaymentMethods: ['CASH'] });
    notify("Divisa añadida correctamente", "success");
  };

  if (!isAuthenticated && !isRescueMode && users.length > 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl max-sm w-full text-center animate-in zoom-in duration-300">
          <div className="bg-brand-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 text-brand-600">
            <ShieldCheck size={48} />
          </div>
          <h2 className="text-3xl font-black mb-4 text-slate-900 uppercase">Seguridad Admin</h2>
          <input 
            type="password" 
            autoFocus 
            value={pinInput} 
            onChange={e => setPinInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} 
            className="w-full text-center text-5xl border-none bg-gray-100 rounded-2xl py-6 mb-8 font-black text-slate-800 outline-none" 
            maxLength={failCount >= 10 ? 25 : 4} 
            placeholder="••••" 
          />
          <button onClick={handleAdminLogin} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all">Desbloquear</button>
        </div>
      </div>
    );
  }

  const catalogUrl = `${window.location.origin}/#/catalog`;

  return (
    <div className="p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Configuración</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gestión del ecosistema Capibario</p>
        </div>
        {users.length > 0 && !isRescueMode && (
          <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl hover:bg-red-600 transition-colors">
            <Lock size={20} />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-10 bg-white p-2 rounded-3xl shadow-sm border border-gray-100 overflow-x-auto scrollbar-hide">
        {[
          { id: 'BUSINESS', label: 'Empresa', icon: Building2 },
          { id: 'FINANCE', label: 'Finanzas', icon: DollarSign },
          { id: 'LICENSE', label: 'Licencia', icon: ShieldCheck }
        ].map(tab => (
          <button 
            key={tab.id} 
            disabled={isRescueMode}
            onClick={() => !isRescueMode && setActiveTab(tab.id as any)} 
            className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-gray-50'} ${isRescueMode ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
        {isRescueMode && (
          <button 
            className="flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-red-600 text-white shadow-lg"
          >
            <UserIcon size={16} /> MODO RESCATE
          </button>
        )}
      </div>

      {activeTab === 'BUSINESS' && !isRescueMode && (
        <div className="space-y-8 animate-in slide-in-from-bottom-6">
          {/* A. INFORMACIÓN GENERAL */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3 mb-8">
              <Building2 className="text-brand-500" /> Información General
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="flex flex-col items-center">
                <div 
                  onClick={() => logoInputRef.current?.click()}
                  className={`w-48 h-48 rounded-[2.5rem] border-4 border-dashed border-gray-200 flex items-center justify-center overflow-hidden transition-all group relative ${tempBiz.logo ? 'border-brand-500 bg-white shadow-inner' : 'bg-gray-50'}`}
                >
                  {tempBiz.logo ? (
                    <>
                      <img src={tempBiz.logo} className="w-full h-full object-contain p-4" alt="Logo preview" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Camera size={32} />
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <Camera className="mx-auto text-gray-300 mb-2" size={32} />
                      <p className="text-[10px] font-black uppercase text-gray-400">Subir Logo *</p>
                    </div>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <p className="text-[9px] font-bold text-gray-400 mt-4 uppercase">PNG, JPG o WEBP (Máx 512KB)</p>
              </div>

              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Nombre del Negocio *</label>
                  <input className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={tempBiz.name} onChange={e => setTempBiz({...tempBiz, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Teléfono *</label>
                  <input className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={tempBiz.phone} onChange={e => setTempBiz({...tempBiz, phone: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Email *</label>
                  <input className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={tempBiz.email} onChange={e => setTempBiz({...tempBiz, email: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">NIT / RFC / Tax ID</label>
                  <input className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={tempBiz.taxId} onChange={e => setTempBiz({...tempBiz, taxId: e.target.value})} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Dirección *</label>
                  <input className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={tempBiz.address} onChange={e => setTempBiz({...tempBiz, address: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Divisa Base *</label>
                  <select className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={tempBiz.primaryCurrency} onChange={e => setTempBiz({...tempBiz, primaryCurrency: e.target.value})}>
                    {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Pie Ticket *</label>
                  <input className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={tempBiz.footerMessage} onChange={e => setTempBiz({...tempBiz, footerMessage: e.target.value})} />
                </div>
              </div>
            </div>
          </section>

          {/* CATALOGO WEB LOCAL SECTION */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
               <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                    <Globe className="text-brand-500" /> Catálogo Web Local (LAN)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Comparte tus productos con clientes en tu misma red Wi-Fi</p>
               </div>
               <button 
                  onClick={() => setTempBiz({ ...tempBiz, isWebCatalogActive: !tempBiz.isWebCatalogActive })}
                  className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${tempBiz.isWebCatalogActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}
               >
                  {tempBiz.isWebCatalogActive ? 'SERVIDOR ACTIVO' : 'ACTIVAR SERVIDOR'}
               </button>
            </div>

            {tempBiz.isWebCatalogActive ? (
              <div className="bg-emerald-50 border-2 border-emerald-100 p-8 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-500">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                      <div className="bg-white p-4 rounded-[2rem] shadow-xl text-emerald-600">
                          <Zap size={40} className="animate-pulse" />
                      </div>
                      <div className="flex-1 text-center md:text-left">
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Estatus: Servidor levantado en puerto {tempBiz.webCatalogPort || 8088}</p>
                          <h4 className="text-xl font-black text-slate-800 tracking-tight mb-3">Enlace de acceso local:</h4>
                          <div className="flex items-center gap-2 bg-white/60 p-3 rounded-xl border border-emerald-200">
                              <code className="text-xs font-black text-slate-700 select-all flex-1">{catalogUrl}</code>
                              <button onClick={() => { navigator.clipboard.writeText(catalogUrl); notify("Copiado al portapapeles", "success"); }} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"><Copy size={16}/></button>
                              <button onClick={() => setView(View.WEB_CATALOG)} className="p-2 text-brand-600 hover:bg-brand-100 rounded-lg transition-colors"><ExternalLink size={16}/></button>
                          </div>
                      </div>
                  </div>
                  <div className="mt-6 flex items-start gap-3 p-4 bg-white/40 rounded-2xl">
                      <Info size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                      <p className="text-[9px] font-bold text-emerald-800 uppercase leading-relaxed">
                        Solo los productos en la categoría <span className="underline font-black">"Catálogo"</span> serán visibles en la web. Los clientes no podrán realizar pedidos, solo visualizar stock y precios.
                      </p>
                  </div>
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 p-12 rounded-[2.5rem] text-center">
                  <Globe size={48} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Servidor Desconectado</p>
              </div>
            )}
          </section>

          {/* B. PERIFÉRICOS */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3 mb-8">
              <Printer className="text-brand-500" /> Periféricos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 flex items-center gap-5">
                <div className="p-4 bg-white rounded-2xl text-brand-600 shadow-sm"><Printer size={24} /></div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Impresora de Tickets</p>
                  <select 
                    className="w-full bg-transparent font-black text-xs outline-none uppercase"
                    value={tempBiz.peripherals?.printerMode || 'BROWSER'}
                    onChange={e => setTempBiz({...tempBiz, peripherals: { ...tempBiz.peripherals!, printerMode: e.target.value as any }})}
                  >
                    <option value="NONE">Ninguna</option>
                    <option value="BROWSER">Navegador (window.print)</option>
                    <option value="ESCPOS">ESC/POS (Stub)</option>
                  </select>
                </div>
              </div>
              <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 flex items-center gap-5">
                <div className="p-4 bg-white rounded-2xl text-emerald-600 shadow-sm"><Barcode size={24} /></div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Escáner Barcode</p>
                  <select 
                    className="w-full bg-transparent font-black text-xs outline-none uppercase"
                    value={tempBiz.peripherals?.barcodeScannerMode || 'HID'}
                    onChange={e => setTempBiz({...tempBiz, peripherals: { ...tempBiz.peripherals!, barcodeScannerMode: e.target.value as any }})}
                  >
                    <option value="NONE">Ninguno</option>
                    <option value="HID">Teclado HID (Recomendado)</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* C. PUNTOS DE VENTA */}
          <section className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                <Monitor className="text-brand-500" /> Puntos de Venta
              </h3>
              <button 
                onClick={addPOSTerminal}
                className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-600 transition-all shadow-xl"
              >
                <Plus size={16} /> Añadir Punto
              </button>
            </div>

            <div className="space-y-4">
              {tempBiz.posTerminals?.map((t, index) => (
                <div key={t.id} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 grid grid-cols-1 lg:grid-cols-4 gap-4 items-center animate-in slide-in-from-left">
                  <div className="lg:col-span-2 flex items-center gap-4">
                    <div className="p-4 bg-white rounded-2xl text-brand-500 shadow-sm"><Monitor size={20}/></div>
                    <input 
                      className="bg-transparent font-black text-sm uppercase tracking-widest outline-none border-b border-transparent focus:border-brand-500 w-full" 
                      value={t.name}
                      onChange={e => updatePOSTerminal(t.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Almacén Despacho</label>
                    <select 
                      className="bg-white p-2 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm border border-gray-100"
                      value={t.warehouseId}
                      onChange={e => updatePOSTerminal(t.id, { warehouseId: e.target.value })}
                    >
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      {warehouses.length === 0 && <option value="wh-default">Almacén Defecto</option>}
                    </select>
                  </div>
                  <div className="flex justify-end lg:pr-4">
                    <button 
                      onClick={() => removePOSTerminal(t.id)} 
                      className="p-3 text-red-300 hover:text-red-500 bg-white rounded-xl shadow-sm transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* D. CUENTA GOOGLE STUB */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3 mb-8">
              <Globe className="text-brand-500" /> Cuenta Google (Cloud)
            </h3>
            
            <div className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col md:flex-row items-center gap-8 ${tempBiz.googleAccount?.connected ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
               <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl ${tempBiz.googleAccount?.connected ? 'bg-white text-emerald-600' : 'bg-white text-gray-400'}`}>
                  <LogIn size={32} />
               </div>
               <div className="flex-1 text-center md:text-left">
                  {tempBiz.googleAccount?.connected ? (
                    <>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Estatus: Conectado</p>
                      <h4 className="text-xl font-black text-slate-800 tracking-tight mb-2">{tempBiz.googleAccount?.email}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Sincronización en la nube habilitada (Simulado)</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Estatus: Desconectado</p>
                      <h4 className="text-xl font-black text-slate-300 tracking-tight mb-2">Sin cuenta vinculada</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Vincule su cuenta para respaldos automáticos</p>
                    </>
                  )}
               </div>
               {tempBiz.googleAccount?.connected ? (
                 <button onClick={handleDisconnectGoogle} className="bg-white text-red-500 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-md">
                    Desconectar
                 </button>
               ) : (
                 <button onClick={() => setShowGoogleModal(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl">
                    Conectar Google
                 </button>
               )}
            </div>
          </section>

          <button onClick={saveBusinessInfo} className="w-full bg-brand-600 text-white font-black py-8 rounded-[2.5rem] shadow-2xl hover:bg-brand-500 transition-all flex items-center justify-center gap-4 uppercase tracking-[0.3em] text-xs">
            <Save size={24} /> Consolidar Empresa
          </button>
        </div>
      )}

      {activeTab === 'FINANCE' && !isRescueMode && (
        <div className="space-y-10 animate-in slide-in-from-bottom-6">
          {/* DIVISAS AVANZADAS */}
          <section className="bg-white p-6 md:p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                  <Banknote className="text-brand-500" /> Gestión de Divisas
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tasas de cambio y métodos vinculados</p>
              </div>
              <button 
                onClick={() => {
                  if (tier === 'GOLD') {
                    notify("Mejore a SAPPHIRE para añadir divisas", "error");
                    return;
                  }
                  setShowAddCurrencyModal(true);
                }}
                className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-brand-600 transition-all"
              >
                <Plus size={16} /> Añadir Divisa
              </button>
            </div>

            <div className="space-y-4">
              {currencies.map((c, index) => {
                const locked = tier === 'GOLD' && c.code !== 'CUP';
                const isBase = c.code === businessConfig.primaryCurrency;
                return (
                  <div key={c.code} className={`p-6 md:p-8 rounded-[2.5rem] border-2 transition-all grid grid-cols-1 xl:grid-cols-4 gap-6 items-center ${locked ? 'bg-gray-50/50 border-gray-100 opacity-60 grayscale' : 'bg-white border-slate-50 shadow-sm'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl font-black text-white shadow-lg ${isBase ? 'bg-brand-600' : 'bg-slate-800'}`}>{c.code}</div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Divisa {c.code}</h4>
                        {isBase && <span className="text-[8px] font-black text-brand-500 uppercase bg-brand-50 px-2 py-0.5 rounded-full">Base del sistema</span>}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Tasa Cambio (Base)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 text-slate-300" size={14} />
                        <input 
                          disabled={locked || isBase}
                          type="number"
                          className={`w-full bg-gray-50 p-2.5 pl-8 rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-brand-500 ${isBase ? 'opacity-50' : ''}`}
                          value={c.rate}
                          onChange={e => updateCurrency({ ...c, rate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    <div className="xl:col-span-2 space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Métodos de Cobro Permitidos</label>
                      <div className="flex flex-wrap gap-2">
                        {tempBiz.paymentMethods.filter(pm => pm.enabled).map(pm => {
                          const isSelected = c.allowedPaymentMethods.includes(pm.id);
                          return (
                            <button 
                              key={pm.id}
                              disabled={locked}
                              onClick={() => {
                                const newMethods = isSelected 
                                  ? c.allowedPaymentMethods.filter(id => id !== pm.id)
                                  : [...c.allowedPaymentMethods, pm.id];
                                updateCurrency({ ...c, allowedPaymentMethods: newMethods });
                              }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${isSelected ? 'bg-brand-600 border-brand-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400'}`}
                            >
                              {isSelected ? <CheckSquare size={12}/> : <Square size={12}/>}
                              {pm.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {locked && (
                      <div className="xl:col-span-4 flex items-center justify-center gap-2 p-2 bg-amber-50 rounded-xl text-amber-600 font-black text-[9px] uppercase tracking-widest">
                        <Lock size={12} /> Requiere Plan Sapphire para habilitar USD/EUR
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* PASARELAS EXISTENTES */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3"><CreditCard className="text-brand-500" /> Pasarelas de Pago</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Habilite métodos de cobro para su TPV</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {tempBiz.paymentMethods.map(m => {
                const isMethodLocked = tier === 'GOLD' && m.id !== 'CASH' && m.id !== 'TRANSFER';
                return (
                  <button 
                    key={m.id} 
                    onClick={() => {
                      if (tier === 'GOLD' && m.id !== 'CASH' && m.id !== 'TRANSFER') {
                        notify("Mejore a SAPPHIRE para este método", "error");
                        return;
                      }
                      const updatedMethods = tempBiz.paymentMethods.map(pm => pm.id === m.id ? { ...pm, enabled: !pm.enabled } : pm);
                      setTempBiz({ ...tempBiz, paymentMethods: updatedMethods });
                      updateBusinessConfig({ ...tempBiz, paymentMethods: updatedMethods });
                    }}
                    className={`relative p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 overflow-hidden ${m.enabled ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                  >
                    {isMethodLocked && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center"><Lock size={16} className="text-amber-500" /></div>}
                    <div className={m.enabled ? 'text-brand-600' : 'text-gray-300'}><Wallet size={24} /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-center leading-none">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* MODAL GOOGLE STUB */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-[3rem] p-12 w-full max-w-md animate-in zoom-in">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Conectar Google</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-8">Introduzca su email de respaldo (Stub)</p>
              <div className="space-y-4">
                 <div className="relative">
                    <Mail className="absolute left-4 top-4 text-gray-300" size={20} />
                    <input className="w-full bg-gray-50 p-4 pl-12 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-brand-500" placeholder="usuario@gmail.com" value={googleEmailInput} onChange={e => setGoogleEmailInput(e.target.value)} />
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button onClick={handleConnectGoogle} className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-600">Vincular</button>
                    <button onClick={() => setShowGoogleModal(false)} className="flex-1 bg-gray-100 text-slate-400 py-5 rounded-2xl font-black uppercase text-xs tracking-widest">Cerrar</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL AÑADIR DIVISA */}
      {showAddCurrencyModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-[3rem] p-10 w-full max-lg shadow-2xl animate-in zoom-in">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Nueva Divisa</h3>
                <button onClick={() => setShowAddCurrencyModal(false)} className="p-3 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-all"><X size={20}/></button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Código (Ej: MXN) *</label>
                      <input 
                        className="w-full bg-gray-50 p-4 rounded-2xl font-black border-none outline-none focus:ring-2 focus:ring-brand-500 uppercase" 
                        placeholder="MXN" 
                        maxLength={5}
                        value={newCurrency.code}
                        onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})}
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Símbolo</label>
                      <input 
                        className="w-full bg-gray-50 p-4 rounded-2xl font-black border-none outline-none focus:ring-2 focus:ring-brand-500 text-center" 
                        placeholder="$" 
                        value={newCurrency.symbol}
                        onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})}
                      />
                   </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tasa Cambio *</label>
                  <input 
                    type="number"
                    className="w-full bg-gray-50 p-4 rounded-2xl font-black border-none outline-none focus:ring-2 focus:ring-brand-500" 
                    placeholder="1.00" 
                    value={newCurrency.rate}
                    onChange={e => setNewCurrency({...newCurrency, rate: parseFloat(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Métodos Iniciales</label>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {tempBiz.paymentMethods.filter(pm => pm.enabled).map(pm => {
                      const isSelected = newCurrency.allowedPaymentMethods?.includes(pm.id);
                      return (
                        <button 
                          key={pm.id}
                          onClick={() => {
                            const current = newCurrency.allowedPaymentMethods || [];
                            const next = isSelected 
                              ? current.filter(id => id !== pm.id)
                              : [...current, pm.id];
                            setNewCurrency({ ...newCurrency, allowedPaymentMethods: next });
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${isSelected ? 'bg-brand-600 border-brand-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400'}`}
                        >
                          {isSelected ? <CheckSquare size={12}/> : <Square size={12}/>}
                          {pm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                    <button onClick={handleAddCurrency} className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-600 transition-all">Guardar Divisa</button>
                    <button onClick={() => setShowAddCurrencyModal(false)} className="flex-1 bg-gray-100 text-slate-400 py-5 rounded-2xl font-black uppercase text-xs tracking-widest">Cancelar</button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* MODO RESCATE / GESTIÓN DE PIN */}
      {editingPinUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-sm w-full text-center animate-in zoom-in">
            <h3 className="text-xl font-black mb-6 uppercase tracking-tighter">Actualizar PIN</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-4 tracking-widest">
              {isRescueMode ? "RESTABLECIENDO ADMINISTRADOR" : "CONFIGURACIÓN SEGURA"}
            </p>
            <input type="password" autoFocus value={newPinValue} onChange={e => setNewPinValue(e.target.value)} className="w-full text-center text-4xl border-none bg-gray-100 rounded-2xl py-6 mb-8 font-black text-slate-800 outline-none" maxLength={4} placeholder="••••" />
            <div className="flex gap-4">
              <button onClick={async () => { 
                if (editingPinUser && newPinValue.length === 4) { 
                  try {
                    if (typeof updateUserPin === 'function') {
                        await updateUserPin(editingPinUser, newPinValue); 
                        setEditingPinUser(null); 
                        setNewPinValue(''); 
                        if (isRescueMode) {
                          setIsRescueMode(false);
                          setIsAuthenticated(false); // Forzar re-login con nuevo PIN
                          localStorage.removeItem('cfg_rescue_mode');
                          localStorage.setItem('cfg_auth_fail_count', '0');
                          setFailCount(0);
                          notify("Identidad restaurada. Por favor, inicie sesión con su nuevo PIN.", "success");
                        }
                    } else {
                        console.error("StoreContext error: updateUserPin is not defined in Provider");
                        notify("Error interno del sistema al actualizar PIN", "error");
                    }
                  } catch (e) {
                    console.error(e);
                    notify("Excepción al actualizar PIN", "error");
                  }
                } 
              }} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-xs">Confirmar</button>
              {!isRescueMode && <button onClick={() => setEditingPinUser(null)} className="flex-1 bg-gray-100 text-slate-400 font-black py-4 rounded-xl uppercase text-xs">Cancelar</button>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'LICENSE' && !isRescueMode && (
        <div className="space-y-12 animate-in zoom-in">
          <div className="max-w-xl mx-auto text-center space-y-8 bg-white p-16 rounded-[4rem] shadow-sm border border-gray-100">
            <Crown size={80} className="text-brand-500 mx-auto" />
            <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Certificación Maestro</h3>
            <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 text-left">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Hardware ID (HWID)</p>
              <p className="font-mono text-xs font-black text-slate-800 bg-white p-4 rounded-xl border border-gray-100 select-all">{businessConfig.security.hwid}</p>
            </div>
            <textarea className="w-full bg-gray-50 p-6 rounded-[2rem] font-mono text-xs h-32 outline-none border-2 border-gray-100" placeholder="LLAVE MAESTRA..." value={licenseKey} onChange={e => setLicenseKey(e.target.value.toUpperCase())} />
            <button onClick={() => { applyLicenseKey(licenseKey); setLicenseKey(''); }} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-2xl uppercase tracking-[0.2em] text-xs hover:bg-brand-600 transition-all flex items-center justify-center gap-3">Activar Licencia <ShieldCheck size={18} /></button>
          </div>

          {/* LEYENDA ESTÉTICA DE PLANES */}
          <section className="mt-12">
            <div className="text-center mb-10">
               <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Comparativa de Planes</h4>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Descubra el potencial de su negocio</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               {/* GOLD */}
               <div className={`bg-white p-8 rounded-[3rem] border-2 transition-all relative overflow-hidden ${tier === 'GOLD' ? 'border-brand-500 shadow-xl' : 'border-gray-100 opacity-80'}`}>
                  {tier === 'GOLD' && <div className="absolute top-4 right-4 bg-brand-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase">Actual</div>}
                  <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl w-fit mb-6"><Sparkles size={24}/></div>
                  <h5 className="text-xl font-black text-slate-800 uppercase mb-2">GOLD EDITION</h5>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Para emprendimientos básicos</p>
                  <ul className="space-y-3">
                     {[
                        "1 Almacén principal",
                        "1 Punto de venta (POS)",
                        "3 Operadores",
                        "Divisa CUP nativa",
                        "Auditoría (5 días)",
                        "Soporte Estándar"
                     ].map(f => (
                        <li key={f} className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                           <CheckSquare size={14} className="text-emerald-500"/> {f}
                        </li>
                     ))}
                  </ul>
               </div>

               {/* SAPPHIRE */}
               <div className={`bg-white p-8 rounded-[3rem] border-2 transition-all relative overflow-hidden ${tier === 'SAPPHIRE' ? 'border-brand-500 shadow-xl' : 'border-gray-100 opacity-80'}`}>
                  {tier === 'SAPPHIRE' && <div className="absolute top-4 right-4 bg-brand-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase">Actual</div>}
                  <div className="p-4 bg-brand-50 text-brand-600 rounded-2xl w-fit mb-6"><Zap size={24}/></div>
                  <h5 className="text-xl font-black text-slate-800 uppercase mb-2">SAPPHIRE EDITION</h5>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Crecimiento y Marketing</p>
                  <ul className="space-y-3">
                     {[
                        "Hasta 3 Almacenes",
                        "Hasta 3 Puntos de Venta",
                        "15 Operadores",
                        "Soporte Multidivisa",
                        "Marketing & CRM",
                        "Auditoría (30 días)"
                     ].map(f => (
                        <li key={f} className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                           <CheckSquare size={14} className="text-emerald-500"/> {f}
                        </li>
                     ))}
                  </ul>
               </div>

               {/* PLATINUM */}
               <div className={`bg-slate-900 p-8 rounded-[3rem] border-2 transition-all relative overflow-hidden text-white ${tier === 'PLATINUM' ? 'border-brand-500 shadow-xl' : 'border-slate-800 opacity-80'}`}>
                  {tier === 'PLATINUM' && <div className="absolute top-4 right-4 bg-brand-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase">Actual</div>}
                  <div className="p-4 bg-brand-500 text-slate-900 rounded-2xl w-fit mb-6"><Crown size={24}/></div>
                  <h5 className="text-xl font-black uppercase mb-2 tracking-tighter">PLATINUM MAX</h5>
                  <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest mb-6">Control Total Ilimitado</p>
                  <ul className="space-y-3">
                     {[
                        "Almacenes Ilimitados",
                        "Terminales Ilimitados",
                        "Operadores Ilimitados",
                        "Historial de Auditoría Full",
                        "CloudSync PRO (Próximamente)",
                        "Catálogo Digital (Próximamente)"
                     ].map(f => (
                        <li key={f} className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                           <CheckSquare size={14} className="text-brand-500"/> {f}
                        </li>
                     ))}
                  </ul>
               </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
