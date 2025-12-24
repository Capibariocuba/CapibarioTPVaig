
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Role, User, BusinessConfig } from '../types';
import { Lock, Building2, User as UserIcon, DollarSign, ShieldCheck, Save, Plus, Trash2, Key, Crown } from 'lucide-react';

export const Configuration: React.FC = () => {
  const { 
    users, addUser, deleteUser, businessConfig, updateBusinessConfig, 
    currencies, isItemLocked, applyLicenseKey 
  } = useStore();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState<'BUSINESS' | 'USERS' | 'FINANCE' | 'LICENSE'>('USERS');

  const [tempBiz, setTempBiz] = useState<BusinessConfig>(businessConfig);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ role: Role.ADMIN });
  const [licenseKey, setLicenseKey] = useState('');

  const handleAdminLogin = () => {
    const admin = users.find(u => u.role === Role.ADMIN && u.pin === pinInput);
    if (admin) {
      setIsAuthenticated(true);
      setPinInput('');
    } else {
      alert("PIN Maestro Incorrecto");
      setPinInput('');
    }
  };

  const saveBusiness = () => {
    updateBusinessConfig(tempBiz);
    alert("Datos de empresa actualizados correctamente.");
  };

  if (!isAuthenticated && users.length > 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl max-w-sm w-full text-center">
          <div className="bg-brand-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 text-brand-600"><ShieldCheck size={48} /></div>
          <h2 className="text-3xl font-black mb-4 text-slate-900 uppercase">Admin TPV</h2>
          <input 
            type="password" 
            autoFocus 
            value={pinInput} 
            onChange={e => setPinInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} 
            className="w-full text-center text-5xl border-none bg-gray-100 rounded-2xl py-6 mb-8 font-black text-slate-800 outline-none focus:ring-4 focus:ring-brand-500/20" 
            maxLength={4} 
            placeholder="••••" 
          />
          <button onClick={handleAdminLogin} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all">Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Configuración General</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Control de Sistema y Licencias</p>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl hover:bg-red-600 transition-colors"><Lock size={20} /></button>
      </div>

      <div className="flex gap-2 mb-10 bg-white p-2 rounded-3xl shadow-sm border border-gray-100 overflow-x-auto">
        {[
          { id: 'USERS', label: 'Operadores', icon: UserIcon },
          { id: 'BUSINESS', label: 'Empresa', icon: Building2 },
          { id: 'FINANCE', label: 'Finanzas', icon: DollarSign },
          { id: 'LICENSE', label: 'Licencia', icon: ShieldCheck }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-gray-50'}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'USERS' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800">Listado de Personal</h3>
            <button onClick={() => setIsAddingUser(true)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-brand-600 transition-all"><Plus size={16} /> Nuevo Operador</button>
          </div>

          {isAddingUser && (
            <div className="bg-white p-8 rounded-[2rem] border-2 border-brand-500 shadow-xl animate-in zoom-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input className="p-4 bg-gray-50 rounded-xl font-bold text-sm" placeholder="Nombre" onChange={e => setNewUser({...newUser, name: e.target.value})} />
                <input className="p-4 bg-gray-50 rounded-xl font-black text-center tracking-widest" maxLength={4} placeholder="PIN" onChange={e => setNewUser({...newUser, pin: e.target.value})} />
                <select className="p-4 bg-gray-50 rounded-xl font-bold text-xs uppercase" onChange={e => setNewUser({...newUser, role: e.target.value as Role})}>
                  {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => { addUser(newUser as User); setIsAddingUser(false); }} className="flex-1 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase">Crear</button>
                  <button onClick={() => setIsAddingUser(false)} className="px-4 bg-gray-100 text-gray-400 rounded-xl font-black">X</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                <tr><th className="p-6">Operador</th><th className="p-6 text-center">Estado</th><th className="p-6 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u, index) => {
                  const locked = isItemLocked('OPERATORS', index);
                  return (
                    <tr key={u.id} className={locked ? 'bg-amber-50/20' : ''}>
                      <td className="p-6"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">{u.name.charAt(0)}</div><span className="font-bold text-slate-800">{u.name} ({u.role})</span></div></td>
                      <td className="p-6 text-center">{locked ? <span className="text-amber-500 font-black text-[9px] uppercase">Soft-Locked</span> : <span className="text-emerald-500 font-black text-[9px] uppercase">Activo</span>}</td>
                      <td className="p-6 text-right">{!locked && <button onClick={() => deleteUser(u.id)} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={18} /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'BUSINESS' && (
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 space-y-8">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Datos de la Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 pl-2">Nombre del Negocio</label><input className="w-full bg-gray-50 p-4 rounded-xl font-bold" value={tempBiz.name} onChange={e => setTempBiz({...tempBiz, name: e.target.value})} /></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 pl-2">Dirección</label><input className="w-full bg-gray-50 p-4 rounded-xl font-bold" value={tempBiz.address} onChange={e => setTempBiz({...tempBiz, address: e.target.value})} /></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 pl-2">Teléfono</label><input className="w-full bg-gray-50 p-4 rounded-xl font-bold" value={tempBiz.phone} onChange={e => setTempBiz({...tempBiz, phone: e.target.value})} /></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 pl-2">Identificación Fiscal</label><input className="w-full bg-gray-50 p-4 rounded-xl font-bold" value={tempBiz.taxId} onChange={e => setTempBiz({...tempBiz, taxId: e.target.value})} /></div>
          </div>
          <button onClick={saveBusiness} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-xs hover:bg-brand-600 transition-all shadow-xl"><Save size={18}/> Guardar Cambios</button>
        </div>
      )}

      {activeTab === 'FINANCE' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-gray-100 flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800">Gestión de Divisas</h3>
            <p className="text-xs text-slate-400 font-bold">Configure las tasas de conversión maestro</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {currencies.map(c => (
              <div key={c.code} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">{c.code}</span>
                <span className="text-3xl font-black text-slate-900">${c.rate.toFixed(2)}</span>
                <button className="mt-4 text-[9px] font-black text-slate-400 uppercase hover:text-brand-500">Ajustar Tasa</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'LICENSE' && (
        <div className="max-w-xl mx-auto text-center space-y-8 bg-white p-12 rounded-[3.5rem] shadow-sm border border-gray-100">
          <Crown size={64} className="text-brand-500 mx-auto" />
          <h3 className="text-2xl font-black text-slate-900 uppercase">Estado de la Licencia</h3>
          <div className="bg-gray-50 p-6 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hardware ID de este equipo</p>
            <p className="font-mono text-sm font-black text-slate-800">{businessConfig.security.hwid}</p>
          </div>
          <textarea 
            className="w-full bg-gray-50 p-6 rounded-2xl font-mono text-xs h-32 outline-none focus:ring-4 focus:ring-brand-500/10 border-2 border-gray-100 uppercase" 
            placeholder="PEGUE AQUÍ SU LLAVE DE ACTIVACIÓN" 
            value={licenseKey} 
            onChange={e => setLicenseKey(e.target.value.toUpperCase())} 
          />
          <button onClick={() => { applyLicenseKey(licenseKey); setLicenseKey(''); }} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs hover:bg-brand-600 shadow-xl transition-all">Sincronizar Plan</button>
        </div>
      )}
    </div>
  );
};
