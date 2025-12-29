
import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Package, Phone, MapPin, Globe, Sparkles, AlertCircle } from 'lucide-react';
import { Product } from '../types';

export const WebCatalogView: React.FC = () => {
  const { products, businessConfig, setView } = useStore();

  // Filtrar productos marcados para "Catálogo"
  const catalogProducts = useMemo(() => {
    return products.filter(p => !p.hidden && p.categories.includes('Catálogo'));
  }, [products]);

  // Agrupar por categorías (excluyendo la etiqueta "Catálogo")
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    catalogProducts.forEach(p => {
      const otherCats = p.categories.filter(c => c !== 'Catálogo');
      if (otherCats.length === 0) {
        groups['General'] = [...(groups['General'] || []), p];
      } else {
        otherCats.forEach(cat => {
          groups[cat] = [...(groups[cat] || []), p];
        });
      }
    });
    return groups;
  }, [catalogProducts]);

  if (!businessConfig.isWebCatalogActive) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="bg-red-50 p-8 rounded-[3rem] mb-6">
           <AlertCircle size={64} className="text-red-500 mx-auto" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Catálogo No Disponible</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs max-w-sm">
          El servidor de catálogo local ha sido desactivado por el administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-brand-500 selection:text-white">
      {/* HEADER PUBLICO */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 overflow-hidden shadow-xl flex items-center justify-center p-2">
              {businessConfig.logo ? (
                <img src={businessConfig.logo} className="w-full h-full object-contain" alt="Logo" />
              ) : (
                <Globe size={32} className="text-white" />
              )}
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{businessConfig.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Phone size={12}/> {businessConfig.phone}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={12}/> {businessConfig.address}</p>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2 px-6 py-3 bg-brand-50 rounded-2xl border border-brand-100">
             <Sparkles size={16} className="text-brand-500" />
             <span className="text-[10px] font-black text-brand-700 uppercase tracking-[0.2em]">Catálogo Oficial Online</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {catalogProducts.length === 0 ? (
          <div className="py-32 text-center">
            <Package size={80} className="mx-auto text-slate-200 mb-6" />
            <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">Sin productos disponibles</h2>
          </div>
        ) : (
          <div className="space-y-20">
            {Object.entries(groupedProducts).map(([category, items]) => (
              <section key={category} className="animate-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center gap-4 mb-10">
                   <div className="h-1 flex-1 bg-gray-200 rounded-full"></div>
                   <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter px-4">{category}</h2>
                   <div className="h-1 flex-1 bg-gray-200 rounded-full"></div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {items.map(p => (
                    <div key={p.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-100 group hover:shadow-2xl transition-all duration-500">
                      <div className="aspect-square bg-gray-50 relative overflow-hidden">
                        {p.image ? (
                          <img src={p.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={p.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
                            <Package size={64} />
                          </div>
                        )}
                        <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-gray-100">
                           <span className="text-sm font-black text-brand-600">${p.price.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="p-8">
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg leading-tight mb-2 group-hover:text-brand-600 transition-colors">{p.name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponible: {p.stock} Unidades</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-white py-16 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Powered by</p>
          <h2 className="text-3xl font-black tracking-tighter uppercase mb-8">Capibario TPV</h2>
          <div className="max-w-md mx-auto p-6 bg-white/5 rounded-3xl border border-white/5">
             <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
               Este catálogo es generado localmente. Para realizar pedidos, por favor contacte directamente al establecimiento mediante el número de teléfono proporcionado arriba.
             </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
