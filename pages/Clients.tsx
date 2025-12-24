
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Client, Currency, ClientGroup, Coupon, Offer, View } from '../types';
import { 
  User, Phone, Search, Plus, Camera, CreditCard, History, IdCard, Trash2, 
  ArrowUpCircle, Settings, X, Gift, Ticket as TicketIcon, Tag, Lock, Crown, MessageCircle, AlertTriangle
} from 'lucide-react';

const UpgradePrompt: React.FC<{ plan: string }> = ({ plan }) => (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 text-center animate-in zoom-in duration-300">
        <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-gray-100 max-w-md">
            <div className="bg-brand-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-brand-600">
                <Crown size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tighter uppercase">Módulo de Marketing</h3>
            <p className="text-slate-500 text-sm font-bold leading-relaxed mb-8 uppercase tracking-widest">Este panel está disponible exclusivamente para licencias <span className="text-brand-600">{plan}</span> o superiores.</p>
            <div className="space-y-3">
                <a 
                    href="https://wa.me/5350019541" 
                    target="_blank" 
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-5 rounded-3xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-100 uppercase tracking-widest text-[10px]"
                >
                    <MessageCircle size={18} /> Solicitar Upgrade
                </a>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Soporte Técnico: +53 50019541</p>
            </div>
        </div>
    </div>
);

export const Clients: React.FC = () => {
  const { 
    clients, addClient, updateClient, clientGroups, addClientGroup, 
    executeLedgerTransaction, currentUser, isItemLocked,
    coupons, addCoupon, deleteCoupon,
    offers, addOffer, deleteOffer,
    checkModuleAccess, businessConfig
  } = useStore();
  
  const isRestricted = !checkModuleAccess(View.CLIENTS);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<Partial<Client>>({});
  const [mainTab, setMainTab] = useState<'LIST' | 'MARKETING'>('LIST');

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search) ||
    c.ci?.includes(search)
  );

  const handleSave = () => {
    if (!editingClient.name) return;
    try {
        if (editingClient.id) updateClient(editingClient as Client);
        else addClient({ ...editingClient, id: Math.random().toString(36).substr(2, 9), balance: 0, createdAt: new Date().toISOString() } as Client);
        setIsModalOpen(false);
        setEditingClient({});
    } catch (e) {
        // Error gestionado en Context
    }
  };

  // Fix for line 159: Added handlePhotoChange to process image files as base64 strings
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingClient(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-8 bg-gray-50 h-full overflow-y-auto relative animate-in fade-in duration-500">
      {isRestricted && <div className="absolute inset-0 z-40 backdrop-blur-md bg-white/40"></div>}
      {isRestricted && <UpgradePrompt plan="SAPPHIRE" />}

      <div className={`transition-all duration-500 ${isRestricted ? 'blur-sm pointer-events-none grayscale opacity-30 select-none' : ''}`}>
          <div className="flex justify-between items-end mb-10">
            <div>
                <h1 className="text-4xl font-black text-gray-800 tracking-tighter">Clientes y Marketing</h1>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Fidelización y Segmentación CRM</p>
            </div>
            
            <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                <button onClick={() => setMainTab('LIST')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mainTab === 'LIST' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Clientes</button>
                <button onClick={() => setMainTab('MARKETING')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mainTab === 'MARKETING' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Marketing</button>
            </div>
          </div>

          {mainTab === 'LIST' ? (
            <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-8">
                    <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 flex-1 flex gap-4 items-center mr-6">
                        <Search className="text-gray-300" size={24} />
                        <input className="flex-1 outline-none bg-transparent font-bold text-slate-700 placeholder:text-gray-300 text-sm" placeholder="Buscar por CI, nombre o móvil..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsModalOpen(true)} className="bg-brand-600 text-white px-10 py-5 rounded-3xl flex gap-3 items-center hover:bg-brand-700 shadow-xl shadow-brand-100 transition-all font-black uppercase text-xs tracking-widest">
                            <Plus size={20} /> Registrar Cliente
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filteredClients.map((client, index) => {
                        const group = clientGroups.find(g => g.id === client.groupId);
                        const locked = isItemLocked('CLIENTS', index);
                        
                        return (
                        <div key={client.id} className={`bg-white rounded-[3rem] border transition-all overflow-hidden flex flex-col group p-3 relative ${locked ? 'border-amber-200 bg-amber-50/20 opacity-60' : 'border-gray-100 hover:shadow-2xl'}`}>
                            
                            {locked && (
                                <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                                    <div className="bg-amber-500 text-white p-3 rounded-2xl mb-3 shadow-lg"><Lock size={20}/></div>
                                    <p className="font-black text-[10px] uppercase text-amber-600 tracking-widest leading-none">Cliente Bloqueado</p>
                                    <p className="text-[8px] font-bold text-amber-500 mt-2 uppercase tracking-tight">Requiere Plan Sapphire+</p>
                                </div>
                            )}

                            <div className="p-6 flex-1 flex flex-col items-center text-center">
                                <div className="w-24 h-24 rounded-[2rem] bg-gray-50 flex-shrink-0 overflow-hidden mb-5 relative ring-4 ring-white shadow-xl">
                                    {client.photo ? <img src={client.photo} alt={client.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-200 bg-gray-50"><User size={48} /></div>}
                                </div>
                                <h3 className={`font-black text-slate-800 text-lg mb-1 truncate w-full tracking-tighter uppercase ${locked ? 'text-slate-400' : ''}`}>{client.name}</h3>
                                
                                <div className={`w-full py-4 px-5 rounded-[1.8rem] mb-6 ${locked ? 'bg-gray-100' : 'bg-emerald-50'}`}>
                                    <div className={`text-[10px] font-black uppercase tracking-tighter ${locked ? 'text-slate-400' : 'text-emerald-600'}`}>Saldo Disponible</div>
                                    <div className={`font-black text-2xl ${locked ? 'text-slate-300' : 'text-emerald-700'}`}>${client.balance.toFixed(2)}</div>
                                </div>

                                {!locked && (
                                    <button onClick={() => { setEditingClient(client); setIsModalOpen(true); }} className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">Ver Perfil</button>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            </div>
          ) : (
            <div className="animate-in slide-in-from-bottom-6 duration-300">
                 {/* ... Marketing UI ... */}
                 <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 text-center">
                    <Crown size={64} className="mx-auto text-brand-500 mb-6" />
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Panel de Marketing</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Gestione campañas, cupones y segmentación avanzada aquí.</p>
                 </div>
            </div>
          )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                    <h2 className="text-2xl font-black uppercase tracking-tighter">{editingClient.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={24}/></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-32 h-32 rounded-[2.5rem] bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden mb-4 relative group">
                            {editingClient.photo ? <img src={editingClient.photo} alt="Avatar" className="w-full h-full object-cover" /> : <User size={48} className="text-slate-200" />}
                            <label className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                                <Camera className="text-white" size={24} />
                                <input type="file" className="hidden" onChange={handlePhotoChange} />
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Nombre Completo</label>
                            <input className="w-full bg-slate-50 border-none p-5 rounded-2xl font-bold" value={editingClient.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} placeholder="Ej: Juan Pérez" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Teléfono</label>
                            <input className="w-full bg-slate-50 border-none p-5 rounded-2xl font-bold" value={editingClient.phone || ''} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} placeholder="+53 5..." />
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-2xl hover:bg-brand-600 transition-all uppercase tracking-[0.2em] text-xs">Guardar Expediente</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
