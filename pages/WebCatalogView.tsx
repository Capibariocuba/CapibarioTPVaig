
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Package, Phone, MapPin, Globe, Sparkles, AlertCircle, ShoppingBag, ChevronRight } from 'lucide-react';
import { Product } from '../types';

export const WebCatalogView: React.FC = () => {
  const { products, businessConfig } = useStore();
  const [isTvMode, setIsTvMode] = useState(() => window.location.hash.includes('/tv'));
  const [lastSync, setLastSync] = useState(Date.now());

  // Fix: marquee is deprecated and not in JSX.IntrinsicElements. Use a casted reference to bypass type checking.
  const Marquee = 'marquee' as any;

  // POLLING: Actualizar estado cada 15s (Simulado mediante re-render si hay cambios en store)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      setLastSync(Date.now());
    }, 15000);
    
    const handleHash = () => setIsTvMode(window.location.hash.includes('/tv'));
    window.addEventListener('hashchange', handleHash);
    
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  // APLANADO DE VARIANTES (Regla innegociable)
  const flattenedProducts = useMemo(() => {
    return products
      .filter(p => !p.hidden && p.categories.includes('Catálogo'))
      .flatMap(p => {
        const baseProduct = {
          ...p,
          displayName: p.name,
          displayImage: p.image,
          displayPrice: p.price,
          displayStock: p.stock
        };
        
        const variantItems = (p.variants || []).map(v => ({
          ...p,
          id: v.id,
          displayName: `${p.name} - ${v.name}`,
          displayImage: v.image || p.image,
          displayPrice: v.price,
          displayStock: v.stock
        }));

        return [baseProduct, ...variantItems];
      });
  }, [products, lastSync]);

  // AGRUPACIÓN POR CATEGORÍA
  const groupedData = useMemo(() => {
    const groups: Record<string, any[]> = {};
    flattenedProducts.forEach(item => {
      const otherCats = item.categories.filter(c => c !== 'Catálogo');
      const catKey = otherCats[0] || 'General';
      groups[catKey] = [...(groups[catKey] || []), item];
    });
    return Object.entries(groups).map(([name, items]) => ({ name, items }));
  }, [flattenedProducts]);

  // --- LÓGICA DE ROTACIÓN TV ---
  const [catIndex, setCatIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const itemsPerPage = 8; // Ajustado para grid 4x2 en TV

  useEffect(() => {
    if (!isTvMode || groupedData.length === 0) return;

    const rotationInterval = setInterval(() => {
      const currentCat = groupedData[catIndex];
      const totalPages = Math.ceil(currentCat.items.length / itemsPerPage);

      if (pageIndex < totalPages - 1) {
        setPageIndex(prev => prev + 1);
      } else {
        setPageIndex(0);
        setCatIndex(prev => (prev + 1) % groupedData.length);
      }
    }, 10000); // 10 segundos por pantalla

    return () => clearInterval(rotationInterval);
  }, [isTvMode, catIndex, pageIndex, groupedData]);

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

  // --- RENDER MODO TV (Opción A) ---
  if (isTvMode) {
    const currentCategory = groupedData[catIndex] || { name: '...', items: [] };
    const pagedItems = currentCategory.items.slice(pageIndex * itemsPerPage, (pageIndex * itemsPerPage) + itemsPerPage);
    const totalPages = Math.ceil(currentCategory.items.length / itemsPerPage);

    return (
      <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden flex flex-col font-sans select-none">
        {/* TV HEADER */}
        <header className="h-[15vh] border-b border-white/10 flex items-center justify-between px-12 shrink-0 bg-slate-900/50 backdrop-blur-md">
           <div className="flex items-center gap-8">
              <div className="w-20 h-20 rounded-3xl bg-white p-2 shadow-2xl">
                 <img src={businessConfig.logo || ''} className="w-full h-full object-contain" alt="Logo" />
              </div>
              <div>
                 <h1 className="text-4xl font-black uppercase tracking-tighter">{businessConfig.name}</h1>
                 <p className="text-brand-400 font-black uppercase tracking-[0.3em] text-xs mt-1">Menú Digital Autogestionado</p>
              </div>
           </div>
           <div className="text-right">
              <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Pedidos a domicilio</p>
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                 <Phone className="text-brand-500" size={24} />
                 <span className="text-3xl font-black tracking-tighter text-white">{businessConfig.phone}</span>
              </div>
           </div>
        </header>

        {/* TV BODY */}
        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR CATEGORÍAS */}
          <aside className="w-1/4 border-r border-white/5 bg-slate-900/20 p-8 flex flex-col gap-4">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Nuestras Secciones</p>
             {groupedData.map((cat, idx) => (
               <div key={cat.name} className={`p-6 rounded-[2rem] transition-all duration-700 flex items-center justify-between ${idx === catIndex ? 'bg-brand-600 text-white shadow-2xl scale-105 border-l-8 border-white' : 'bg-white/5 text-slate-500 opacity-40'}`}>
                  <span className="text-xl font-black uppercase tracking-tighter">{cat.name}</span>
                  {idx === catIndex && <ChevronRight size={24} className="animate-pulse" />}
               </div>
             ))}
          </aside>

          {/* GRID DE PRODUCTOS */}
          <main className="flex-1 p-10 relative">
             {/* Indicador de Paginación */}
             {totalPages > 1 && (
               <div className="absolute top-4 right-10 flex gap-2">
                  {[...Array(totalPages)].map((_, i) => (
                    <div key={i} className={`h-2 rounded-full transition-all duration-500 ${i === pageIndex ? 'w-12 bg-brand-500' : 'w-2 bg-white/20'}`} />
                  ))}
               </div>
             )}

             <div className="grid grid-cols-4 gap-8 h-full">
                {pagedItems.map(item => (
                  <div key={item.id + item.displayName} className={`bg-white/5 rounded-[3rem] border border-white/10 p-2 flex flex-col transition-all duration-1000 animate-in fade-in zoom-in ${item.displayStock <= 0 ? 'grayscale opacity-30' : ''}`}>
                     <div className="aspect-[4/3] rounded-[2.5rem] overflow-hidden bg-slate-800 relative">
                        {item.displayImage ? (
                          <img src={item.displayImage} className="w-full h-full object-cover" alt={item.displayName} />
                        ) : (
                          <Package className="w-full h-full p-12 text-slate-700 opacity-20" />
                        )}
                        <div className="absolute bottom-4 right-4 bg-brand-600 px-6 py-2 rounded-2xl shadow-2xl border border-white/20">
                           <span className="text-2xl font-black text-white">${item.displayPrice.toFixed(2)}</span>
                        </div>
                     </div>
                     <div className="p-6 flex-1 flex flex-col justify-center">
                        <h3 className="text-xl font-black uppercase tracking-tighter leading-tight line-clamp-2 text-center">{item.displayName}</h3>
                     </div>
                  </div>
                ))}
                {/* Rellenar espacios vacíos si hay pocos productos para mantener layout grande */}
                {pagedItems.length < itemsPerPage && [...Array(itemsPerPage - pagedItems.length)].map((_, i) => (
                  <div key={`empty-${i}`} className="bg-white/[0.02] border border-dashed border-white/5 rounded-[3rem]" />
                ))}
             </div>
          </main>
        </div>

        {/* TV FOOTER (Información Legal/Firma) */}
        <footer className="h-10 bg-brand-600 flex items-center px-12 shrink-0">
            {/* Fix: Use the casted Marquee component to avoid TypeScript errors with the legacy tag */}
            <Marquee className="text-[10px] font-black uppercase tracking-widest text-slate-950">
              {businessConfig.footerMessage} • PRECIOS SUJETOS A CAMBIO SIN PREVIO AVISO • MENÚ DIGITAL POWERED BY CAPIBARIO TPV • DISFRUTE SU ESTANCIA
            </Marquee>
        </footer>
      </div>
    );
  }

  // --- RENDER MODO MÓVIL (Existente, optimizado levemente) ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-brand-500 selection:text-white pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 overflow-hidden shadow-lg flex items-center justify-center p-1.5 shrink-0">
              {businessConfig.logo ? (
                <img src={businessConfig.logo} className="w-full h-full object-contain" alt="Logo" />
              ) : (
                <ShoppingBag size={24} className="text-white" />
              )}
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight">{businessConfig.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-0.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Phone size={10}/> {businessConfig.phone}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={10}/> {businessConfig.address.substring(0, 30)}</p>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2 px-5 py-2 bg-brand-50 rounded-xl border border-brand-100">
             <Sparkles size={14} className="text-brand-500" />
             <span className="text-[9px] font-black text-brand-700 uppercase tracking-[0.2em]">Menú Digital Online</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12">
        {flattenedProducts.length === 0 ? (
          <div className="py-32 text-center bg-white rounded-[4rem] border border-dashed border-gray-200">
            <Package size={80} className="mx-auto text-slate-200 mb-6" />
            <h2 className="text-xl font-black text-slate-300 uppercase tracking-widest">Catálogo vacío</h2>
          </div>
        ) : (
          <div className="space-y-20">
            {groupedData.map(group => (
              <section key={group.name} className="animate-in slide-in-from-bottom-8">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-8 px-2 border-l-8 border-brand-500 pl-6">{group.name}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {group.items.map(item => (
                    <div key={item.id + item.displayName} className={`bg-white rounded-[3rem] overflow-hidden shadow-sm border border-gray-100 group transition-all duration-500 ${item.displayStock <= 0 ? 'grayscale opacity-50' : 'hover:shadow-2xl'}`}>
                      <div className="aspect-[4/5] bg-gray-100 relative overflow-hidden">
                        {item.displayImage ? (
                          <img src={item.displayImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.displayName} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={64} className="opacity-20" /></div>
                        )}
                        <div className="absolute bottom-6 left-6 right-6">
                           <div className="bg-white/90 backdrop-blur-xl px-6 py-4 rounded-[2rem] shadow-2xl border border-white/20 flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio</span>
                              <span className="text-xl font-black text-brand-600 tracking-tighter">${item.displayPrice.toFixed(2)}</span>
                           </div>
                        </div>
                      </div>
                      <div className="p-8">
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg leading-tight group-hover:text-brand-600 transition-colors line-clamp-2">{item.displayName}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
