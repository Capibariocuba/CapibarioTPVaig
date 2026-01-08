
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Role, User, BusinessConfig, CurrencyConfig, PaymentMethodType, LicenseTier, Currency, POSStoreTerminal, View, PaymentMethodConfig, PeripheralsSettings } from '../types';
import { 
  Lock, Building2, User as UserIcon, DollarSign, ShieldCheck, 
  Save, Plus, Trash2, Key, Crown, Printer, Barcode, CreditCard, 
  Phone, Mail, MapPin, Hash, Receipt, AlertCircle, Banknote, Globe, Wallet, Camera, Monitor, LogIn, LogOut, CheckSquare, Square, X,
  ArrowRight, Sparkles, Cloud, Zap, ExternalLink, Copy, Info, QrCode, ImageIcon, Timer, Palette, Cpu, MessageCircle, Check, ShieldAlert,
  Edit3, History as HistoryIcon, Smartphone, Wifi, Bluetooth, Usb, Link, Bell, Package
} from 'lucide-react';

export const Configuration: React.FC = () => {
  const { 
    users, addUser, deleteUser, updateUserPin,
    businessConfig, updateBusinessConfig, 
    currencies, updateCurrency, addCurrency, deleteCurrency, isItemLocked, applyLicenseKey,
    login, validatePin, currentUser, logout, notify, warehouses, setView,
    addPaymentMethod, updatePaymentMethod, deletePaymentMethod
  } = useStore();

  const [isAuthenticated, setIsAuthenticated] = useState(users.length === 0);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState<'BUSINESS' | 'FINANCE' | 'LICENSE' | 'USERS'>('BUSINESS');

  const [tempBiz, setTempBiz] = useState<BusinessConfig>(businessConfig);
  const [editingPinUser, setEditingPinUser] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [licenseKey, setLicenseKey] = useState('');

  const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);
  const [newCurrency, setNewCurrency] = useState<Partial<CurrencyConfig>>({
    code: '',
    symbol: '$',
    rate: 1,
    allowedPaymentMethods: ['CASH']
  });

  const [showMethodModal, setShowMethodModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<Partial<PaymentMethodConfig> | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const slideInputRef = useRef<HTMLInputElement>(null);
  const qrTransferRef = useRef<HTMLInputElement>(null);
  const qrEnzonaRef = useRef<HTMLInputElement>(null);

  const tier = (businessConfig.license?.tier || 'GOLD') as LicenseTier;

  const handleAdminLogin = async () => {
    const user = await validatePin(pinInput);
    
    if (user && user.role === Role.ADMIN) {
      await login(pinInput);
      setIsAuthenticated(true);
      setPinInput('');
      notify("Acceso Administrativo Concedido", "success");
    } else if (user) {
      alert("Acceso denegado: Se requiere rol Administrador.");
      setPinInput('');
    } else {
      notify("PIN Incorrecto", "error");
      setPinInput('');
    }
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 524288) { notify("Imagen muy grande (máx 512KB)", "error"); return; }
      const reader = new FileReader();
      reader.onloadend = () => setTempBiz({ ...tempBiz, logo: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleSlideUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 524288) { notify("Imagen muy grande (máx 512KB)", "error"); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        const current = tempBiz.digitalCatalogImages || [];
        setTempBiz({ ...tempBiz, digitalCatalogImages: [...current, reader.result as string] });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'transfer' | 'enzona') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'transfer') setTempBiz({ ...tempBiz, qrTransferImageData: reader.result as string });
        else setTempBiz({ ...tempBiz, qrEnzonaImageData: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveBusinessInfo = () => {
    if (!tempBiz.logo) { notify("El Logo es obligatorio", "error"); return; }
    if (!tempBiz.name.trim()) { notify("Nombre del negocio obligatorio", "error"); return; }
    if (!tempBiz.phone.trim()) { notify("Teléfono obligatorio", "error"); return; }
    if (!tempBiz.email.trim() || !validateEmail(tempBiz.email)) { notify("Email inválido o vacío", "error"); return; }
    if (!tempBiz.address.trim()) { notify("Dirección obligatoria", "error"); return; }

    updateBusinessConfig(tempBiz);
    notify("Datos de empresa guardados", "success");
  };

  const handleAddCurrency = () => {
    const { code, rate, symbol } = newCurrency;
    if (!code || code.length < 3 || code.length > 5) { notify("Código de divisa inválido", "error"); return; }
    if (currencies.some(c => c.code === code.toUpperCase())) { notify("Esa divisa ya existe", "error"); return; }
    if (!rate || rate <= 0) { notify("La tasa debe ser mayor que 0", "error"); return; }
    
    addCurrency({ 
      code: code.toUpperCase(), 
      symbol: symbol || '$', 
      rate: rate, 
      allowedPaymentMethods: newCurrency.allowedPaymentMethods || ['CASH'] 
    });
    
    setShowAddCurrencyModal(false);
    setNewCurrency({ code: '', symbol: '$', rate: 1, allowedPaymentMethods: ['CASH'] });
  };

  const handleSaveMethod = () => {
    if (!editingMethod?.label?.trim()) { notify("Etiqueta obligatoria", "error"); return; }
    
    const method: PaymentMethodConfig = {
      id: editingMethod.id || editingMethod.label.toUpperCase().replace(/\s/g, '_'),
      label: editingMethod.label,
      enabled: editingMethod.enabled ?? true,
      showInTicket: editingMethod.showInTicket ?? true
    };

    if (businessConfig.paymentMethods.some(pm => pm.id === method.id)) {
      updatePaymentMethod(method);
    } else {
      addPaymentMethod(method);
    }
    setShowMethodModal(false);
    setEditingMethod(null);
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) return;
    const success = await applyLicenseKey(licenseKey);
    if (success) {
      setLicenseKey('');
      notify("Licencia actualizada con éxito", "success");
    } else {
      notify("Llave de licencia inválida", "error");
    }
  };

  const updatePeriph = (updates: Partial<PeripheralsSettings>) => {
    setTempBiz({
        ...tempBiz,
        peripherals: {
            ...(tempBiz.peripherals || { printerMode: 'WEB', barcodeScannerMode: 'KEYBOARD' }),
            ...updates
        }
    });
  };

  if (!isAuthenticated && users.length > 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl max-sm w-full text-center animate-in zoom-in duration-300">
          <div className="bg-brand-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 text-brand-600"><ShieldCheck size={48} /></div>
          <h2 className="text-3xl font-black mb-4 text-slate-900 uppercase">Seguridad Admin</h2>
          <input type="password" autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} className="w-full text-center text-5xl border-none bg-gray-100 rounded-2xl py-6 mb-8 font-black text-slate-800 outline-none" maxLength={4} placeholder="••••" />
          <button onClick={handleAdminLogin} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all">Desbloquear</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Configuración</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gestión del ecosistema Capibario</p>
        </div>
        {users.length > 0 && (
          <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl hover:bg-red-600 transition-colors"><Lock size={20} /></button>
        )}
      </div>

      <div className="flex gap-2 mb-10 bg-white p-2 rounded-3xl shadow-sm border border-gray-100 overflow-x-auto scrollbar-hide">
        {[
          { id: 'BUSINESS', label: 'Empresa', icon: Building2 },
          { id: 'FINANCE', label: 'Finanzas', icon: DollarSign },
          { id: 'LICENSE', label: 'Licencia', icon: ShieldCheck }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-gray-50'}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'BUSINESS' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-6">
          {/* INFORMACION GENERAL */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3 mb-8"><Building2 className="text-brand-500" /> Información General</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="flex flex-col items-center">
                <div onClick={() => logoInputRef.current?.click()} className={`w-48 h-48 rounded-[2.5rem] border-4 border-dashed border-gray-200 flex items-center justify-center overflow-hidden transition-all group relative ${tempBiz.logo ? 'border-brand-500 bg-white shadow-inner' : 'bg-gray-50'}`}>
                  {tempBiz.logo ? (
                    <><img src={tempBiz.logo} className="w-full h-full object-contain p-4" alt="Logo" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Camera size={32} /></div></>
                  ) : (
                    <div className="text-center p-4"><Camera className="mx-auto text-gray-300 mb-2" size={32} /><p className="text-[10px] font-black uppercase text-gray-400">Subir Logo *</p></div>
                  )}
                </div>
                <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <input className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" placeholder="Nombre" value={tempBiz.name} onChange={e => setTempBiz({...tempBiz, name: e.target.value})} />
                <input className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" placeholder="Teléfono" value={tempBiz.phone} onChange={e => setTempBiz({...tempBiz, phone: e.target.value})} />
                <input className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" placeholder="Email" value={tempBiz.email} onChange={e => setTempBiz({...tempBiz, email: e.target.value})} />
                <input className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" placeholder="Tax ID" value={tempBiz.taxId} onChange={e => setTempBiz({...tempBiz, taxId: e.target.value})} />
                <input className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none md:col-span-2" placeholder="Dirección" value={tempBiz.address} onChange={e => setTempBiz({...tempBiz, address: e.target.value})} />
                <select className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" value={tempBiz.primaryCurrency} onChange={e => setTempBiz({...tempBiz, primaryCurrency: e.target.value})}>{currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
              </div>
            </div>
          </section>

          {/* PERIFERICOS Y HARDWARE */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3 mb-8"><Printer className="text-brand-500" /> Periféricos y Hardware</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Receipt size={14}/> Impresora de Tickets</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Modo</label>
                    <select className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" value={tempBiz.peripherals?.printerMode || 'WEB'} onChange={e => updatePeriph({ printerMode: e.target.value as any })}>
                      <option value="WEB">Navegador (Estándar)</option>
                      <option value="DESKTOP">App Desktop (TCP/IP)</option>
                      <option value="ANDROID">Móvil (Bluetooth)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Papel</label>
                    <select className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" value={tempBiz.printerConfig.paperSize} onChange={e => setTempBiz({ ...tempBiz, printerConfig: { ...tempBiz.printerConfig, paperSize: e.target.value as any } })}>
                      <option value="57mm">57mm (Angosta)</option>
                      <option value="80mm">80mm (Estándar)</option>
                    </select>
                  </div>
                </div>
                <input className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" placeholder="Nombre/IP Impresora" value={tempBiz.peripherals?.printerName || ''} onChange={e => updatePeriph({ printerName: e.target.value })} />
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Barcode size={14}/> Lector de Código de Barras</h4>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Modo de Entrada</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'KEYBOARD', label: 'USB/HID', icon: Usb },
                        { id: 'CAMERA', label: 'Cámara', icon: Camera },
                        { id: 'BLUETOOTH', label: 'BT', icon: Bluetooth }
                      ].map(mode => (
                        <button key={mode.id} onClick={() => updatePeriph({ barcodeScannerMode: mode.id as any })} className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${tempBiz.peripherals?.barcodeScannerMode === mode.id ? 'bg-brand-50 border-brand-500 text-brand-600 shadow-md' : 'bg-gray-50 border-transparent text-slate-400'}`}>
                          <mode.icon size={20} />
                          <span className="text-[9px] font-black uppercase">{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer">
                    <input type="checkbox" checked={tempBiz.scannerConfig.enabled} onChange={e => setTempBiz({ ...tempBiz, scannerConfig: { ...tempBiz.scannerConfig, enabled: e.target.checked } })} className="w-5 h-5 accent-brand-500" />
                    <span className="text-[10px] font-black uppercase text-slate-700">Auto-enfoque / Lectura Continua</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* CATALOGO DIGITAL */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3"><Monitor className="text-brand-500" /> Catálogo Digital e Identidad Visual</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-14 h-8 rounded-full p-1 transition-all ${tempBiz.isWebCatalogActive ? 'bg-brand-600' : 'bg-slate-200'}`}>
                        <div className={`bg-white w-6 h-6 rounded-full shadow transition-all ${tempBiz.isWebCatalogActive ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                    <input type="checkbox" className="hidden" checked={tempBiz.isWebCatalogActive} onChange={e => setTempBiz({...tempBiz, isWebCatalogActive: e.target.checked})} />
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tempBiz.isWebCatalogActive ? 'ACTIVO' : 'INACTIVO'}</span>
                </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-3xl text-white flex items-center justify-between border-l-4 border-brand-500">
                    <div>
                        <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest mb-1">Enlace del Catálogo</p>
                        <p className="font-bold text-xs">Abre el catálogo en otra pantalla</p>
                    </div>
                    <a href="#/catalog" target="_blank" className="p-3 bg-white/10 rounded-xl hover:bg-brand-500 transition-all text-white"><ExternalLink size={20}/></a>
                </div>

                <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Sparkles size={14}/> Cintillo Informativo</h4>
                    <input className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-brand-500" placeholder="Ej: ¡Bienvenidos! Tenemos ofertas hoy..." value={tempBiz.digitalCatalogTicker || ''} onChange={e => setTempBiz({...tempBiz, digitalCatalogTicker: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Color Fondo</label>
                            <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-2xl">
                                <input type="color" className="w-10 h-10 rounded-xl cursor-pointer" value={tempBiz.digitalCatalogTickerBgColor || '#0ea5e9'} onChange={e => setTempBiz({...tempBiz, digitalCatalogTickerBgColor: e.target.value})} />
                                <span className="text-[10px] font-mono font-bold text-slate-500">{tempBiz.digitalCatalogTickerBgColor || '#0ea5e9'}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Color Texto</label>
                            <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-2xl">
                                <input type="color" className="w-10 h-10 rounded-xl cursor-pointer" value={tempBiz.digitalCatalogTickerTextColor || '#ffffff'} onChange={e => setTempBiz({...tempBiz, digitalCatalogTickerTextColor: e.target.value})} />
                                <span className="text-[10px] font-mono font-bold text-slate-500">{tempBiz.digitalCatalogTickerTextColor || '#ffffff'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 flex items-center gap-1"><Timer size={10}/> Rotación de Pantalla (Segundos)</label>
                        <input type="number" className="w-full bg-gray-50 p-4 rounded-2xl font-black text-center" value={tempBiz.digitalCatalogRotationSeconds || 10} onChange={e => setTempBiz({...tempBiz, digitalCatalogRotationSeconds: parseInt(e.target.value) || 10})} />
                    </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><ImageIcon size={14}/> Diapositivas Promocionales</h4>
                    <button onClick={() => slideInputRef.current?.click()} className="text-[9px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-1"><Plus size={14}/> Añadir Imagen</button>
                    <input ref={slideInputRef} type="file" className="hidden" accept="image/*" onChange={handleSlideUpload} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {tempBiz.digitalCatalogImages?.map((img, idx) => (
                        <div key={idx} className="aspect-video bg-gray-100 rounded-2xl relative overflow-hidden group border border-gray-200">
                            <img src={img} className="w-full h-full object-cover" alt="Slide" />
                            <button onClick={() => {
                                const next = (tempBiz.digitalCatalogImages || []).filter((_, i) => i !== idx);
                                setTempBiz({ ...tempBiz, digitalCatalogImages: next });
                            }} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                        </div>
                    ))}
                    {(tempBiz.digitalCatalogImages?.length || 0) === 0 && (
                        <div className="col-span-full py-10 border-2 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center justify-center text-slate-300">
                            <ImageIcon size={32} className="mb-2 opacity-20" />
                            <p className="text-[9px] font-black uppercase tracking-widest">Sin imágenes promocionales</p>
                        </div>
                    )}
                </div>
              </div>
            </div>
          </section>

          {/* PAGOS DIGITALES QR */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3 mb-8"><QrCode className="text-brand-500" /> Pagos Digitales (Códigos QR)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* QR TRANSFERMOVIL */}
                <div className={`p-8 rounded-[3rem] border-2 transition-all flex items-center gap-6 ${tempBiz.showQrTransfer ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-transparent'}`}>
                    <div className="w-32 h-32 bg-white rounded-2xl shadow-inner flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-200 relative group shrink-0">
                        {tempBiz.qrTransferImageData ? (
                            <><img src={tempBiz.qrTransferImageData} className="w-full h-full object-contain p-2" alt="QR Transfer" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer" onClick={() => qrTransferRef.current?.click()}><Camera size={24}/></div></>
                        ) : (
                            <button onClick={() => qrTransferRef.current?.click()} className="text-slate-300 flex flex-col items-center gap-1"><Camera size={24}/><span className="text-[8px] font-black uppercase">Subir QR</span></button>
                        )}
                        <input ref={qrTransferRef} type="file" className="hidden" accept="image/*" onChange={e => handleQrUpload(e, 'transfer')} />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-black text-slate-800 uppercase text-xs">Transfermóvil</h4>
                            <label className="cursor-pointer">
                                <div className={`w-10 h-6 rounded-full p-1 transition-all ${tempBiz.showQrTransfer ? 'bg-brand-600' : 'bg-slate-300'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow transition-all ${tempBiz.showQrTransfer ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                                <input type="checkbox" className="hidden" checked={tempBiz.showQrTransfer} onChange={e => setTempBiz({...tempBiz, showQrTransfer: e.target.checked})} />
                            </label>
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Muestra tu QR de transferencia en el catálogo digital para facilitar el pago remoto.</p>
                    </div>
                </div>

                {/* QR ENZONA */}
                <div className={`p-8 rounded-[3rem] border-2 transition-all flex items-center gap-6 ${tempBiz.showQrEnzona ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-transparent'}`}>
                    <div className="w-32 h-32 bg-white rounded-2xl shadow-inner flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-200 relative group shrink-0">
                        {tempBiz.qrEnzonaImageData ? (
                            <><img src={tempBiz.qrEnzonaImageData} className="w-full h-full object-contain p-2" alt="QR Enzona" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer" onClick={() => qrEnzonaRef.current?.click()}><Camera size={24}/></div></>
                        ) : (
                            <button onClick={() => qrEnzonaRef.current?.click()} className="text-slate-300 flex flex-col items-center gap-1"><Camera size={24}/><span className="text-[8px] font-black uppercase">Subir QR</span></button>
                        )}
                        <input ref={qrEnzonaRef} type="file" className="hidden" accept="image/*" onChange={e => handleQrUpload(e, 'enzona')} />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-black text-slate-800 uppercase text-xs">Enzona</h4>
                            <label className="cursor-pointer">
                                <div className={`w-10 h-6 rounded-full p-1 transition-all ${tempBiz.showQrEnzona ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow transition-all ${tempBiz.showQrEnzona ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                                <input type="checkbox" className="hidden" checked={tempBiz.showQrEnzona} onChange={e => setTempBiz({...tempBiz, showQrEnzona: e.target.checked})} />
                            </label>
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Muestra tu QR de Enzona para cobros rápidos mediante escaneo del cliente.</p>
                    </div>
                </div>
            </div>
          </section>

          {/* OPCIONES DE OPERATIVA (TICKETS Y REPORTES) */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3 mb-8"><Zap className="text-brand-500" /> Opciones de Operativa y Tickets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <label className="p-6 rounded-[2rem] bg-gray-50 flex items-center gap-4 cursor-pointer hover:bg-brand-50 transition-colors group">
                    <div className={`p-3 rounded-xl transition-colors ${tempBiz.includeInventoryInZReport ? 'bg-brand-500 text-white' : 'bg-white text-slate-300 group-hover:bg-brand-100 group-hover:text-brand-500'}`}><Package size={20}/></div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-slate-700">Inventario en Reporte Z</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Resumen de stock al cierre</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5 accent-brand-500" checked={tempBiz.includeInventoryInZReport} onChange={e => setTempBiz({...tempBiz, includeInventoryInZReport: e.target.checked})} />
                </label>

                <label className="p-6 rounded-[2rem] bg-gray-50 flex items-center gap-4 cursor-pointer hover:bg-brand-50 transition-colors group">
                    <div className={`p-3 rounded-xl transition-colors ${tempBiz.isOrderCallingActive ? 'bg-brand-500 text-white' : 'bg-white text-slate-300 group-hover:bg-brand-100 group-hover:text-brand-500'}`}><Bell size={20}/></div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-slate-700">Llamado de Pedidos</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Habilitar overlay en catálogo</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5 accent-brand-500" checked={tempBiz.isOrderCallingActive} onChange={e => setTempBiz({...tempBiz, isOrderCallingActive: e.target.checked})} />
                </label>

                <label className="p-6 rounded-[2rem] bg-gray-50 flex items-center gap-4 cursor-pointer hover:bg-brand-50 transition-colors group">
                    <div className={`p-3 rounded-xl transition-colors ${tempBiz.showFooter ? 'bg-brand-500 text-white' : 'bg-white text-slate-300 group-hover:bg-brand-100 group-hover:text-brand-500'}`}><MessageCircle size={20}/></div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-slate-700">Mensaje de Pie</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Mostrar nota en tickets</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5 accent-brand-500" checked={tempBiz.showFooter} onChange={e => setTempBiz({...tempBiz, showFooter: e.target.checked})} />
                </label>
            </div>
            {tempBiz.showFooter && (
                <div className="mt-6 p-6 bg-gray-50 rounded-[2.5rem] animate-in slide-in-from-top-4">
                    <label className="text-[9px] font-black text-slate-400 uppercase pl-4 tracking-widest mb-2 block">Texto Personalizado para Ticket</label>
                    <textarea className="w-full bg-white border-2 border-gray-100 p-5 rounded-3xl font-bold text-xs h-24 outline-none focus:border-brand-500 resize-none" value={tempBiz.footerMessage || ''} onChange={e => setTempBiz({...tempBiz, footerMessage: e.target.value})} placeholder="Ej: Gracias por su compra, vuelva pronto..." />
                </div>
            )}
          </section>

          <button onClick={saveBusinessInfo} className="w-full bg-brand-600 text-white font-black py-8 rounded-[2.5rem] shadow-2xl hover:bg-brand-500 transition-all flex items-center justify-center gap-4 uppercase tracking-[0.3em] text-xs"><Save size={24} /> Consolidar Empresa</button>
        </div>
      )}

      {activeTab === 'FINANCE' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-6">
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3"><Banknote className="text-brand-500" /> Gestión de Divisas</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuración monetaria y tasas de cambio</p></div>
              {tier === 'PLATINUM' && (
                  <button onClick={() => setShowAddCurrencyModal(true)} className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-brand-600 transition-all"><Plus size={16} /> Añadir Divisa</button>
              )}
            </div>
            {tier === 'GOLD' && (
              <div className="p-8 bg-amber-50 rounded-3xl border border-amber-100 flex items-center gap-4 mb-6">
                 <Lock className="text-amber-500" size={24} />
                 <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest">El Plan GOLD solo permite operar en moneda CUP. Actualice a PLATINUM para multi-divisa.</p>
              </div>
            )}
            <div className="space-y-4">
              {currencies.filter(c => tier === 'PLATINUM' || c.code === 'CUP').map((c) => {
                const isBase = c.code === businessConfig.primaryCurrency;
                return (
                  <div key={c.code} className="p-6 md:p-8 rounded-[2.5rem] border-2 bg-white border-slate-50 shadow-sm transition-all grid grid-cols-1 xl:grid-cols-4 gap-6 items-center group">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl font-black text-white shadow-lg ${isBase ? 'bg-brand-600' : 'bg-slate-800'}`}>{c.code}</div>
                        <div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">{c.code} ({c.symbol})</h4></div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Tasa Cambio</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3 text-slate-300" size={14} />
                            <input disabled={isBase} type="number" className="w-full bg-gray-50 p-2.5 pl-8 rounded-xl font-black text-sm outline-none" value={c.rate} onChange={e => updateCurrency({ ...c, rate: parseFloat(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div className="xl:col-span-1 flex flex-wrap gap-2">
                        {tempBiz.paymentMethods.filter(pm => pm.enabled).map(pm => {
                          const isSelected = c.allowedPaymentMethods.includes(pm.id);
                          return <button key={pm.id} onClick={() => { const newMethods = isSelected ? c.allowedPaymentMethods.filter(id => id !== pm.id) : [...c.allowedPaymentMethods, pm.id]; updateCurrency({ ...c, allowedPaymentMethods: newMethods }); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${isSelected ? 'bg-brand-600 text-white' : 'bg-white text-gray-400'}`}>{isSelected ? <CheckSquare size={12}/> : <Square size={12}/>}{pm.label}</button>;
                        })}
                    </div>
                    <div className="flex justify-end">
                        {!isBase && tier === 'PLATINUM' && (
                            <button onClick={() => { if(confirm(`¿Eliminar divisa ${c.code}?`)) deleteCurrency(c.code); }} className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={20}/></button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3"><CreditCard className="text-brand-500" /> Métodos de Pago</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Habilite canales de cobro para el TPV</p></div>
              <button onClick={() => { setEditingMethod({ label: '', enabled: true, showInTicket: true }); setShowMethodModal(true); }} className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-brand-600 transition-all"><Plus size={16} /> Nuevo Método</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {businessConfig.paymentMethods.map(pm => (
                    <div key={pm.id} className={`p-6 rounded-[2.5rem] border-2 transition-all flex flex-col justify-between ${pm.enabled ? 'bg-white border-slate-50 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${pm.enabled ? 'bg-brand-50 text-brand-600' : 'bg-gray-200 text-gray-400'}`}><Wallet size={20}/></div>
                                <div><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">{pm.label}</h4><p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">ID: {pm.id}</p></div>
                            </div>
                            <label className="cursor-pointer">
                                <div className={`w-10 h-6 rounded-full p-1 transition-all ${pm.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow transition-all ${pm.enabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                                <input type="checkbox" className="hidden" checked={pm.enabled} onChange={e => updatePaymentMethod({...pm, enabled: e.target.checked})} />
                            </label>
                        </div>
                        <div className="flex items-center justify-between border-t border-gray-50 pt-4 mt-2">
                            <button onClick={() => { setEditingMethod(pm); setShowMethodModal(true); }} className="text-[9px] font-black text-brand-600 uppercase tracking-widest hover:underline">Configurar</button>
                            {!['CASH', 'TRANSFER', 'CREDIT'].includes(pm.id as string) && (
                                <button onClick={() => { if(confirm('¿Eliminar método?')) deletePaymentMethod(pm.id as string); }} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'LICENSE' && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6">
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3 mb-8"><Crown className="text-brand-500" /> Estatus de Suscripción</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="bg-slate-900 p-8 rounded-[3rem] text-white relative overflow-hidden">
                  <Sparkles className="absolute -right-10 -bottom-10 w-48 h-48 opacity-10" />
                  <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] mb-4">Plan Actual</p>
                  <h4 className="text-4xl font-black uppercase tracking-tighter mb-2">{tier} Edition</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Licencia: {businessConfig.licenseStatus}</p>
                  <div className="p-4 bg-white/10 rounded-2xl border border-white/10 flex items-center gap-4">
                     <div className="p-3 bg-brand-500 rounded-xl"><Cpu size={20}/></div>
                     <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Hardware ID</p><p className="text-[11px] font-black font-mono">{businessConfig.security.hwid}</p></div>
                  </div>
               </div>
               <div className="space-y-6">
                  <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase pl-2 tracking-widest">Llave de Activación</label>
                      <div className="relative">
                          <Key className="absolute left-5 top-5 text-brand-500" size={24} />
                          <input className="w-full bg-gray-50 border-2 border-gray-100 p-5 pl-14 rounded-3xl font-black text-slate-800 tracking-widest outline-none focus:border-brand-500" placeholder="XXXX-XXXX-XXXX-XXXX" value={licenseKey} onChange={e => setLicenseKey(e.target.value)} />
                      </div>
                  </div>
                  <button onClick={handleActivateLicense} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-xl hover:bg-brand-600 transition-all uppercase tracking-widest text-xs">Validar y Activar</button>
               </div>
            </div>
          </section>
        </div>
      )}

      {/* MODAL AÑADIR DIVISA */}
      {showAddCurrencyModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Añadir Divisa</h2>
                <button onClick={() => setShowAddCurrencyModal(false)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-6">
                <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Código ISO (Ej: USD)</label><input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 uppercase" maxLength={5} value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Símbolo</label><input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none" placeholder="$" value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Tasa Cambio</label><input type="number" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none" value={newCurrency.rate} onChange={e => setNewCurrency({...newCurrency, rate: parseFloat(e.target.value) || 1})} /></div>
                </div>
                <button onClick={handleAddCurrency} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-xl hover:bg-brand-600 transition-all uppercase text-xs tracking-widest">Registrar Divisa</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MÉTODOS DE PAGO */}
      {showMethodModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black uppercase tracking-tighter">{editingMethod?.id ? 'Configurar Canal' : 'Nuevo Canal de Cobro'}</h2>
                <button onClick={() => setShowMethodModal(false)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-6">
                <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Nombre del Método *</label><input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 uppercase" value={editingMethod?.label || ''} onChange={e => setEditingMethod({...editingMethod!, label: e.target.value})} /></div>
                <div className="flex flex-col gap-4 bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <label className="flex items-center gap-4 cursor-pointer group">
                        <input type="checkbox" className="w-6 h-6 accent-brand-500" checked={editingMethod?.enabled ?? true} onChange={e => setEditingMethod({...editingMethod!, enabled: e.target.checked})} />
                        <div><p className="text-[10px] font-black uppercase text-slate-800">Canal Habilitado</p><p className="text-[8px] font-bold text-slate-400 uppercase">Permite usar este medio en el TPV</p></div>
                    </label>
                    <label className="flex items-center gap-4 cursor-pointer group">
                        <input type="checkbox" className="w-6 h-6 accent-brand-500" checked={editingMethod?.showInTicket ?? true} onChange={e => setEditingMethod({...editingMethod!, showInTicket: e.target.checked})} />
                        <div><p className="text-[10px] font-black uppercase text-slate-800">Mostrar en Ticket</p><p className="text-[8px] font-bold text-slate-400 uppercase">Imprime el detalle de pago en el recibo</p></div>
                    </label>
                </div>
                <button onClick={handleSaveMethod} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-xl hover:bg-brand-600 transition-all uppercase text-xs tracking-widest">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
