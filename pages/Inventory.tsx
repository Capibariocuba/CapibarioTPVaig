import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Warehouse } from '../types';
import { Plus, MapPin, Lock, X, AlertTriangle } from 'lucide-react';

export const Inventory: React.FC = () => {
  const { warehouses, addWarehouse, deleteWarehouse, isItemLocked } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState<Partial<Warehouse>>({});

  const handleAdd = () => {
    try {
      addWarehouse({ 
        ...newWarehouse, 
        id: Math.random().toString(36).substr(2, 9) 
      } as Warehouse);
      setNewWarehouse({});
      setIsModalOpen(false);
    } catch (e) {
      // Notificado vía StoreContext UX
    }
  };

  return (
    <div className="p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Inventario Maestro</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Multi-depósito & Stock Control</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white px-8 py-4 rounded-3xl font-black flex items-center gap-3 shadow-2xl hover:bg-brand-600 transition-all uppercase text-[10px] tracking-widest">
            <Plus size={18} /> Nuevo Almacén
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {warehouses.map((w, index) => {
          const locked = isItemLocked('WAREHOUSES', index);
          
          return (
            <div key={w.id} className={`relative bg-white p-8 rounded-[3rem] border-2 transition-all overflow-hidden ${locked ? 'border-amber-200 bg-amber-50/10 grayscale-[0.5]' : 'border-gray-100 hover:border-brand-500 shadow-sm'}`}>
              
              {locked && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] rounded-[3rem] flex flex-col items-center justify-center p-8 text-center z-10 animate-in fade-in duration-700">
                  <div className="bg-amber-500 text-white p-4 rounded-[1.5rem] mb-4 shadow-xl"><Lock size={24}/></div>
                  <p className="font-black text-xs uppercase text-amber-600 tracking-widest">Almacén Bloqueado</p>
                  <p className="text-[10px] font-bold text-amber-500 mt-2 leading-tight">Este depósito supera el límite de tu plan actual. Los productos aquí no pueden venderse.</p>
                </div>
              )}
              
              <div className="flex items-start justify-between mb-6">
                <div className={`p-5 rounded-[1.5rem] ${locked ? 'bg-amber-100 text-amber-400' : 'bg-slate-50 text-slate-400'}`}>
                    <MapPin size={32} />
                </div>
                {!locked && (
                    <button onClick={() => deleteWarehouse(w.id)} className="text-red-200 hover:text-red-500 transition-colors p-2">
                        <X size={24}/>
                    </button>
                )}
              </div>
              <h3 className={`text-2xl font-black tracking-tighter uppercase ${locked ? 'text-slate-400' : 'text-slate-800'}`}>{w.name}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{w.location}</p>
              
              <div className="mt-8 pt-6 border-t border-dashed border-gray-100 flex justify-between items-center">
                 <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Estatus</span>
                 {locked ? (
                    <span className="text-[9px] font-black text-amber-500 uppercase flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full"><AlertTriangle size={12}/> Inactivo</span>
                 ) : (
                    <span className="text-[9px] font-black text-emerald-500 uppercase bg-emerald-50 px-3 py-1 rounded-full">Operativo</span>
                 )}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter uppercase">Nuevo Depósito</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Expanda su red de distribución</p>
            <div className="space-y-4">
              <input 
                className="w-full bg-slate-50 border-none p-6 rounded-3xl font-bold outline-none focus:ring-4 focus:ring-brand-500/20" 
                placeholder="Nombre (Bodega Central)" 
                onChange={e => setNewWarehouse({...newWarehouse, name: e.target.value})} 
              />
              <input 
                className="w-full bg-slate-50 border-none p-6 rounded-3xl font-bold outline-none focus:ring-4 focus:ring-brand-500/20" 
                placeholder="Ubicación Física" 
                onChange={e => setNewWarehouse({...newWarehouse, location: e.target.value})} 
              />
              <button onClick={handleAdd} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl mt-6 shadow-2xl hover:bg-brand-600 transition-all uppercase tracking-widest text-xs">Registrar Almacén</button>
              <button onClick={() => setIsModalOpen(false)} className="w-full text-slate-400 font-black py-4 uppercase tracking-widest text-[10px]">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
