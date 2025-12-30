
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Phone, Sparkles, AlertCircle, UtensilsCrossed, ArrowRight } from 'lucide-react';
import { LicenseTier, Product } from '../types';

// CONFIGURACIÓN DE LAYOUT Y ANIMACIÓN
const DESKTOP_COLS = 6;
const DESKTOP_ROWS = 5;
const ITEMS_PER_PAGE = DESKTOP_COLS * DESKTOP_ROWS; // 30 productos exactos
const FLIP_INTERVAL = 8000; // 8 segundos por página

export const WebCatalogView: React.FC = () => {
  const { 
    products, 
    businessConfig, 
    categories, 
    currencies, 
    activePosTerminalId, 
    warehouses 
  } = useStore();
  
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  // 1. DETERMINAR ALMACÉN ACTIVO (Basado en TPV o Default)
  const activeWhId = useMemo(() => {
    const terminal = businessConfig.posTerminals?.find(t => t.id === activePosTerminalId);
    return terminal?.warehouseId || warehouses[0]?.id || 'wh-default';
  }, [businessConfig.posTerminals, activePosTerminalId, warehouses]);

  // 2. FILTRADO Y ORDENACIÓN EN TIEMPO REAL (Mismas reglas que el TPV)
  const availableItems = useMemo(() => {
    return products
      .filter(p => {
        // Regla: No ocultos, mismo almacén, y debe tener stock (base + variantes)
        const totalStock = (p.stock || 0) + (p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0);
        return !p.hidden && p.warehouseId === activeWhId && totalStock > 0;
      })
      .sort((a, b) => {
        // Ordenar por la primera categoría encontrada para agrupar visualmente
        const catA = a.categories?.[0] || '';
        const catB = b.categories?.[0] || '';
        return catA.localeCompare(catB) || a.name.localeCompare(b.name);
      });
  }, [products, activeWhId]);

  // 3. PAGINACIÓN LÓGICA
  const pages = useMemo(() => {
    const p = [];
    for (let i = 0; i < availableItems.length; i += ITEMS_PER_PAGE) {
      p.push(availableItems.slice(i, i + ITEMS_PER_PAGE));
    }
    return p;
  }, [availableItems]);

  // 4. LÓGICA DE ROTACIÓN AUTOMÁTICA CON FLIP
  useEffect(() => {
    if (pages.length <= 1) {
      setCurrentPage(0); // Reset si el stock reduce las páginas
      return;
    }

    const interval = setInterval(() => {
      setIsFlipping(true);
      
      // El cambio de datos ocurre a mitad de la animación (600ms de 1.2s)
      setTimeout(() => {
        setCurrentPage(prev => (prev + 1) % pages.length);
        setIsFlipping(false);
      }, 600);
      
    }, FLIP_INTERVAL);

    return () => clearInterval(interval);
  }, [pages.length]);

  // 5. OBTENER SÍMBOLO DE MONEDA
  const currencySymbol = useMemo(() => {
    const curr = currencies.find(c => c.code === businessConfig.primaryCurrency);
    return curr?.symbol || '$';
  }, [currencies, businessConfig.primaryCurrency]);

  if (!businessConfig.isWebCatalogActive) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="bg-red-500/10 p-8 rounded-[3rem] mb-6 border border-red-500/20">
           <AlertCircle size={64} className="text-red-500 mx-auto" />
        </div>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Menú Digital Pausado</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Vuelva a consultar más tarde.</p>
      </div>
    );
  }

  const currentPageItems = pages[currentPage] || [];

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden flex flex-col font-sans select-none">
      <style>{`
        .perspective-container {
          perspective: 2500px;
        }
        .flip-board {
          transition: transform 1.2s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
          height: 100%;
          width: 100%;
        }
        .is-flipping {
          transform: rotateX(-180deg);
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        @keyframes subtle-pulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .animate-status {
          animation: subtle-pulse 3s ease-in-out infinite;
        }
      `}</style>

      {/* HEADER DINÁMICO */}
      <header className="h-[12vh] bg-slate-900/80 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-10 shrink-0 z-50">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-2xl shadow-brand-500/20 overflow-hidden">
            <img src={businessConfig.logo || ''} className="w-full h-full object-contain" alt="Logo" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none text-white">
              {businessConfig.name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="bg-brand-500 text-slate-950 text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest">Catálogo Online</span>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] hidden md:block">
                {businessConfig.address}
              </p>
            </div>
          </div>
        </div>

        <a 
          href={`tel:${businessConfig.phone}`}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-4 rounded-[2rem] flex items-center gap-4 transition-all shadow-xl shadow-emerald-500/10 group"
        >
          <div className="text-right">
            <p className="text-[8px] font-black uppercase leading-none opacity-70 tracking-widest">Servicio a Domicilio</p>
            <p className="text-lg font-black tracking-tighter leading-none">{businessConfig.phone}</p>
          </div>
          <div className="bg-slate-950/10 p-2 rounded-xl group-hover:rotate-12 transition-transform">
            <Phone size={24} />
          </div>
        </a>
      </header>

      {/* PANE PRINCIPAL (GRID 6x5) */}
      <main className="flex-1 p-6 perspective-container bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black">
        <div className={`flip-board ${isFlipping ? 'is-flipping' : ''}`}>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 grid-rows-5 gap-3 h-full backface-hidden">
            {currentPageItems.map((item) => (
              <div 
                key={item.id}
                className="bg-slate-900/40 border border-white/5 rounded-2xl p-3 flex flex-col h-full hover:border-brand-500/40 transition-all group relative overflow-hidden shadow-lg"
              >
                {/* CATEGORY TAG */}
                <div className="absolute top-2 left-2 z-10">
                  <span className="bg-slate-800/90 backdrop-blur-md text-[7px] font-black uppercase px-2 py-0.5 rounded-full text-brand-400 border border-white/5">
                    {item.categories?.[0] || 'General'}
                  </span>
                </div>

                {/* IMAGEN COMPACTA */}
                <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-800/50 mb-3 shrink-0 flex items-center justify-center">
                  {item.image ? (
                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={item.name} />
                  ) : (
                    <UtensilsCrossed size={28} className="text-slate-700 opacity-30" />
                  )}
                </div>

                {/* CONTENIDO DE TEXTO (PRIORIDAD) */}
                <div className="flex flex-col justify-between flex-1 min-h-0">
                  <h3 className="text-xs md:text-[13px] font-black uppercase tracking-tight leading-tight line-clamp-2 text-white group-hover:text-brand-400 transition-colors">
                    {item.name}
                  </h3>
                  
                  <div className="mt-auto flex items-end justify-between border-t border-white/5 pt-2">
                    <div className="flex flex-col">
                      <span className="text-[14px] font-black text-brand-500 tracking-tighter">
                        {currencySymbol}{item.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-brand-500/10 p-1.5 rounded-lg border border-brand-500/20 opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <ArrowRight size={12} className="text-brand-400" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* RELLENO PARA MANTENER ESTRUCTURA 6X5 SIEMPRE */}
            {currentPageItems.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - currentPageItems.length }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white/[0.01] border border-white/[0.03] rounded-2xl hidden lg:block" />
            ))}
          </div>

        </div>
      </main>

      {/* FOOTER - STATUS Y PAGINACIÓN */}
      <footer className="h-[8vh] bg-slate-950 border-t border-white/5 flex items-center justify-between px-10 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex gap-2.5">
            {pages.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-700 ${idx === currentPage ? 'w-10 bg-brand-500 shadow-[0_0_15px_rgba(14,165,233,0.6)]' : 'w-2 bg-slate-800'}`}
              />
            ))}
          </div>
          <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">
            Página {currentPage + 1} de {pages.length || 1}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-xl border border-white/5">
            <div className="animate-status h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              Sincronizado
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 hidden lg:block">
            {businessConfig.footerMessage}
          </span>
        </div>
      </footer>
    </div>
  );
};
