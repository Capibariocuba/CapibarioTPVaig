
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Package, Phone, MapPin, Globe, Sparkles, AlertCircle, ShoppingBag, Zap, Tag } from 'lucide-react';
import { Product } from '../types';

export const WebCatalogView: React.FC = () => {
  const { products, businessConfig, categories } = useStore();
  const [isTvMode, setIsTvMode] = useState(() => window.location.hash.includes('/tv'));
  const [lastSync, setLastSync] = useState(Date.now());

  // POLLING: Sincronización cada 20s
  useEffect(() => {
    const pollInterval = setInterval(() => setLastSync(Date.now()), 20000);
    const handleHash = () => setIsTvMode(window.location.hash.includes('/tv'));
    window.addEventListener('hashchange', handleHash);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  // APLANADO DE PRODUCTOS Y VARIANTES
  const flattenedItems = useMemo(() => {
    return products
      .filter(p => !p.hidden && p.categories.includes('Catálogo'))
      .flatMap(p => {
        const catLabel = p.categories.find(c => c !== 'Catálogo') || 'General';
        const base = {
          ...p,
          displayName: p.name,
          displayImage: p.image,
          displayPrice: p.price,
          displayStock: p.stock,
          categoryName: catLabel
        };
        const variantItems = (p.variants || []).map(v => ({
          ...p,
          id: v.id,
          displayName: `${p.name} - ${v.name}`,
          displayImage: v.image || p.image,
          displayPrice: v.price,
          displayStock: v.stock,
          categoryName: catLabel
        }));
        return [base, ...variantItems];
      });
  }, [products, lastSync]);

  // ALGORITMO DE MEZCLA PARA TV WALL (4 LANES)
  const lanesData = useMemo(() => {
    if (!isTvMode) return [];
    
    // 1. Agrupar por categoría
    const byCat: Record<string, any[]> = {};
    flattenedItems.forEach(item => {
      if (!byCat[item.categoryName]) byCat[item.categoryName] = [];
      byCat[item.categoryName].push(item);
    });

    const catNames = Object.keys(byCat);
    const lanes: any[][] = [[], [], [], []];

    // 2. Distribuir categorías en lanes (Round Robin)
    catNames.forEach((name, idx) => {
      lanes[idx % 4].push(...byCat[name]);
    });

    // 3. Asegurar que cada lane tenga contenido suficiente para el loop infinito (mínimo 15 items)
    return lanes.map(lane => {
      if (lane.length === 0) return [];
      let buffer = [...lane];
      while (buffer.length < 15) buffer = [...buffer, ...lane];
      return buffer;
    });
  }, [flattenedItems, isTvMode]);

  if (!businessConfig.isWebCatalogActive) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="bg-red-50 p-8 rounded-[3rem] mb-6">
           <AlertCircle size={64} className="text-red-500 mx-auto" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Catálogo Offline</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">El servidor local ha sido pausado.</p>
      </div>
    );
  }

  // --- RENDER MODO TV (TV WALL) ---
  if (isTvMode) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden flex flex-col font-sans select-none">
        <style>{`
          @keyframes scroll-left {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-scroll {
            animation: scroll-left var(--duration) linear infinite;
          }
          .animate-scroll:hover {
            animation-play-state: paused;
          }
        `}</style>

        {/* TV HEADER */}
        <header className="h-[12vh] min-h-[100px] border-b border-white/10 flex items-center justify-between px-10 shrink-0 bg-slate-900/80 backdrop-blur-xl z-20 shadow-2xl">
           <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-xl">
                 <img src={businessConfig.logo || ''} className="w-full h-full object-contain" alt="Logo" />
              </div>
              <div>
                 <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{businessConfig.name}</h1>
                 <p className="text-brand-400 font-black uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
                    <Sparkles size={12}/> Menú Digital Premium
                 </p>
              </div>
           </div>
           <div className="flex items-center gap-4 bg-brand-500/10 border border-brand-500/30 px-6 py-3 rounded-2xl">
              <div className="text-right">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pedidos al</p>
                 <p className="text-2xl font-black text-white tracking-tighter">{businessConfig.phone}</p>
              </div>
              <Phone className="text-brand-500" size={24} />
           </div>
        </header>

        {/* TV BODY (4 LANES) */}
        <main className="flex-1 flex flex-col gap-2 p-2 overflow-hidden">
           {lanesData.map((lane, idx) => (
             <div key={idx} className="flex-1 overflow-hidden relative group">
                {/* Gradientes laterales para suavizar entrada/salida */}
                <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-slate-950 to-transparent z-10" />
                <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-slate-950 to-transparent z-10" />
                
                <div 
                  className="flex gap-4 animate-scroll h-full py-1"
                  style={{ 
                    '--duration': `${25 + (idx * 5)}s`,
                    flexWrap: 'nowrap'
                  } as any}
                >
                   {/* Renderizamos el contenido doble para el loop infinito suave */}
                   {[...lane, ...lane].map((item, i) => (
                     <div 
                      key={`${item.id}-${i}`} 
                      className={`flex-shrink-0 w-[280px] h-full bg-slate-900/50 rounded-3xl border border-white/5 p-2 flex flex-col relative overflow-hidden transition-all ${item.displayStock <= 0 ? 'grayscale opacity-40' : ''}`}
                     >
                        {/* Categoría Badge */}
                        <div className="absolute top-4 left-4 z-10">
                           <span className="px-3 py-1 bg-slate-800/90 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-widest text-brand-400 border border-brand-500/20 flex items-center gap-1 shadow-lg">
                              <Tag size={10} /> {item.categoryName}
                           </span>
                        </div>

                        <div className="flex-1 rounded-2xl overflow-hidden bg-slate-800 relative">
                           {item.displayImage ? (
                             <img src={item.displayImage} className="w-full h-full object-cover" alt={item.displayName} />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-slate-700">
                                <Package size={48} className="opacity-20" />
                             </div>
                           )}
                           
                           {/* Precio Overlay */}
                           <div className="absolute bottom-2 right-2">
                              <div className="bg-brand-600 px-4 py-2 rounded-xl shadow-2xl border border-white/20">
                                 <span className="text-xl font-black text-white tracking-tighter">${item.displayPrice.toFixed(2)}</span>
                              </div>
                           </div>
                        </div>

                        <div className="h-14 flex items-center px-2">
                           <h3 className="text-sm font-black uppercase tracking-tighter leading-tight line-clamp-2 text-slate-200">
                              {item.displayName}
                           </h3>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           ))}
        </main>

        {/* PIE DE MARQUESINA (Opcional) */}
        <footer className="h-8 bg-brand-600 flex items-center overflow-hidden shrink-0">
           <div className="flex whitespace-nowrap animate-scroll" style={{ '--duration': '40s' } as any}>
              {[1, 2].map(i => (
                <span key={i} className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-950 px-10">
                   {businessConfig.footerMessage} • PRECIOS SUJETOS A DISPONIBILIDAD • ABIERTO TODOS LOS DÍAS • CAPIBARIO DIGITAL SIGNAGE • GRACIAS POR SU PREFERENCIA
                </span>
              ))}
           </div>
        </footer>
      </div>
    );
  }

  // --- RENDER MODO MÓVIL (Sigue igual para no romper compatibilidad) ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 overflow-hidden shadow-lg flex items-center justify-center p-1.5 shrink-0">
              {businessConfig.logo ? <img src={businessConfig.logo} className="w-full h-full object-contain" alt="Logo" /> : <ShoppingBag size={24} className="text-white" />}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight">{businessConfig.name}</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><Phone size={10} className="inline mr-1"/> {businessConfig.phone}</p>
            </div>
          </div>
          <div className="bg-brand-50 px-4 py-2 rounded-xl border border-brand-100 hidden sm:flex items-center gap-2">
             <Sparkles size={14} className="text-brand-500" />
             <span className="text-[9px] font-black text-brand-700 uppercase tracking-[0.2em]">Menú Online</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12">
        <div className="space-y-16">
          {categories.filter(c => c.name !== 'Catálogo').map(cat => {
            const catProducts = flattenedItems.filter(p => p.categoryName === cat.name);
            if (catProducts.length === 0) return null;
            return (
              <section key={cat.id}>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-8 pl-4 border-l-8 border-brand-500">{cat.name}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {catProducts.map(item => (
                    <div key={item.id + item.displayName} className={`bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-100 flex flex-col ${item.displayStock <= 0 ? 'grayscale opacity-50' : ''}`}>
                      <div className="aspect-square bg-gray-100 relative overflow-hidden">
                        {item.displayImage ? <img src={item.displayImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={64}/></div>}
                        <div className="absolute bottom-4 left-4 right-4">
                           <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl flex justify-between items-center border border-white/50">
                              <span className="text-[10px] font-black text-slate-400 uppercase">Precio</span>
                              <span className="text-xl font-black text-brand-600">${item.displayPrice.toFixed(2)}</span>
                           </div>
                        </div>
                      </div>
                      <div className="p-6 flex-1 flex flex-col justify-center">
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg leading-tight line-clamp-2">{item.displayName}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
};
