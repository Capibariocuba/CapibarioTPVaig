
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Phone, Sparkles, AlertCircle, UtensilsCrossed, ArrowRight, RefreshCw } from 'lucide-react';
import { Product } from '../types';

// CONFIGURACIÓN DE LAYOUT Y ANIMACIÓN
const DESKTOP_COLS = 6;
const DESKTOP_ROWS = 5;
const ITEMS_PER_PAGE = DESKTOP_COLS * DESKTOP_ROWS; // 30 productos
const FLIP_INTERVAL = 8000; // Rotación de página cada 8s
const DATA_REFRESH_INTERVAL = 10000; // Re-evaluación de stock/precios cada 10s

export const WebCatalogView: React.FC = () => {
  const { 
    products, 
    businessConfig, 
    currencies, 
    activePosTerminalId, 
    warehouses 
  } = useStore();
  
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // Trigger para re-renderizar lógica cada 10s

  // 1. REFRESH INTERNO CADA 10 SEGUNDOS (Sin recarga de página)
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshTick(t => t + 1);
    }, DATA_REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // 2. DETERMINAR ALMACÉN ACTIVO (Basado en TPV o Default)
  const activeWhId = useMemo(() => {
    const terminal = businessConfig.posTerminals?.find(t => t.id === activePosTerminalId);
    return terminal?.warehouseId || warehouses[0]?.id || 'wh-default';
  }, [businessConfig.posTerminals, activePosTerminalId, warehouses]);

  // 3. FILTRADO, REASIGNACIÓN DE CATEGORÍAS Y ORDENACIÓN
  const availableItems = useMemo(() => {
    // El refreshTick asegura que se re-evalue periódicamente si cambian los datos en el store
    void refreshTick; 

    return products
      .filter(p => {
        const totalStock = (p.stock || 0) + (p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0);
        return !p.hidden && p.warehouseId === activeWhId && totalStock > 0;
      })
      .map(p => {
        // Regla: Ocultar "Catálogo" y buscar la siguiente categoría válida
        const validCats = (p.categories || []).filter(c => c.toLowerCase() !== 'catálogo');
        const displayCategory = validCats.length > 0 ? validCats[0] : 'General';
        return { ...p, displayCategory };
      })
      .sort((a, b) => {
        return a.displayCategory.localeCompare(b.displayCategory) || a.name.localeCompare(b.name);
      });
  }, [products, activeWhId, refreshTick]);

  // 4. PAGINACIÓN LÓGICA
  const pages = useMemo(() => {
    const p = [];
    for (let i = 0; i < availableItems.length; i += ITEMS_PER_PAGE) {
      p.push(availableItems.slice(i, i + ITEMS_PER_PAGE));
    }
    return p;
  }, [availableItems]);

  // 5. ROTACIÓN AUTOMÁTICA
  useEffect(() => {
    if (pages.length <= 1) {
      setCurrentPage(0);
      return;
    }

    const interval = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage(prev => (prev + 1) % pages.length);
        setIsFlipping(false);
      }, 600);
    }, FLIP_INTERVAL);

    return () => clearInterval(interval);
  }, [pages.length]);

  // 6. OBTENER SÍMBOLO DE MONEDA
  const currencySymbol = useMemo(() => {
    const curr = currencies.find(c => c.code === businessConfig.primaryCurrency);
    return curr?.symbol || '$';
  }, [currencies, businessConfig.primaryCurrency]);

  if (!businessConfig.isWebCatalogActive) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="bg-slate-50 p-10 rounded-[3rem] mb-6 border border-slate-100">
           <AlertCircle size={64} className="text-slate-300 mx-auto" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Catálogo Temporalmente Offline</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Vuelva a consultar en unos minutos.</p>
      </div>
    );
  }

  const currentPageItems = pages[currentPage] || [];

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-900 overflow-hidden flex flex-col font-sans select-none transition-colors duration-500">
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
        
        @keyframes card-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        @media (prefers-reduced-motion: no-preference) {
          .animate-pulse-card {
            animation: card-pulse 5s ease-in-out infinite;
          }
        }
      `}</style>

      {/* HEADER TEMA BLANCO */}
      <header className="h-[12vh] bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 p-2 shadow-xl overflow-hidden flex items-center justify-center">
            {businessConfig.logo ? (
              <img src={businessConfig.logo} className="w-full h-full object-contain" alt="Logo" />
            ) : (
              <Sparkles className="text-white" size={32} />
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none text-slate-900">
              {businessConfig.name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="bg-slate-100 text-slate-500 text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest border border-slate-200">Menú Actualizado</span>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] hidden md:block">
                {businessConfig.address}
              </p>
            </div>
          </div>
        </div>

        <a 
          href={`tel:${businessConfig.phone}`}
          className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-[2rem] flex items-center gap-4 transition-all shadow-xl shadow-slate-200 group"
        >
          <div className="text-right">
            <p className="text-[8px] font-black uppercase leading-none opacity-60 tracking-widest">Delivery / Pedidos</p>
            <p className="text-lg font-black tracking-tighter leading-none">{businessConfig.phone}</p>
          </div>
          <div className="bg-white/10 p-2 rounded-xl group-hover:rotate-12 transition-transform">
            <Phone size={24} />
          </div>
        </a>
      </header>

      {/* PANE PRINCIPAL (GRID 6x5) */}
      <main className="flex-1 p-6 perspective-container bg-slate-50">
        <div className={`flip-board ${isFlipping ? 'is-flipping' : ''}`}>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 grid-rows-5 gap-3 h-full backface-hidden">
            {currentPageItems.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col h-full hover:border-brand-500 transition-all group relative overflow-hidden shadow-sm animate-pulse-card"
              >
                {/* CATEGORY TAG (Sin 'Catálogo') */}
                <div className="absolute top-2 left-2 z-10">
                  <span className="bg-white/90 backdrop-blur-md text-[7px] font-black uppercase px-2 py-0.5 rounded-full text-slate-500 border border-slate-100 shadow-sm">
                    {item.displayCategory}
                  </span>
                </div>

                {/* IMAGEN COMPACTA */}
                <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-50 mb-3 shrink-0 flex items-center justify-center border border-slate-50">
                  {item.image ? (
                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt={item.name} />
                  ) : (
                    <UtensilsCrossed size={28} className="text-slate-200" />
                  )}
                </div>

                {/* CONTENIDO DE TEXTO */}
                <div className="flex flex-col justify-between flex-1 min-h-0">
                  <h3 className="text-xs md:text-[13px] font-black uppercase tracking-tight leading-tight line-clamp-2 text-slate-800">
                    {item.name}
                  </h3>
                  
                  <div className="mt-auto flex items-end justify-between border-t border-slate-50 pt-2">
                    <div className="flex flex-col">
                      <span className="text-[14px] font-black text-brand-600 tracking-tighter">
                        {currencySymbol}{item.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <ArrowRight size={12} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* RELLENO ESTRUCTURAL */}
            {currentPageItems.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - currentPageItems.length }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white/20 border border-slate-100 rounded-2xl hidden lg:block" />
            ))}
          </div>

        </div>
      </main>

      {/* FOOTER - STATUS Y PAGINACIÓN */}
      <footer className="h-[8vh] bg-white border-t border-slate-200 flex items-center justify-between px-10 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex gap-2.5">
            {pages.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-700 ${idx === currentPage ? 'w-10 bg-slate-900 shadow-sm' : 'w-2 bg-slate-200'}`}
              />
            ))}
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">
            Página {currentPage + 1} de {pages.length || 1}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
            <RefreshCw size={12} className="animate-spin text-brand-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Sincronizado cada 10s
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hidden lg:block italic">
            {businessConfig.footerMessage}
          </span>
        </div>
      </footer>
    </div>
  );
};
