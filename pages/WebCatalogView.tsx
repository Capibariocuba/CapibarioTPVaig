
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { Package, Phone, MapPin, Sparkles, AlertCircle, ShoppingBag, Zap, Tag, Clock, UtensilsCrossed } from 'lucide-react';
import { Product } from '../types';

// CONFIGURACIÓN DE ROTACIÓN
const SLIDE_DURATION = 8000; // 8 segundos por página
const ITEMS_PER_PAGE_TV = 48; // 12 columnas x 4 filas aprox.

export const WebCatalogView: React.FC = () => {
  const { products, businessConfig, categories } = useStore();
  const [isTvMode, setIsTvMode] = useState(() => window.location.hash.includes('/tv'));
  
  // ESTADOS DE ROTACIÓN
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const handleHash = () => setIsTvMode(window.location.hash.includes('/tv'));
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // 1. PREPARACIÓN DE DATOS: Aplanado y Filtrado
  const catalogItems = useMemo(() => {
    return products
      .filter(p => !p.hidden && p.categories.includes('Catálogo'))
      .flatMap(p => {
        const catLabel = p.categories.find(c => c !== 'Catálogo') || 'General';
        const base = {
          id: p.id,
          displayName: p.name,
          displayImage: p.image,
          displayPrice: p.price,
          displayStock: p.stock,
          categoryName: catLabel,
          isVariant: false
        };
        const variantItems = (p.variants || []).map(v => ({
          id: v.id,
          displayName: `${p.name} - ${v.name}`,
          displayImage: v.image || p.image,
          displayPrice: v.price,
          displayStock: v.stock,
          categoryName: catLabel,
          isVariant: true
        }));
        return [base, ...variantItems];
      });
  }, [products]);

  // 2. LÓGICA DE CHUNKING (Paginación por Categoría)
  const slides = useMemo(() => {
    const grouped: { cat: string; items: any[] }[] = [];
    
    // Agrupar por categoría
    categories.filter(c => c.name !== 'Catálogo').forEach(cat => {
      const items = catalogItems.filter(i => i.categoryName === cat.name);
      if (items.length > 0) {
        // Dividir los ítems de la categoría en páginas de N
        for (let i = 0; i < items.length; i += ITEMS_PER_PAGE_TV) {
          grouped.push({
            cat: cat.name,
            items: items.slice(i, i + ITEMS_PER_PAGE_TV)
          });
        }
      }
    });

    return grouped;
  }, [catalogItems, categories]);

  // 3. HOOK DE ROTACIÓN AUTOMÁTICA
  useEffect(() => {
    if (!isTvMode || slides.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentSlideIndex(prev => (prev + 1) % slides.length);
        setIsTransitioning(false);
      }, 500); // Duración de la animación de salida
    }, SLIDE_DURATION);

    return () => clearInterval(interval);
  }, [isTvMode, slides.length]);

  if (!businessConfig.isWebCatalogActive) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="bg-red-50 p-8 rounded-[3rem] mb-6">
           <AlertCircle size={64} className="text-red-500 mx-auto" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Catálogo Offline</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">El servidor local ha sido pausado por el administrador.</p>
      </div>
    );
  }

  // --- RENDER MODO TV (HIGH DENSITY / NO SCROLL) ---
  if (isTvMode) {
    const currentSlide = slides[currentSlideIndex] || { cat: 'Menú', items: [] };

    return (
      <div className="h-screen w-screen bg-black text-white overflow-hidden flex flex-col font-sans select-none">
        {/* BARRA DE PROGRESO SUPERIOR */}
        <div className="h-1.5 w-full bg-slate-900 absolute top-0 left-0 z-50">
           <div 
            key={currentSlideIndex}
            className="h-full bg-brand-500 animate-fill-progress"
            style={{ animationDuration: `${SLIDE_DURATION}ms` }}
           />
        </div>

        <style>{`
          @keyframes fill-progress {
            from { width: 0%; }
            to { width: 100%; }
          }
          .animate-fill-progress {
            animation-name: fill-progress;
            animation-timing-function: linear;
          }
        `}</style>

        {/* TV HEADER - COMPACTO PERO INFORMATIVO */}
        <header className="h-[10vh] border-b border-white/5 flex items-center justify-between px-8 bg-slate-950 shrink-0">
           <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-2xl shadow-brand-500/20">
                 <img src={businessConfig.logo || ''} className="w-full h-full object-contain" alt="Logo" />
              </div>
              <div>
                 <h1 className="text-2xl font-black uppercase tracking-tighter leading-none text-white">{businessConfig.name}</h1>
                 <p className="text-brand-400 font-black uppercase tracking-[0.2em] text-[9px] mt-1 flex items-center gap-2">
                    <Sparkles size={10}/> Digital Signage Pro
                 </p>
              </div>
           </div>

           {/* CATEGORÍA ACTUAL - ENORME PARA ORIENTACIÓN */}
           <div className="flex flex-col items-center">
              <div className="px-10 py-3 bg-brand-600 rounded-full border border-white/20 shadow-[0_0_30px_rgba(14,165,233,0.3)]">
                 <span className="text-2xl font-black uppercase tracking-widest">{currentSlide.cat}</span>
              </div>
              <div className="flex gap-1 mt-2">
                 {slides.map((_, idx) => (
                   <div key={idx} className={`h-1 rounded-full transition-all ${idx === currentSlideIndex ? 'w-6 bg-brand-500' : 'w-2 bg-slate-800'}`} />
                 ))}
              </div>
           </div>

           {/* INFO CONTACTO / DELIVERY */}
           <div className="flex items-center gap-6">
              <div className="text-right border-r border-white/10 pr-6">
                 <p className="text-[8px] font-black text-brand-400 uppercase tracking-widest mb-1">Servicio a Domicilio</p>
                 <div className="flex items-center gap-2 text-xl font-black text-white">
                    <Phone size={18} className="text-brand-500" />
                    <span className="tracking-tighter">{businessConfig.phone}</span>
                 </div>
              </div>
              <div className="hidden xl:block">
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Ubicación</p>
                 <p className="text-[10px] font-bold text-slate-300 uppercase truncate max-w-[200px]">{businessConfig.address}</p>
              </div>
           </div>
        </header>

        {/* CUERPO DEL MENÚ - GRID DE ALTA DENSIDAD */}
        <main className={`flex-1 p-4 transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'}`}>
           <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3 h-full content-start">
              {currentSlide.items.map((item, idx) => (
                <div 
                  key={`${item.id}-${idx}`} 
                  className={`bg-slate-900/40 border border-white/5 rounded-2xl p-2 flex flex-col h-auto animate-in fade-in zoom-in duration-300 delay-[${idx * 20}ms] hover:border-brand-500/50 transition-colors ${item.displayStock <= 0 ? 'grayscale opacity-30' : ''}`}
                >
                   {/* IMAGEN PEQUEÑA O ICONO */}
                   <div className="aspect-square w-full rounded-xl overflow-hidden bg-slate-800 mb-2 relative group">
                      {item.displayImage ? (
                        <img src={item.displayImage} className="w-full h-full object-cover" alt={item.displayName} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-700">
                           <UtensilsCrossed size={24} className="opacity-20" />
                        </div>
                      )}
                      
                      {/* PRECIO OVERLAY PEQUEÑO */}
                      <div className="absolute bottom-1 right-1">
                        <div className="bg-brand-600 px-2 py-0.5 rounded-lg shadow-xl border border-white/10">
                           <span className="text-xs font-black text-white tracking-tighter">${item.displayPrice.toFixed(0)}</span>
                        </div>
                      </div>
                   </div>

                   {/* INFO PRODUCTO */}
                   <div className="flex flex-col justify-between flex-1">
                      <h3 className="text-[9px] font-black uppercase tracking-tighter leading-none line-clamp-2 text-slate-200">
                         {item.displayName}
                      </h3>
                      {item.isVariant && (
                        <span className="text-[7px] font-bold text-brand-400/80 uppercase mt-1">Variante</span>
                      )}
                   </div>
                </div>
              ))}
              
              {/* PLACEHOLDERS PARA MANTENER ESTRUCTURA SI HAY POCOS ITEMS */}
              {currentSlide.items.length < 30 && Array.from({ length: 12 }).map((_, i) => (
                <div key={`ph-${i}`} className="border border-white/5 bg-white/2 rounded-2xl opacity-10 flex items-center justify-center">
                   <Package size={20} />
                </div>
              ))}
           </div>
        </main>

        {/* MARQUESINA INFERIOR */}
        <footer className="h-[4vh] bg-brand-600 flex items-center overflow-hidden shrink-0 border-t border-white/10">
           <div className="flex whitespace-nowrap animate-marquee">
              {[1, 2, 3].map(i => (
                <span key={i} className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-950 px-10">
                   {businessConfig.footerMessage} • PRECIOS SUJETOS A CAMBIOS SIN PREVIO AVISO • CALIDAD GARANTIZADA • ABIERTO HASTA LAS 10:00 PM • GRACIAS POR PREFERIRNOS
                </span>
              ))}
           </div>
        </footer>

        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-33.33%); }
          }
          .animate-marquee {
            animation: marquee 30s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  // --- RENDER MODO MÓVIL (BÁSICO) ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 overflow-hidden shadow-lg flex items-center justify-center p-1.5 shrink-0">
            {businessConfig.logo ? <img src={businessConfig.logo} className="w-full h-full object-contain" alt="Logo" /> : <ShoppingBag size={24} className="text-white" />}
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight">{businessConfig.name}</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><Phone size={10} className="inline mr-1"/> {businessConfig.phone}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12 space-y-16">
          {categories.filter(c => c.name !== 'Catálogo').map(cat => {
            const catItems = catalogItems.filter(i => i.categoryName === cat.name);
            if (catItems.length === 0) return null;
            return (
              <section key={cat.id}>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-8 pl-4 border-l-8 border-brand-500">{cat.name}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {catItems.map(item => (
                    <div key={item.id} className={`bg-white rounded-[2rem] overflow-hidden shadow-sm border border-gray-100 flex flex-col ${item.displayStock <= 0 ? 'grayscale opacity-50' : ''}`}>
                      <div className="aspect-square bg-gray-100 relative">
                        {item.displayImage ? <img src={item.displayImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={48}/></div>}
                        <div className="absolute bottom-3 left-3 right-3">
                           <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-xl shadow-xl flex justify-between items-center border border-white/50">
                              <span className="text-lg font-black text-brand-600">${item.displayPrice.toFixed(2)}</span>
                           </div>
                        </div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-center">
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-sm leading-tight line-clamp-2">{item.displayName}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
      </main>
    </div>
  );
};
