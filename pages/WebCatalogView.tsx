
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Sparkles, AlertCircle, UtensilsCrossed, RefreshCw, Layers } from 'lucide-react';
import { Product } from '../types';

// CONFIGURACIÓN DE PANTALLA DERECHA
const ITEMS_PER_SCREEN = 10; // Exactamente 10 productos por pantalla

export const WebCatalogView: React.FC = () => {
  const { 
    products, 
    businessConfig, 
    currencies, 
    activePosTerminalId, 
    warehouses,
    categories
  } = useStore();
  
  const [currentScreenIdx, setCurrentScreenIdx] = useState(0);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const rotationSeconds = businessConfig.digitalCatalogRotationSeconds || 10;

  // 1. REFRESH INTERNO CADA 10 SEGUNDOS (Sin recarga de página para stock/precios)
  useEffect(() => {
    const timer = setInterval(() => setRefreshTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // 2. DETERMINAR ALMACÉN ACTIVO
  const activeWhId = useMemo(() => {
    const terminal = businessConfig.posTerminals?.find(t => t.id === activePosTerminalId);
    return terminal?.warehouseId || warehouses[0]?.id || 'wh-default';
  }, [businessConfig.posTerminals, activePosTerminalId, warehouses]);

  // 3. GENERAR TODAS LAS PANTALLAS (Solo productos con flag "Catálogo")
  const screens = useMemo(() => {
    void refreshTick;
    // REGLA 1: Solo productos marcados con la categoría "Catálogo" y con stock > 0 y no ocultos
    const available = products.filter(p => 
        p.categories.includes('Catálogo') && 
        !p.hidden && 
        p.warehouseId === activeWhId &&
        ((p.stock || 0) + (p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0)) > 0
    );
    
    // REGLA 2: Agrupar por su categoría real secundaria (Excluyendo "Catálogo" de la visualización)
    const validCategoryNames = categories
        .map(c => c.name)
        .filter(n => n !== 'Catálogo');

    const result: { catName: string; items: Product[] }[] = [];

    validCategoryNames.forEach(cat => {
        // Productos que pertenecen a esta categoría real Y tienen el flag Catálogo
        const catItems = available.filter(p => p.categories.includes(cat));

        if (catItems.length === 0) return;

        // Dividir en páginas si exceden 10 productos
        for (let i = 0; i < catItems.length; i += ITEMS_PER_SCREEN) {
            result.push({
                catName: cat,
                items: catItems.slice(i, i + ITEMS_PER_SCREEN)
            });
        }
    });

    return result;
  }, [products, activeWhId, categories, refreshTick]);

  // 4. ROTACIÓN DE PANTALLAS (DERECHA)
  useEffect(() => {
    if (screens.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentScreenIdx(prev => (prev + 1) % screens.length);
    }, rotationSeconds * 1000);
    return () => clearInterval(interval);
  }, [screens.length, rotationSeconds]);

  // 5. ROTACIÓN DE SLIDESHOW (IZQUIERDA)
  useEffect(() => {
    const slides = businessConfig.digitalCatalogImages || [];
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIdx(prev => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [businessConfig.digitalCatalogImages]);

  // 6. MONEDA
  const currencySymbol = useMemo(() => {
    const curr = currencies.find(c => c.code === businessConfig.primaryCurrency);
    return curr?.symbol || '$';
  }, [currencies, businessConfig.primaryCurrency]);

  if (!businessConfig.isWebCatalogActive) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="bg-slate-50 p-10 rounded-[3rem] mb-6 border border-slate-100"><AlertCircle size={64} className="text-slate-300 mx-auto" /></div>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Catálogo Offline</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Vuelva pronto.</p>
      </div>
    );
  }

  const activeScreen = screens[currentScreenIdx];
  const slides = businessConfig.digitalCatalogImages || [];

  return (
    <div className="h-screen w-screen bg-white text-slate-900 overflow-hidden flex font-sans select-none transition-colors duration-500">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          white-space: nowrap;
          animation: marquee 30s linear infinite;
        }
        .slide-fade {
          transition: opacity 1.5s ease-in-out;
        }
      `}</style>

      {/* LADO IZQUIERDO: VISUAL (Slideshow + Ticker) */}
      <div className="w-[45%] h-full flex flex-col border-r border-slate-100 bg-slate-50">
        {/* Slideshow */}
        <div className="flex-1 relative overflow-hidden bg-slate-200">
           {slides.length > 0 ? (
             slides.map((img, idx) => (
               <img 
                 key={idx} 
                 src={img} 
                 className={`absolute inset-0 w-full h-full object-cover slide-fade ${idx === currentSlideIdx ? 'opacity-100 scale-105 transition-transform duration-[6000ms]' : 'opacity-0'}`} 
                 alt="Promoción" 
               />
             ))
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 p-20 text-center">
                <Sparkles size={120} className="mb-6 opacity-20" />
                <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-300">{businessConfig.name}</h2>
             </div>
           )}
           
           {/* Overlay Logo/Nombre (TEMA BLANCO) */}
           <div className="absolute top-8 left-8 z-20 flex items-center gap-5 bg-white/90 backdrop-blur-xl p-5 rounded-[2rem] border border-slate-200 shadow-2xl">
              <div className="w-16 h-16 bg-white rounded-2xl p-2 shadow-sm overflow-hidden flex items-center justify-center border border-slate-100">
                <img src={businessConfig.logo || ''} className="w-full h-full object-contain" alt="Logo" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{businessConfig.name}</h1>
                <p className="text-[9px] font-black text-brand-500 uppercase tracking-widest">Catálogo Online</p>
              </div>
           </div>
        </div>

        {/* Ticker / Cintillo (PERSONALIZABLE) */}
        <div 
            className="h-[12vh] flex items-center overflow-hidden border-t border-white/20 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] shrink-0"
            style={{ backgroundColor: businessConfig.digitalCatalogTickerBgColor || '#0ea5e9' }}
        >
           <div 
                className="animate-marquee font-black text-3xl uppercase tracking-widest"
                style={{ color: businessConfig.digitalCatalogTickerTextColor || '#ffffff' }}
           >
              {businessConfig.digitalCatalogTicker || `BIENVENIDOS A ${businessConfig.name.toUpperCase()} • PRODUCTOS DISPONIBLES • PEDIDOS AL ${businessConfig.phone} •`}
              &nbsp;&nbsp;&nbsp;&nbsp;
              {businessConfig.digitalCatalogTicker || `BIENVENIDOS A ${businessConfig.name.toUpperCase()} • PRODUCTOS DISPONIBLES • PEDIDOS AL ${businessConfig.phone} •`}
           </div>
        </div>
      </div>

      {/* LADO DERECHO: PRODUCTOS (TEMA BLANCO + COMPACTO) */}
      <div className="flex-1 h-full bg-white p-10 flex flex-col">
        {/* Header Categoría (COMPACTO) */}
        <div className="mb-6 flex justify-between items-center border-b-2 border-slate-100 pb-4 shrink-0">
           <div className="flex items-center gap-5">
              <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
                <Layers size={28} />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900">
                {activeScreen?.catName}
              </h2>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Pedidos</p>
              <p className="text-2xl font-black text-brand-600 tracking-tighter">{businessConfig.phone}</p>
           </div>
        </div>

        {/* Lista de Productos (FIX 10 FILAS) */}
        <div className="flex-1 grid grid-rows-[repeat(10,minmax(0,1fr))] gap-2 h-full overflow-hidden">
          {activeScreen?.items.map((item, idx) => (
            <div 
              key={`${item.id}-${idx}`}
              className="bg-white border border-slate-100 p-3 rounded-2xl flex items-center gap-4 hover:border-brand-500/30 transition-all group animate-in slide-in-from-right duration-500 shadow-sm"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Mini Foto */}
              <div className="h-full aspect-square rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-50">
                {item.image ? (
                  <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200"><UtensilsCrossed size={18} /></div>
                )}
              </div>

              {/* Nombre */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 line-clamp-1 group-hover:text-brand-600 transition-colors">
                  {item.name}
                </h3>
              </div>

              {/* Precio (SIEMPRE VISIBLE) */}
              <div className="text-right shrink-0">
                <div className="text-xl font-black text-slate-900 tracking-tighter bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group-hover:border-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-all">
                  {currencySymbol}{item.price.toLocaleString()}
                </div>
              </div>
            </div>
          ))}

          {(!activeScreen || activeScreen.items.length === 0) && (
            <div className="h-full flex items-center justify-center text-slate-300 italic uppercase font-black text-xs tracking-widest border-4 border-dashed border-slate-50 rounded-[3rem]">
               Configure productos con la categoría "Catálogo" para mostrarlos aquí.
            </div>
          )}
        </div>

        {/* Footer Indicadores (TEMA BLANCO) */}
        <div className="mt-6 flex justify-between items-center bg-slate-50 p-5 rounded-[1.5rem] shrink-0">
           <div className="flex gap-2">
              {screens.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all duration-700 ${idx === currentScreenIdx ? 'w-12 bg-slate-900 shadow-sm' : 'w-3 bg-slate-200'}`}
                />
              ))}
           </div>
           <div className="flex items-center gap-3">
              <RefreshCw size={12} className="animate-spin text-slate-400" />
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">Sincronizado</span>
           </div>
        </div>
      </div>
    </div>
  );
};
