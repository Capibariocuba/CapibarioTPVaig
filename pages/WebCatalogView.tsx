
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { Sparkles, AlertCircle, UtensilsCrossed, RefreshCw, Layers, Bell } from 'lucide-react';
import { Product } from '../types';

// CONFIGURACIÓN DE PANTALLA DERECHA
const ITEMS_PER_SCREEN = 10; // Exactamente 10 productos por pantalla
const ANIM_DURATION = 500; // ms
const ROW_DELAYS = [120, 0, 180, 40, 220, 80, 150, 30, 200, 100]; // Delays "regados" para el stagger

type TransitionPhase = 'IDLE' | 'EXITING' | 'ENTERING';

// Canal de comunicación para llamado de pedidos
const catalogChannel = new BroadcastChannel('capibario_catalog_calls');

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

  // Estados para la animación staggered
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('IDLE');
  const [renderData, setRenderData] = useState<{ catName: string; items: Product[] } | null>(null);

  // Estados para llamado de pedidos
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

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
    const available = products.filter(p => 
        p.categories.includes('Catálogo') && 
        !p.hidden && 
        p.warehouseId === activeWhId &&
        ((p.stock || 0) + (p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0)) > 0
    );
    
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

  // 4. LÓGICA DE TRANSICIÓN STAGGERED (Sincronización con el cambio de índice)
  useEffect(() => {
    const nextScreen = screens[currentScreenIdx];
    if (!nextScreen) return;

    // Si es la carga inicial, simplemente mostramos
    if (!renderData) {
      setRenderData(nextScreen);
      return;
    }

    // Iniciamos fase de salida
    setTransitionPhase('EXITING');

    // Esperamos a que termine la salida (max delay + duration) para cambiar los datos
    const exitTimer = setTimeout(() => {
      setRenderData(nextScreen);
      setTransitionPhase('ENTERING');

      // Esperamos un frame para que el navegador registre la nueva posición inicial (izquierda)
      // y luego pasamos a IDLE para que la transición de entrada ocurra
      const enterTimer = setTimeout(() => {
        setTransitionPhase('IDLE');
      }, 50);

      return () => clearTimeout(enterTimer);
    }, 750); // Ajustado para dar margen al stagger más largo

    return () => clearTimeout(exitTimer);
  }, [currentScreenIdx, screens]);

  // 5. ROTACIÓN DE PANTALLAS (DERECHA)
  useEffect(() => {
    if (screens.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentScreenIdx(prev => (prev + 1) % screens.length);
    }, rotationSeconds * 1000);
    return () => clearInterval(interval);
  }, [screens.length, rotationSeconds]);

  // 6. ROTACIÓN DE SLIDESHOW (IZQUIERDA)
  useEffect(() => {
    const slides = businessConfig.digitalCatalogImages || [];
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIdx(prev => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [businessConfig.digitalCatalogImages]);

  // 7. ESCUCHAR LLAMADOS DE PEDIDOS
  useEffect(() => {
    let hideTimeout: number;
    let repeatInterval: number;

    const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'ORDER_CALL') {
            const rawNumber = String(event.data.ticketNumber || '');
            // Quitar ceros a la izquierda (ej: "000031" -> "31", "000000" -> "0")
            const formattedNumber = rawNumber.replace(/^0+/, '') || '0';
            
            setActiveCall(formattedNumber);
            playBell();

            // Limpiar timers anteriores para evitar solapamientos
            if (hideTimeout) window.clearTimeout(hideTimeout);
            if (repeatInterval) window.clearInterval(repeatInterval);

            // Iniciar repetición del sonido cada 1.5s mientras el overlay sea visible
            repeatInterval = window.setInterval(() => {
                playBell();
            }, 1500);

            // Duración del overlay: EXACTAMENTE 10 segundos
            hideTimeout = window.setTimeout(() => {
                setActiveCall(null);
                window.clearInterval(repeatInterval);
            }, 10000);
        }
    };
    catalogChannel.addEventListener('message', handleMessage);
    return () => {
        catalogChannel.removeEventListener('message', handleMessage);
        if (hideTimeout) window.clearTimeout(hideTimeout);
        if (repeatInterval) window.clearInterval(repeatInterval);
    };
  }, [audioEnabled]);

  const playBell = () => {
    if (!audioEnabled) return;
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 2);
    } catch (e) {
        console.error("Audio error", e);
    }
  };

  const enableAudio = () => {
    setAudioEnabled(true);
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
  };

  // 8. MONEDA
  const currencySymbol = useMemo(() => {
    const curr = currencies.find(c => c.code === businessConfig.primaryCurrency);
    return curr?.symbol || '$';
  }, [currencies, businessConfig.primaryCurrency]);

  if (!businessConfig.isWebCatalogActive) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="bg-slate-900 p-10 rounded-[3rem] mb-6 border border-slate-800"><AlertCircle size={64} className="text-slate-700 mx-auto" /></div>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Estamos en Cierre</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Vuelva pronto.</p>
      </div>
    );
  }

  const slides = businessConfig.digitalCatalogImages || [];

  return (
    <div 
        className="h-screen w-screen bg-slate-950 text-white overflow-hidden flex font-sans select-none transition-colors duration-500 relative"
        onClick={!audioEnabled ? enableAudio : undefined}
    >
      {!audioEnabled && (
          <div className="absolute top-4 right-4 z-[100] bg-brand-500 text-white px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl animate-bounce">
              {/* Fix: Corrected syntax error size(12} to size={12} */}
              <Bell size={12}/> Toca la pantalla para activar sonido
          </div>
      )}

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
        
        /* Clases de animación por listones */
        .product-row {
          transition: transform ${ANIM_DURATION}ms cubic-bezier(0.23, 1, 0.32, 1), opacity ${ANIM_DURATION}ms ease;
          will-change: transform, opacity;
        }
        
        .row-exiting {
          transform: translateX(120px);
          opacity: 0;
        }
        
        .row-entering {
          transform: translateX(-120px);
          opacity: 0;
        }
        
        .row-idle {
          transform: translateX(0);
          opacity: 1;
        }

        .call-pulse {
            animation: callPulse 2s infinite ease-in-out;
        }

        @keyframes callPulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.95; }
            100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* OVERLAY DE LLAMADO DE PEDIDOS */}
      {activeCall && (
          <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-10 animate-in fade-in duration-500">
              <div className="bg-white text-slate-950 w-[800px] h-[800px] rounded-full flex flex-col items-center justify-center text-center shadow-[0_0_100px_rgba(255,255,255,0.4)] border-[20px] border-brand-500 call-pulse animate-in zoom-in duration-700">
                  <Bell size={120} className="text-brand-500 mb-10 animate-bounce" />
                  <h2 className="text-6xl font-black uppercase tracking-tighter mb-4">Ticket #{activeCall}</h2>
                  <div className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black text-4xl uppercase tracking-[0.2em]">
                      Listo para Recoger
                  </div>
                  <p className="mt-12 text-slate-400 font-bold uppercase tracking-widest text-xl">Por favor, acérquese al mostrador</p>
              </div>
          </div>
      )}

      {/* LADO IZQUIERDO: VISUAL (Slideshow + Ticker) */}
      <div className="w-[45%] h-full flex flex-col border-r border-white/5 bg-slate-900 z-10">
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

           {/* OVERLAY DE CÓDIGOS QR PARA PAGOS */}
           {( (businessConfig.showQrTransfer && businessConfig.qrTransferImageData) || (businessConfig.showQrEnzona && businessConfig.qrEnzonaImageData) ) && (
             <div className="absolute bottom-8 left-8 z-30 flex flex-col gap-4 animate-in fade-in slide-in-from-left duration-700">
               {businessConfig.showQrTransfer && businessConfig.qrTransferImageData && (
                 <div className="bg-black/50 backdrop-blur-md p-3 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center">
                   <div className="w-[100px] h-[100px] bg-white rounded-xl p-1 mb-2 overflow-hidden">
                     <img src={businessConfig.qrTransferImageData} className="w-full h-full object-contain" alt="QR Transfermóvil" />
                   </div>
                   <span className="text-[8px] font-black text-white uppercase tracking-widest">PAGO X TRANSFERMÓVIL</span>
                 </div>
               )}
               {businessConfig.showQrEnzona && businessConfig.qrEnzonaImageData && (
                 <div className="bg-black/50 backdrop-blur-md p-3 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center">
                   <div className="w-[100px] h-[100px] bg-white rounded-xl p-1 mb-2 overflow-hidden">
                     <img src={businessConfig.qrEnzonaImageData} className="w-full h-full object-contain" alt="QR Enzona" />
                   </div>
                   <span className="text-[8px] font-black text-white uppercase tracking-widest">PAGO X ENZONA</span>
                 </div>
               )}
             </div>
           )}
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
      <div className="flex-1 h-full bg-slate-950 p-8 flex flex-col relative">
        {/* Header Categoría (COMPACTO) */}
        <div className="mb-6 flex justify-between items-center border-b border-white/10 pb-4 shrink-0">
           <div className="flex items-center gap-5">
              <div className="p-3 bg-brand-500 text-white rounded-2xl shadow-lg shadow-brand-500/20">
                <Layers size={28} />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white">
                {renderData?.catName}
              </h2>
           </div>
           <div className="text-right">
              <p className="text-2xl font-black text-white tracking-tighter">{businessConfig.phone}</p>
           </div>
        </div>

        {/* Lista de Productos (FIX 10 FILAS) */}
        <div className="flex-1 grid grid-rows-[repeat(10,minmax(0,1fr))] gap-2 h-full overflow-hidden">
          {(renderData?.items || []).map((item, idx) => {
            // Determinar clase de animación según la fase
            let animClass = 'row-idle';
            if (transitionPhase === 'EXITING') animClass = 'row-exiting';
            if (transitionPhase === 'ENTERING') animClass = 'row-entering';

            return (
              <div 
                key={`${item.id}-${idx}`}
                className={`bg-white p-2 rounded-2xl flex items-center gap-5 shadow-xl product-row ${animClass}`}
                style={{ 
                  transitionDelay: `${ROW_DELAYS[idx]}ms`
                }}
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
            );
          })}

          {(!renderData || renderData.items.length === 0) && (
            <div className="h-full flex items-center justify-center text-slate-700 italic uppercase font-black text-xs tracking-widest border-4 border-dashed border-slate-900 rounded-[3rem]">
               Configure productos con la categoría "Catálogo" para mostrarlos aquí.
            </div>
          )}
        </div>

        {/* Footer Branding Capibario (CENTRADOS) */}
        <div className="mt-6 flex flex-col items-center justify-center opacity-40 shrink-0">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white">
              DESARROLLADO X CAPIBARIO
           </p>
           <p className="text-[8px] font-bold tracking-[0.2em] text-brand-400 mt-1 uppercase">
              www.capibario.com
           </p>
        </div>
      </div>
    </div>
  );
};
