
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
        const catItems = available.filter(p => p.categories.includes(cat));
        if (catItems.length === 0) return;

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
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="bg-slate-900 p-10 rounded-[3rem] mb-6 border border-slate-800"><AlertCircle size={64} className="text-slate-700 mx-auto" /></div>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Catálogo Offline</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Vuelva pronto.</p>
      </div>
    );
  }

  const activeScreen = screens[currentScreenIdx];
  const slides = businessConfig.digitalCatalogImages || [];

  return (
    <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden flex font-sans select-none transition-colors duration-500">
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
      <div className="w-[45%] h-full flex flex-col border-r border-white/5 bg-slate-900">
        {/* Slideshow */}
        <div className="flex-1 relative overflow-hidden bg-black">
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
             <div className="h-full flex flex-col items-center justify-center text-slate-800 p-20 text-center">
                <Sparkles size={120} className="mb-6 opacity-10" />
                <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-700">{businessConfig.name}</h2>
             </div>
           )}
           
           {/* Overlay Logo/Nombre */}
           <div className="absolute top-8 left-8 z-20 flex items-center gap-5 bg-black/60 backdrop-blur-xl p-5 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <div className="w-16 h-16 bg-white rounded-2xl p-2 shadow-sm overflow-hidden flex items-center justify-center border border-white/10">
                <img src={businessConfig.logo || ''} className="w-full h-full object-contain" alt="Logo" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tighter text-white">{businessConfig.name}</h1>
                <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest">Catálogo Online</p>
              </div>
           </div>
        </div>

        {/* Ticker / Cintillo */}
        <div 
            className="h-[12vh] flex items-center overflow-hidden border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] shrink-0"
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

      {/* LADO DERECHO: PRODUCTOS (TEMA OSCURO + FICHAS BLANCAS) */}
      <div className="flex-1 h-full bg-slate-950 p-8 flex flex-col">
        {/* Header Categoría (COMPACTO) */}
        <div className="mb-6 flex justify-between items-center border-b border-white/10 pb-4 shrink-0">
           <div className="flex items-center gap-5">
              <div className="p-3 bg-brand-500 text-white rounded-2xl shadow-lg shadow-brand-500/20">
                <Layers size={28} />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white">
                {activeScreen?.catName}
              </h2>
           </div>
           <div className="text-right">
              <p className="text-2xl font-black text-white tracking-tighter">{businessConfig.phone}</p>
           </div>
        </div>

        {/* Lista de Productos (FIX 10 FILAS) */}
        <div className="flex-1 grid grid-rows-[repeat(10,minmax(0,1fr))] gap-2 h-full overflow-hidden">
          {activeScreen?.items.map((item, idx) => (
            <div 
              key={`${item.id}-${idx}`}
              className="bg-white p-2 rounded-2xl flex items-center gap-5 hover:scale-[1.01] transition-all group animate-in slide-in-from-right duration-500 shadow-xl"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              {/* Thumbnail Ampliado */}
              <div className="h-full aspect-square rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                {item.image ? (
                  <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50 relative">
                     <UtensilsCrossed size={32} className="opacity-20" />
                     <span className="absolute inset-0 flex items-center justify-center font-black text-2xl text-slate-200 pointer-events-none uppercase">
                        {item.name.charAt(0)}
                     </span>
                  </div>
                )}
              </div>

              {/* Nombre (TEXTO NEGRO) */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 line-clamp-1">
                  {item.name}
                </h3>
              </div>

              {/* Precio (TEXTO NEGRO / ALTO CONTRASTE) */}
              <div className="text-right shrink-0 pr-4">
                <div className="text-3xl font-black text-slate-900 tracking-tighter">
                  {currencySymbol}{item.price.toLocaleString()}
                </div>
              </div>
            </div>
          ))}

          {(!activeScreen || activeScreen.items.length === 0) && (
            <div className="h-full flex items-center justify-center text-slate-700 italic uppercase font-black text-xs tracking-widest border-4 border-dashed border-slate-900 rounded-[3rem]">
               Configure productos con la categoría "Catálogo" para mostrarlos aquí.
            </div>
          )}
        </div>

        {/* Footer Branding Capibario (CENTRADOS) */}
        <div className="mt-6 flex flex-col items-center justify-center opacity-40 shrink-0">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white">
              POWERED BY CAPIBARIO TPV
           </p>
           <p className="text-[8px] font-bold tracking-[0.2em] text-brand-400 mt-1 uppercase">
              www.capibario.com
           </p>
        </div>
      </div>
    </div>
  );
};
