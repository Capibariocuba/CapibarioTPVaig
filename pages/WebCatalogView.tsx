
import React, { useMemo, useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { Package, Phone, MapPin, Globe, Sparkles, AlertCircle, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { Product } from '../types';

export const WebCatalogView: React.FC = () => {
  const { products, businessConfig } = useStore();

  // APLANADO DE VARIANTES: Cada variante es un ítem independiente para el cliente final
  const flattenedProducts = useMemo(() => {
    return products
      .filter(p => !p.hidden && p.categories.includes('Catálogo'))
      .flatMap(p => {
        const baseProduct = {
          ...p,
          displayName: p.name,
          displayImage: p.image,
          displayPrice: p.price
        };
        
        const variantItems = (p.variants || []).map(v => ({
          ...p,
          id: v.id, // ID de la variante para unicidad
          displayName: `${p.name} - ${v.name}`,
          displayImage: v.image || p.image,
          displayPrice: v.price
        }));

        return [baseProduct, ...variantItems];
      });
  }, [products]);

  // AGRUPACIÓN POR CATEGORÍA
  const groupedProducts = useMemo(() => {
    const groups: Record<string, any[]> = {};
    flattenedProducts.forEach(item => {
      const otherCats = item.categories.filter(c => c !== 'Catálogo');
      if (otherCats.length === 0) {
        groups['General'] = [...(groups['General'] || []), item];
      } else {
        otherCats.forEach(cat => {
          groups[cat] = [...(groups[cat] || []), item];
        });
      }
    });
    return groups;
  }, [flattenedProducts]);

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

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-brand-500 selection:text-white pb-20">
      {/* HEADER PUBLICO */}
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
             <span className="text-[9px] font-black text-brand-700 uppercase tracking-[0.2em]">Menú Digital Oficial</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12">
        {flattenedProducts.length === 0 ? (
          <div className="py-32 text-center bg-white rounded-[4rem] border border-dashed border-gray-200">
            <Package size={80} className="mx-auto text-slate-200 mb-6" />
            <h2 className="text-xl font-black text-slate-300 uppercase tracking-widest">Catálogo vacío en este momento</h2>
          </div>
        ) : (
          <div className="space-y-24">
            {Object.entries(groupedProducts).map(([category, items]) => (
              <CategoryCarousel key={category} title={category} items={items} />
            ))}
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 mt-32">
        <div className="bg-slate-900 rounded-[4rem] p-12 md:p-20 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none">
             <ShoppingBag size={300} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-400 mb-4">Capibario Digital Menu</p>
          <h2 className="text-4xl font-black tracking-tighter uppercase mb-8">Gracias por su visita</h2>
          <div className="max-w-xl mx-auto p-8 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
             <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-widest">
               Este catálogo es informativo. Los precios y disponibilidad pueden variar sin previo aviso. Para pedidos a domicilio contacte al: <span className="text-white font-black underline">{businessConfig.phone}</span>
             </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// COMPONENTE CARRUSEL POR CATEGORIA
const CategoryCarousel: React.FC<{ title: string, items: any[] }> = ({ title, items }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(items.length > 4);

  const scroll = (direction: 'LEFT' | 'RIGHT') => {
    if (!scrollRef.current) return;
    const cardWidth = 320; // Aproximado con gap
    const scrollAmount = direction === 'LEFT' ? -cardWidth : cardWidth;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 10);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  return (
    <section className="relative group animate-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-end justify-between mb-8 px-2">
        <div>
           <p className="text-[10px] font-black text-brand-500 uppercase tracking-[0.3em] mb-1">Sección</p>
           <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{title}</h2>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => scroll('LEFT')}
             className={`p-3 rounded-2xl bg-white shadow-xl border border-gray-100 transition-all ${showLeft ? 'opacity-100' : 'opacity-20 cursor-default'}`}
           >
             <ChevronLeft size={20} className="text-slate-900" />
           </button>
           <button 
             onClick={() => scroll('RIGHT')}
             className={`p-3 rounded-2xl bg-white shadow-xl border border-gray-100 transition-all ${showRight ? 'opacity-100' : 'opacity-20 cursor-default'}`}
           >
             <ChevronRight size={20} className="text-slate-900" />
           </button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-6 overflow-x-auto scrollbar-hide pb-8 snap-x snap-mandatory scroll-smooth px-2"
      >
        {items.map(item => (
          <div 
            key={item.id + (item.displayName || '')} 
            className="w-[280px] md:w-[300px] shrink-0 snap-start bg-white rounded-[3rem] overflow-hidden shadow-sm border border-gray-100 hover:shadow-2xl transition-all duration-500 flex flex-col group/card"
          >
            <div className="aspect-[4/5] bg-gray-100 relative overflow-hidden">
              {item.displayImage ? (
                <img src={item.displayImage} className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110" alt={item.displayName} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Package size={64} className="opacity-20" />
                </div>
              )}
              {/* Badge de Precio Flotante */}
              <div className="absolute bottom-6 left-6 right-6">
                 <div className="bg-white/80 backdrop-blur-xl px-6 py-4 rounded-[2rem] shadow-2xl border border-white/20 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio</span>
                    <span className="text-xl font-black text-brand-600 tracking-tighter">${item.displayPrice.toFixed(2)}</span>
                 </div>
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col justify-between">
              <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg leading-tight group-hover/card:text-brand-600 transition-colors line-clamp-2">
                {item.displayName}
              </h3>
              <div className="mt-4 pt-4 border-t border-gray-50">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Disponible para pedido</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
