
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Calendar, User, Tag, DollarSign, Crown, MessageCircle } from 'lucide-react';

export const Ledger: React.FC = () => {
  const { ledger, businessConfig } = useStore();
  const [search, setSearch] = useState('');

  const isPlatinum = businessConfig.license?.tier === 'PLATINUM';

  const filteredLedger = ledger.filter(entry => 
    entry.description.toLowerCase().includes(search.toLowerCase()) ||
    entry.userName.toLowerCase().includes(search.toLowerCase())
  ).reverse();

  return (
    <div className="p-4 md:p-6 bg-gray-50 h-full overflow-y-auto">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter">Libro de Auditoría</h1>
            <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest">Registro Inmutable de Operaciones</p>
        </div>
        {!isPlatinum && (
            <div className="w-full md:w-auto bg-amber-50 border border-amber-200 p-3 md:p-4 rounded-2xl flex items-center gap-3 md:gap-4 animate-in slide-in-from-right duration-500 shadow-sm">
                <div className="bg-amber-500 text-white p-2 rounded-xl flex-shrink-0"><Crown size={16}/></div>
                <div className="flex-1">
                    <p className="text-[9px] md:text-[10px] font-black text-amber-800 uppercase tracking-tighter">Auditoría Limitada (5 días)</p>
                    <p className="text-[8px] md:text-[9px] text-amber-600 font-bold uppercase">Plan PLATINUM para historial full</p>
                </div>
                <a href="https://wa.me/5350019541" target="_blank" className="p-2 bg-white text-emerald-500 rounded-xl hover:bg-emerald-50 transition-colors shadow-sm flex-shrink-0"><MessageCircle size={20}/></a>
            </div>
        )}
      </div>

      <div className="bg-white p-3 md:p-4 rounded-[1.5rem] md:rounded-3xl shadow-sm border border-gray-100 mb-6 flex gap-4">
        <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 text-gray-300" size={18} />
            <input className="w-full bg-gray-50 border-none p-4 pl-12 rounded-2xl font-bold text-slate-700 outline-none text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden relative">
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[750px]">
              <thead className="bg-gray-50 text-[8px] md:text-[10px] font-black uppercase text-gray-400">
                <tr>
                  <th className="p-4 md:p-6">Fecha / Hora</th>
                  <th className="p-4 md:p-6">Operación</th>
                  <th className="p-4 md:p-6">Descripción</th>
                  <th className="p-4 md:p-6">Método</th>
                  <th className="p-4 md:p-6 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLedger.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4 md:p-6">
                        <div className="text-xs md:text-sm font-black text-slate-800">{new Date(entry.timestamp).toLocaleDateString()}</div>
                        <div className="text-[9px] md:text-[10px] font-bold text-gray-400">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                    </td>
                    <td className="p-4 md:p-6">
                        <span className={`px-2 md:px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase flex items-center gap-1 w-fit ${entry.direction === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {entry.direction === 'IN' ? <ArrowDownLeft size={10}/> : <ArrowUpRight size={10}/>}
                            {entry.type}
                        </span>
                    </td>
                    <td className="p-4 md:p-6">
                        <div className="text-xs md:text-sm font-bold text-slate-700">{entry.description}</div>
                        <div className="flex items-center gap-1 text-[8px] md:text-[10px] text-gray-400 font-black uppercase tracking-tighter"><User size={10}/> {entry.userName}</div>
                    </td>
                    <td className="p-4 md:p-6">
                        <span className="bg-gray-100 text-gray-600 px-2 md:px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase">{entry.paymentMethod}</span>
                    </td>
                    <td className={`p-4 md:p-6 text-right font-black text-base md:text-lg tracking-tighter ${entry.direction === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {entry.direction === 'IN' ? '+' : '-'}${entry.amount.toFixed(2)} <span className="text-[8px] md:text-[10px]">{entry.currency}</span>
                    </td>
                  </tr>
                ))}
                {filteredLedger.length === 0 && (
                    <tr>
                        <td colSpan={5} className="p-10 md:p-20 text-center text-gray-300 font-black uppercase text-[10px] md:text-xs">Sin registros</td>
                    </tr>
                )}
              </tbody>
            </table>
        </div>
        
        {!isPlatinum && (
            <div className="absolute bottom-0 inset-x-0 h-32 md:h-40 bg-gradient-to-t from-white via-white/90 to-transparent flex flex-col items-center justify-end pb-6 md:pb-10 px-4 text-center">
                <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 md:mb-4">Datos antiguos ocultos</p>
                <a href="https://wa.me/5350019541" target="_blank" className="bg-slate-900 text-white px-6 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2">Desbloquear Historial Full <Crown size={12} className="text-brand-500" /></a>
            </div>
        )}
      </div>
    </div>
  );
};
