
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Phone, Sparkles, AlertCircle, UtensilsCrossed, ArrowRight, RefreshCw, Layers } from 'lucide-react';
import { Product } from '../types';

// CONFIGURACIÓN DE PANTALLA DERECHA
const ITEMS_PER_SCREEN = 10; // Productos por pantalla en la lista horizontal

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

  // 3. GENERAR TODAS LAS PANTALLAS (CATEGORÍA -> PÁGINAS)
  const screens = useMemo(() => {
    void refreshTick;
    const available = products.filter(p => !p.hidden && p.warehouseId === activeWhId);
    
    // Definir orden de categorías
    const catNames = categories.map(c => c.name).filter(n => n !== 'Catálogo');
    const orderedCats = ['Todo', ...catNames, 'Catálogo'];

    const result: { catName: string; items: Product[] }[] = [];

    orderedCats.forEach(cat => {
        let catItems = [];
        if (cat === 'Todo') catItems = available;
        else catItems = available.filter(p => p.categories.includes(cat));

        if (catItems.length === 0) return;

        // Dividir en páginas si exceden ITEMS_PER_SCREEN
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
    }, 6000); // Slide cambia un poco más rápido para dinamismo
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
    <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden flex font-sans select-none">
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
      <div className="w-[45%] h-full flex flex-col border-r border-white/10 bg-black">
        {/* Slideshow */}
        <div className="flex-1 relative overflow-hidden bg-slate-900">
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
             <div className="h-full flex flex-col items-center justify-center text-slate-700 p-20 text-center">
                <Sparkles size={120} className="mb-6 opacity-20" />
                <h2 className="text-4xl font-black uppercase tracking-tighter">{businessConfig.name}</h2>
                <p className="text-xs font-bold uppercase tracking-[0.3em] mt-4 opacity-50">Calidad y Servicio</p>
             </div>
           )}
           
           {/* Overlay Logo/Nombre */}
           <div className="absolute top-10 left-10 z-20 flex items-center gap-6 bg-black/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <div className="w-20 h-20 bg-white rounded-3xl p-3 shadow-xl overflow-hidden flex items-center justify-center">
                <img src={businessConfig.logo || ''} className="w-full h-full object-contain" alt="Logo" />
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-white">{businessConfig.name}</h1>
                <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mt-1">Menu Digital Pro</p>
              </div>
           </div>
        </div>

        {/* Ticker / Cintillo */}
        <div className="h-[12vh] bg-brand-600 flex items-center overflow-hidden border-t border-white/20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
           <div className="animate-marquee font-black text-3xl uppercase tracking-widest text-slate-950">
              {businessConfig.digitalCatalogTicker || `BIENVENIDOS A ${businessConfig.name.toUpperCase()} • DISFRUTE NUESTROS PRODUCTOS FRESCOS • SERVICIO A DOMICILIO AL ${businessConfig.phone} •`}
              &nbsp;&nbsp;&nbsp;&nbsp;
              {businessConfig.digitalCatalogTicker || `BIENVENIDOS A ${businessConfig.name.toUpperCase()} • DISFRUTE NUESTROS PRODUCTOS FRESCOS • SERVICIO A DOMICILIO AL ${businessConfig.phone} •`}
           </div>
        </div>
      </div>

      {/* LADO DERECHO: PRODUCTOS (Lista Horizontal) */}
      <div className="flex-1 h-full bg-slate-950 p-12 flex flex-col">
        {/* Header Categoría */}
        <div className="mb-10 flex justify-between items-end border-b-4 border-brand-500 pb-6">
           <div>
              <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.4em] mb-2">Sección Actual</p>
              <h2 className="text-6xl font-black uppercase tracking-tighter text-white flex items-center gap-6">
                <Layers size={48} className="text-brand-500" />
                {activeScreen?.catName}
              </h2>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Pedidos al</p>
              <p className="text-3xl font-black text-white tracking-tighter">{businessConfig.phone}</p>
           </div>
        </div>

        {/* Lista Horizontal de Productos */}
        <div className="flex-1 flex flex-col justify-start space-y-3">
          {activeScreen?.items.map((item, idx) => (
            <div 
              key={`${item.id}-${idx}`}
              className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center gap-6 hover:bg-white/10 transition-all group animate-in slide-in-from-right duration-500"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Mini Foto */}
              <div className="w-16 h-16 rounded-2xl bg-slate-800 overflow-hidden shadow-xl shrink-0">
                {item.image ? (
                  <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-700"><UtensilsCrossed size={24} /></div>
                )}
              </div>

              {/* Nombre */}
              <div className="flex-1">
                <h3 className="text-xl font-black uppercase tracking-tight text-white group-hover:text-brand-400 transition-colors line-clamp-1">
                  {item.name}
                </h3>
                <div className="flex gap-2 mt-1">
                   {item.categories.filter(c => c !== activeScreen.catName).map(c => (
                     <span key={c} className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{c}</span>
                   ))}
                </div>
              </div>

              {/* Precio */}
              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-white tracking-tighter bg-slate-900 px-6 py-3 rounded-2xl border border-white/10 group-hover:border-brand-500/30 group-hover:bg-brand-500 group-hover:text-slate-950 transition-all">
                  {currencySymbol}{item.price.toLocaleString()}
                </div>
              </div>
            </div>
          ))}

          {(!activeScreen || activeScreen.items.length === 0) && (
            <div className="h-full flex items-center justify-center text-slate-700 italic uppercase font-black text-xs tracking-widest">
               No hay productos para mostrar en esta sección
            </div>
          )}
        </div>

        {/* Footer Indicadores de Pantalla */}
        <div className="mt-8 flex justify-between items-center bg-white/5 p-6 rounded-[2rem]">
           <div className="flex gap-3">
              {screens.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-2 rounded-full transition-all duration-700 ${idx === currentScreenIdx ? 'w-16 bg-brand-500 shadow-[0_0_20px_rgba(14,165,233,0.6)]' : 'w-4 bg-slate-800'}`}
                />
              ))}
           </div>
           <div className="flex items-center gap-4">
              <RefreshCw size={14} className="animate-spin text-brand-500" />
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">Actualizado hace instantes</span>
           </div>
        </div>
      </div>
    </div>
  );
};
