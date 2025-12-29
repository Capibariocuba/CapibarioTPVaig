
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Package, Phone, MapPin, Globe, Sparkles, AlertCircle, ShoppingBag, ChevronRight } from 'lucide-react';
import { Product } from '../types';

export const WebCatalogView: React.FC = () => {
  const { products, businessConfig } = useStore();
  const [isTvMode, setIsTvMode] = useState(() => window.location.hash.includes('/tv'));
  const [lastSync, setLastSync] = useState(Date.now());

  const Marquee = 'marquee' as any;

  // POLLING: Sincronización de datos cada 20s
  useEffect(() => {
    const pollInterval = setInterval(() => setLastSync(Date.now()), 20000);
    const handleHash = () => setIsTvMode(window.location.hash.includes('/tv'));
    window.addEventListener('hashchange', handleHash);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  // APLANADO DE VARIANTES (Regla innegociable: items independientes)
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

  // AGRUPACIÓN POR CATEGORÍA (Para el Rail Lateral)
  const groupedData = useMemo(() => {
    const groups: Record<string, any[]> = {};
    flattenedProducts.forEach(item => {
      const otherCats = item.categories.filter(c => c !== 'Catálogo');
      const catKey = otherCats[0] || 'General';
      groups[catKey] = [...(groups[catKey] || []), item];
    });
    return Object.entries(groups)
      .map(([name, items]) => ({ name, items }))
      .filter(g => g.items.length > 0);
  }, [flattenedProducts]);

  // --- LÓGICA DE ROTACIÓN TV (SIN SCROLL) ---
  const [catIndex, setCatIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  
  // Grid dinámico: 4 columnas x 2 filas es ideal para legibilidad en Smart TV
  const cols = 4;
  const rows = 2;
  const itemsPerPage = cols * rows;

  useEffect(() => {
    if (!isTvMode || groupedData.length === 0) return;

    const rotationInterval = setInterval(() => {
      const currentCat = groupedData[catIndex];
      const totalPages = Math.ceil(currentCat.items.length / itemsPerPage);

      if (pageIndex < totalPages - 1) {
        // Siguiente página de la misma categoría
        setPageIndex(prev => prev + 1);
      } else {
        // Siguiente categoría
        setPageIndex(0);
        setCatIndex(prev => (prev + 1) % groupedData.length);
      }
    }, 10000); // 10 segundos por pantalla

    return () => clearInterval(rotationInterval);
  }, [isTvMode, catIndex, pageIndex, groupedData, itemsPerPage]);

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

  // --- RENDER MODO TV: FULLSCREEN BOARD ---
  if (isTvMode) {
    const currentCategory = groupedData[catIndex] || { name: 'Cargando...', items: [] };
    const totalPages = Math.ceil(currentCategory.items.length / itemsPerPage);
    const pagedItems = currentCategory.items.slice(pageIndex * itemsPerPage, (pageIndex * itemsPerPage) + itemsPerPage);

    return (
      <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden flex flex-col font-sans select-none border-[12px] border-slate-900">
        
        {/* TV HEADER (15% Alto aprox) */}
        <header className="h-[15vh] flex items-center justify-between px-10 shrink-0 bg-slate-900 border-b border-white/5 shadow-2xl">
           <div className="flex items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-white p-3 shadow-2xl flex items-center justify-center">
                 <img src={businessConfig.logo || ''} className="max-w-full max-h-full object-contain" alt="Logo" />
              </div>
              <div>
                 <h1 className="text-5xl font-black uppercase tracking-tighter text-white">{businessConfig.name}</h1>
                 <p className="text-brand-400 font-black uppercase tracking-[0.4em] text-xs mt-1">Digital Signage Menu System</p>
              </div>
           </div>
           <div className="flex items-center gap-6">
              <div className="text-right">
                 <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] mb-1">Pedidos a domicilio</p>
                 <div className="bg-brand-500/10 border border-brand-500/30 px-6 py-3 rounded-2xl flex items-center gap-4">
                    <Phone className="text-brand-500" size={24} />
                    <span className="text-4xl font-black tracking-tight text-white">{businessConfig.phone}</span>
                 </div>
              </div>
           </div>
        </header>

        {/* TV BODY (Resto de pantalla) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* CATEGORY RAIL (Barra Lateral Izquierda) */}
          <aside className="w-[22vw] bg-slate-900/40 border-r border-white/5 p-6 flex flex-col gap-3">
             <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] mb-4 px-4">Categorías</p>
             {groupedData.map((cat, idx) => (
               <div 
                key={cat.name} 
                className={`p-6 rounded-[2.5rem] transition-all duration-500 flex items-center justify-between border-2 ${
                  idx === catIndex 
                  ? 'bg-brand-600 border-brand-400 text-white shadow-[0_0_40px_-10px_rgba(14,165,233,0.5)] scale-105 z-10' 
                  : 'bg-white/5 border-transparent text-slate-500 opacity-40'
                }`}
               >
                  <span className="text-xl font-black uppercase tracking-tight truncate">{cat.name}</span>
                  {idx === catIndex && <ChevronRight size={28} className="animate-pulse" />}
               </div>
             ))}
          </aside>

          {/* PRODUCT BOARD (Panel Principal) */}
          <main className="flex-1 p-8 flex flex-col relative bg-slate-950">
             
             {/* Indicadores de Posición */}
             <div className="absolute bottom-6 right-10 flex flex-col items-end gap-2 z-20">
                <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sección {catIndex + 1}/{groupedData.length}</span>
                   <div className="w-1 h-4 bg-white/10 rounded-full" />
                   <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Pág {pageIndex + 1}/{totalPages}</span>
                </div>
             </div>

             {/* GRID DE PRODUCTOS: Se adapta para ocupar todo el espacio disponible */}
             <div className="grid grid-cols-4 grid-rows-2 gap-6 h-full w-full">
                {pagedItems.map(item => (
                  <div 
                    key={item.id + item.displayName} 
                    className={`bg-white/5 rounded-[3.5rem] border border-white/10 p-3 flex flex-col transition-all duration-700 animate-in fade-in zoom-in-95 ${
                      item.displayStock <= 0 ? 'grayscale opacity-30' : ''
                    }`}
                  >
                     <div className="relative flex-1 rounded-[2.8rem] overflow-hidden bg-slate-900/50 shadow-inner">
                        {item.displayImage ? (
                          <img src={item.displayImage} className="w-full h-full object-cover" alt={item.displayName} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-1/3 h-1/3 text-slate-800" />
                          </div>
                        )}
                        
                        {/* Precio Legible TV */}
                        <div className="absolute bottom-4 left-4 right-4">
                           <div className="bg-brand-600 text-white px-6 py-4 rounded-[2rem] shadow-2xl border border-white/20 flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase opacity-70">Precio</span>
                              <span className="text-3xl font-black tracking-tighter">${item.displayPrice.toFixed(2)}</span>
                           </div>
                        </div>
                     </div>
                     <div className="h-[100px] flex items-center justify-center px-6">
                        <h3 className="text-2xl font-black uppercase tracking-tighter leading-tight text-center line-clamp-2 text-white/90">
                          {item.displayName}
                        </h3>
                     </div>
                  </div>
                ))}

                {/* Slots vacíos para mantener estructura si hay pocos productos */}
                {pagedItems.length < itemsPerPage && [...Array(itemsPerPage - pagedItems.length)].map((_, i) => (
                  <div key={`empty-${i}`} className="bg-white/[0.02] border-2 border-dashed border-white/5 rounded-[3.5rem] flex flex-col items-center justify-center opacity-20">
                     <ShoppingBag size={48} className="text-slate-800" />
                  </div>
                ))}
             </div>
          </main>
        </div>

        {/* TV FOOTER (Barra Informativa) */}
        <footer className="h-12 bg-brand-600 flex items-center px-10 shrink-0 shadow-[0_-10px_40px_rgba(14,165,233,0.2)]">
            <Marquee className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">
              {businessConfig.footerMessage} • {(businessConfig.address || '').toUpperCase()} • ABIERTO AHORA • MENÚ DIGITAL POWERED BY CAPIBARIO TPV • EXPERIENCIA GASTRONÓMICA PREMIUM • GRACIAS POR SU PREFERENCIA
            </Marquee>
        </footer>
      </div>
    );
  }

  // --- RENDER MODO MÓVIL (Existente, optimizado) ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-brand-500 selection:text-white pb-20 overflow-x-hidden">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 overflow-hidden shadow-xl flex items-center justify-center p-2">
              {businessConfig.logo ? (
                <img src={businessConfig.logo} className="w-full h-full object-contain" alt="Logo" />
              ) : (
                <ShoppingBag size={28} className="text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight">{businessConfig.name}</h1>
              <div className="flex flex-wrap gap-4 mt-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Phone size={12}/> {businessConfig.phone}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={12}/> {businessConfig.address.substring(0, 35)}...</p>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2 px-6 py-2.5 bg-brand-50 rounded-2xl border border-brand-100 shadow-sm">
             <Sparkles size={16} className="text-brand-500" />
             <span className="text-[10px] font-black text-brand-700 uppercase tracking-[0.2em]">Catálogo Digital</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12">
        {groupedData.length === 0 ? (
          <div className="py-40 text-center bg-white rounded-[4rem] border border-dashed border-gray-200 shadow-inner">
            <Package size={80} className="mx-auto text-slate-100 mb-6" />
            <h2 className="text-xl font-black text-slate-300 uppercase tracking-widest">Inventario en actualización</h2>
          </div>
        ) : (
          <div className="space-y-24">
            {groupedData.map(group => (
              <section key={group.name} className="animate-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center gap-4 mb-10">
                  <div className="h-10 w-2 bg-brand-500 rounded-full" />
                  <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{group.name}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                  {group.items.map(item => (
                    <div key={item.id + item.displayName} className={`bg-white rounded-[3.5rem] overflow-hidden shadow-sm border border-gray-100 group transition-all duration-500 ${item.displayStock <= 0 ? 'grayscale opacity-50' : 'hover:shadow-2xl hover:-translate-y-2'}`}>
                      <div className="aspect-[4/5] bg-gray-50 relative overflow-hidden">
                        {item.displayImage ? (
                          <img src={item.displayImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.displayName} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={80} className="opacity-20" /></div>
                        )}
                        <div className="absolute bottom-6 left-6 right-6">
                           <div className="bg-white/90 backdrop-blur-xl px-7 py-5 rounded-[2.5rem] shadow-2xl border border-white/20 flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio</span>
                              <span className="text-2xl font-black text-brand-600 tracking-tighter">${item.displayPrice.toFixed(2)}</span>
                           </div>
                        </div>
                      </div>
                      <div className="p-10">
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-xl leading-tight group-hover:text-brand-600 transition-colors line-clamp-2">{item.displayName}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      
      <footer className="mt-32 py-20 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
           <div className="inline-flex p-4 bg-slate-50 rounded-3xl mb-6">
              <Globe className="text-slate-300" size={32} />
           </div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">Capibario Digital Ecosystem</p>
           <h4 className="text-slate-900 font-black text-lg uppercase tracking-tight">Cerrar Sesión para Volver al TPV</h4>
        </div>
      </footer>
    </div>
  );
};
