
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { CATEGORIES } from '../constants';
import { Search, Plus, Minus, Trash2, Receipt, User as UserIcon, Tag, Ticket as TicketIcon, Lock, Layers, X, AlertTriangle } from 'lucide-react';
import { PaymentModal } from '../components/PaymentModal';
import { Currency, Ticket, Product, PaymentDetail, Coupon, ProductVariant } from '../types';

export const POS: React.FC = () => {
  const { 
    products, addToCart: storeAddToCart, cart, removeFromCart, updateQuantity, processSale, 
    rates, activeShift, openShift, clearCart, warehouses,
    clients, selectedClientId, setSelectedClientId,
    posCurrency, setPosCurrency, currentUser, login, coupons, isItemLocked
  } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [ticketNote, setTicketNote] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  const [selectedProductForVariants, setSelectedProductForVariants] = useState<Product | null>(null);

  const convertPrice = (priceCUP: number) => posCurrency === Currency.CUP ? priceCUP : priceCUP / rates[posCurrency];

  const cartSubtotal = cart.reduce((acc, item) => acc + (convertPrice(item.finalPrice) * item.quantity), 0);
  
  const cartDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'PERCENTAGE') return cartSubtotal * (appliedCoupon.value / 100);
    return convertPrice(appliedCoupon.value);
  }, [appliedCoupon, cartSubtotal, posCurrency, rates]);

  const cartTotal = Math.max(0, cartSubtotal - cartDiscount);

  const filteredProducts = useMemo(() => products.filter(p => {
    const mCat = selectedCategory === 'Todo' || p.category === selectedCategory;
    const mSrc = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return mCat && mSrc;
  }), [products, selectedCategory, searchQuery]);

  const isProductLocked = (p: Product) => {
    if (!p.batches || p.batches.length === 0) return false;
    const whId = p.batches[0].warehouseId;
    if (!whId) return false;
    const whIndex = warehouses.findIndex(w => w.id === whId);
    return isItemLocked('WAREHOUSES', whIndex);
  };

  const addToCart = (p: Product, variantId?: string) => {
      if (isProductLocked(p)) return;

      if (p.variants && p.variants.length > 0 && !variantId) {
          setSelectedProductForVariants(p);
          return;
      }

      if (variantId) {
          const variant = p.variants?.find(v => v.id === variantId);
          if (variant) {
              const existing = cart.find(item => item.id === p.id && item.selectedVariantId === variantId);
              if (existing) {
                  updateQuantity(existing.cartId, 1);
              } else {
                  storeAddToCart({ ...p, price: variant.price, finalPrice: variant.price, selectedVariantId: variantId, name: `${p.name} (${variant.value})` });
              }
          }
      } else {
          storeAddToCart(p);
      }
      setSelectedProductForVariants(null);
  };

  const handlePaymentConfirm = (payments: PaymentDetail[]) => {
      try {
        const ticket = processSale({
            items: cart, subtotal: cartSubtotal, discount: cartDiscount, total: cartTotal,
            payments, currency: posCurrency, note: ticketNote, appliedCouponId: appliedCoupon?.id
        });
        if (ticket) {
            setShowPaymentModal(false);
            setCurrentTicket(ticket);
            setShowTicketModal(true);
            setTicketNote('');
            setAppliedCoupon(null);
        }
      } catch (e) {
          // El error se maneja en el Context
          setShowPaymentModal(false);
      }
  };

  if (!currentUser) return (
      <div className="h-full flex items-center justify-center bg-gray-200 p-4">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center border border-gray-100 max-w-sm w-full">
              <h2 className="text-2xl font-black mb-6 text-gray-800">Acceso TPV</h2>
              <input type="password" placeholder="PIN" className="bg-gray-100 border-none p-6 rounded-3xl text-center text-4xl mb-6 w-full font-black outline-none focus:ring-4 focus:ring-brand-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} maxLength={4} />
              <button onClick={() => { if(login(searchQuery)) setSearchQuery(''); }} className="bg-brand-600 text-white w-full py-5 rounded-3xl font-black uppercase tracking-widest shadow-lg">Entrar</button>
          </div>
      </div>
  );

  if (!activeShift) return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-lg w-full">
              <div className="bg-brand-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-brand-600 shadow-inner"><Lock size={48} /></div>
              <h1 className="text-3xl font-black text-gray-800 mb-2">Caja Cerrada</h1>
              <p className="text-gray-400 font-bold mb-10">Debes abrir turno para comenzar a vender.</p>
              <button onClick={() => openShift({ [Currency.CUP]: 0, [Currency.USD]: 0, [Currency.EUR]: 0, [Currency.MLC]: 0 })} className="w-full bg-brand-600 text-white font-black py-6 rounded-3xl hover:bg-brand-700 shadow-xl transition-all uppercase tracking-widest">Apertura Rápida</button>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-100 overflow-hidden animate-in fade-in duration-500">
      <div className="flex-1 flex flex-col h-full overflow-hidden print:hidden border-b lg:border-b-0 lg:border-r border-gray-200">
        <div className="bg-white p-4 shadow-sm z-10 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:flex-1 md:max-w-md">
            <Search className="absolute left-4 top-4 text-gray-300" size={20} />
            <input type="text" placeholder="Buscar producto o SKU..." className="w-full pl-12 pr-4 py-4 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold outline-none text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 rounded-2xl p-1 shadow-inner">
                  {Object.keys(Currency).map(curr => (
                      <button key={curr} onClick={() => setPosCurrency(curr as Currency)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${posCurrency === curr ? 'bg-white shadow-md text-brand-600' : 'text-gray-400'}`}>{curr}</button>
                  ))}
              </div>
          </div>
        </div>

        <div className="bg-white px-4 pb-4 border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-6 py-2.5 rounded-xl whitespace-nowrap text-sm font-black transition-all ${selectedCategory === cat ? 'bg-brand-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{cat}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filteredProducts.map(product => {
                const totalStock = product.variants?.length ? product.variants.reduce((a, b) => a + b.stock, 0) : (product.batches?.reduce((a, b) => a + b.quantity, 0) || 0);
                const locked = isProductLocked(product);
                
                return (
                <button 
                    key={product.id} 
                    onClick={() => addToCart(product)} 
                    disabled={totalStock <= 0 || locked} 
                    className={`bg-white rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all text-left overflow-hidden flex flex-col h-full border border-gray-100 relative group ${totalStock <= 0 || locked ? 'opacity-50 grayscale' : ''}`}
                >
                  <div className="aspect-square bg-gray-100 relative w-full overflow-hidden">
                    {product.image && <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />}
                    
                    {locked && (
                        <div className="absolute inset-0 bg-amber-500/40 backdrop-blur-[2px] flex items-center justify-center p-4">
                            <div className="bg-white p-3 rounded-2xl shadow-2xl flex items-center gap-2">
                                <Lock size={16} className="text-amber-600" />
                                <span className="text-[10px] font-black uppercase text-amber-600">Almacén Bloqueado</span>
                            </div>
                        </div>
                    )}

                    <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-white shadow-lg">
                        {totalStock} <span className="opacity-50">UN.</span>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-black text-slate-800 text-sm leading-tight mb-2 line-clamp-2 uppercase tracking-tighter">{product.name}</h3>
                    <div className="mt-auto pt-2 flex items-end justify-between">
                        <span className="font-black text-xl text-brand-700">${convertPrice(product.price).toFixed(2)}</span>
                        <span className="text-[10px] font-black text-gray-300 uppercase">{posCurrency}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[450px] bg-white shadow-2xl flex flex-col h-[50vh] lg:h-full z-20 relative">
        <div className="p-8 bg-slate-900 text-white shadow-xl relative overflow-hidden flex-shrink-0">
            <div className="relative z-10 flex justify-between items-center">
                <h2 className="font-black flex items-center gap-3 text-lg uppercase tracking-widest"><Receipt size={24} className="text-brand-400" /> Carrito Maestro</h2>
                <button onClick={clearCart} className="p-3 hover:bg-slate-800 rounded-2xl transition-colors"><Trash2 size={20}/></button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {cart.map(item => (
            <div key={item.cartId} className="bg-white p-4 rounded-[1.8rem] border border-gray-100 shadow-sm flex gap-4 items-center animate-in slide-in-from-right duration-300">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex-shrink-0 overflow-hidden shadow-inner">
                  {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-slate-800 truncate text-xs uppercase tracking-tighter">{item.name}</div>
                <div className="text-brand-600 font-black text-sm">${convertPrice(item.finalPrice).toFixed(2)}</div>
              </div>
              <div className="flex items-center bg-gray-100 rounded-2xl p-1 gap-1">
                <button onClick={() => updateQuantity(item.cartId, -1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-white rounded-xl transition-colors"><Minus size={14} /></button>
                <span className="w-6 text-center font-black text-sm">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.cartId, 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-white rounded-xl transition-colors"><Plus size={14} /></button>
              </div>
              <button onClick={() => removeFromCart(item.cartId)} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-6 pt-20">
                <div className="bg-gray-100 p-10 rounded-[3rem] shadow-inner border border-gray-200"><Receipt size={64} className="opacity-20" /></div>
                <p className="font-black uppercase tracking-widest text-xs">Añada productos al carrito</p>
            </div>
          )}
        </div>

        <div className="bg-white border-t border-gray-100 p-6 space-y-4 flex-shrink-0">
            <div className="grid grid-cols-2 gap-3">
                 <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-brand-200 transition-all cursor-pointer overflow-hidden">
                    <UserIcon className="text-gray-400 flex-shrink-0" size={18} />
                    <select className="bg-transparent text-[10px] font-black text-slate-800 outline-none flex-1 appearance-none uppercase" value={selectedClientId || ''} onChange={e => setSelectedClientId(e.target.value || null)}>
                        <option value="">Cliente Ocasional</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div onClick={() => setShowCouponModal(true)} className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${appliedCoupon ? 'bg-brand-50 border-brand-200 text-brand-600' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-brand-200'}`}>
                    {appliedCoupon ? <TicketIcon size={18}/> : <Tag size={18}/>}
                    <span className="text-[10px] font-black uppercase truncate tracking-widest">{appliedCoupon ? appliedCoupon.code : 'Cupón'}</span>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400"><span>Subtotal</span><span>${cartSubtotal.toFixed(2)}</span></div>
                {appliedCoupon && <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-emerald-500"><span>Descuento</span><span>-${cartDiscount.toFixed(2)}</span></div>}
                <div className="flex justify-between items-end pt-2 border-t border-dashed border-gray-100">
                    <span className="font-black text-xl text-slate-800 uppercase tracking-tighter">Total Cobro</span>
                    <div className="text-right">
                        <div className="font-black text-4xl text-brand-600 tracking-tighter">${cartTotal.toFixed(2)} <span className="text-xs">{posCurrency}</span></div>
                    </div>
                </div>
            </div>

            <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full bg-slate-900 hover:bg-brand-600 text-white font-black py-6 rounded-3xl shadow-2xl transition-all disabled:bg-gray-100 uppercase tracking-[0.2em] text-xs">Procesar Venta</button>
        </div>
      </div>

      {showPaymentModal && <PaymentModal total={cartTotal} currencyCode={posCurrency} onClose={() => setShowPaymentModal(false)} onConfirm={handlePaymentConfirm} />}
    </div>
  );
};
