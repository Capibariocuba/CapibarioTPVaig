
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Phone, ShoppingBag, Sparkles, AlertCircle, UtensilsCrossed, ArrowRight } from 'lucide-react';

// Configuración de visualización
const DESKTOP_COLS = 6;
const DESKTOP_ROWS = 5;
const ITEMS_PER_PAGE = DESKTOP_COLS * DESKTOP_ROWS; // 30 productos
const ROTATION_INTERVAL = 7000; // 7 segundos

export const WebCatalogView: React.FC = () => {
  const { products, businessConfig, categories } = useStore();
  
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  // 1. Preparar y ordenar productos por categoría
  const sortedItems = useMemo(() => {
    return products
      .filter(p => !p.hidden && p.categories.includes('Catálogo'))
      .sort((a, b) => {
        const catA = a.categories.find(c => c !== 'Catálogo') || '';
        const catB = b.categories.find(c => c !== 'Catálogo') || '';
        return catA.localeCompare(catB);
      })
      .flatMap(p => {
        // Incluimos el producto base
        const base = {
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.image,
          category: p.categories.find(c => c !== 'Catálogo') || 'General'
        };
        // Opcional: Podrías incluir variantes aquí si fuera necesario
        return [base];
      });
  }, [products]);

  // 2. Dividir en páginas de 30 items
  const pages = useMemo(() => {
    const p = [];
    for (let i = 0; i < sortedItems.length; i += ITEMS_PER_PAGE) {
      p.push(sortedItems.slice(i, i + ITEMS_PER_PAGE));
    }
    return p;
  }, [sortedItems]);

  // 3. Lógica de rotación con animación 3D
  useEffect(() => {
    if (pages.length <= 1) return;

    const interval = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage(prev => (prev + 1) % pages.length);
        setIsFlipping(false);
      }, 600); // Mitad de la animación para el cambio de datos
    }, ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [pages.length]);

  if (!businessConfig.isWebCatalogActive) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="bg-red-500/10 p-8 rounded-[3rem] mb-6 border border-red-500/20">
           <AlertCircle size={64} className="text-red-500 mx-auto" />
        </div>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Catálogo en Mantenimiento</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Vuelva a consultar pronto.</p>
      </div>
    );
  }

  const currentPageItems = pages[currentPage] || [];

  return (
    <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden flex flex-col font-sans select-none">
      <style>{`
        .perspective-container {
          perspective: 2000px;
        }
        .flip-card {
          transition: transform 1.2s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }
        .flipping {
          transform: rotateX(-180deg);
        }
        @keyframes glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }
      `}</style>

      {/* HEADER MODERNO */}
      <header className="h-[12vh] bg-slate-900/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 shrink-0 z-50">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-2xl shadow-brand-500/20">
            <img src={businessConfig.logo || ''} className="w-full h-full object-contain" alt="Logo" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none text-white">
              {businessConfig.name}
            </h1>
            <p className="text-brand-400 font-black uppercase tracking-[0.2em] text-[10px] mt-1 flex items-center gap-2">
              <Sparkles size={12} className="animate-pulse" /> Menú Digital Pro
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ubicación</span>
            <span className="text-xs font-bold text-slate-300 uppercase">{businessConfig.address}</span>
          </div>
          <a 
            href={`tel:${businessConfig.phone}`}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-lg shadow-emerald-500/20 group"
          >
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black uppercase leading-none opacity-70">Delivery</span>
              <span className="text-sm font-black tracking-tighter leading-none">{businessConfig.phone}</span>
            </div>
            <Phone size={24} className="group-hover:rotate-12 transition-transform" />
          </a>
        </div>
      </header>

      {/* GRID DE PRODUCTOS CON ANIMACIÓN 3D */}
      <main className="flex-1 p-4 perspective-container overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        <div className={`h-full w-full flip-card ${isFlipping ? 'flipping' : ''}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 h-full content-start">
            {currentPageItems.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                className="bg-slate-900/40 border border-white/5 rounded-2xl p-3 flex flex-col h-full hover:border-brand-500/30 transition-colors group relative overflow-hidden"
              >
                {/* CATEGORY BADGE */}
                <div className="absolute top-2 left-2 z-10">
                  <span className="bg-slate-800/80 backdrop-blur-md text-[7px] font-black uppercase px-2 py-0.5 rounded-full text-brand-400 border border-white/5">
                    {item.category}
                  </span>
                </div>

                {/* IMAGEN OPTIMIZADA */}
                <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-800 mb-3 shrink-0">
                  {item.image ? (
                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-700">
                      <UtensilsCrossed size={32} className="opacity-20" />
                    </div>
                  )}
                </div>

                {/* CONTENIDO PRIORITARIO */}
                <div className="flex flex-col justify-between flex-1 min-h-0">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-tight leading-tight line-clamp-2 text-white group-hover:text-brand-400 transition-colors">
                    {item.name}
                  </h3>
                  
                  <div className="mt-2 flex items-end justify-between">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-500 uppercase leading-none">Precio</span>
                      <span className="text-xl font-black text-brand-500 tracking-tighter">
                        ${item.price.toFixed(0)}
                      </span>
                    </div>
                    <div className="bg-brand-500/10 p-1.5 rounded-lg border border-brand-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight size={14} className="text-brand-400" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* PLACEHOLDERS PARA MANTENER ESTRUCTURA 6X5 */}
            {currentPageItems.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - currentPageItems.length }).map((_, i) => (
              <div key={`empty-${i}`} className="border border-white/[0.02] bg-white/[0.01] rounded-2xl hidden lg:block" />
            ))}
          </div>
        </div>
      </main>

      {/* FOOTER / INDICADORES */}
      <footer className="h-[6vh] bg-slate-900/80 backdrop-blur-md border-t border-white/5 flex items-center justify-between px-8 shrink-0">
        <div className="flex gap-2">
          {pages.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentPage ? 'w-12 bg-brand-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]' : 'w-3 bg-slate-700'}`}
            />
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="animate-glow h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Actualizado en tiempo real • {businessConfig.footerMessage}
          </span>
        </div>
      </footer>
    </div>
  );
};
