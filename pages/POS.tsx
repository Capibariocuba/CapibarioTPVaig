
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, Plus, Minus, Trash2, Receipt, User as UserIcon, Tag, Ticket as TicketIcon, Lock, Layers, X, AlertTriangle, Monitor } from 'lucide-react';
import { PaymentModal } from '../components/PaymentModal';
import { Currency, Ticket, Product, PaymentDetail, Coupon, ProductVariant } from '../types';

export const POS: React.FC = () => {
  const { 
    products, addToCart: storeAddToCart, cart, removeFromCart, updateQuantity, processSale, 
    rates, activeShift, openShift, clearCart, warehouses, categories,
    clients, selectedClientId, setSelectedClientId,
    posCurrency, setPosCurrency, currentUser, login, coupons, isItemLocked,
    businessConfig, activePosTerminalId, setActivePosTerminalId
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

  // LÓGICA DE TERMINAL ACTIVO Y ALMACÉN
  const activeTerminal = useMemo(() => {
    return businessConfig.posTerminals?.find(t => t.id === activePosTerminalId) || businessConfig.posTerminals?.[0];
  }, [businessConfig.posTerminals, activePosTerminalId]);

  const activeWarehouseId = activeTerminal?.warehouseId || 'wh-default';

  // LÓGICA DE CATEGORÍAS ORDENADAS (Todo -> Usuario -> Catálogo)
  const sortedCategories = useMemo(() => {
    const userCats = categories.filter(c => c.name !== 'Catálogo');
    const hasCatalogo = categories.some(c => c.name === 'Catálogo');
    const list = ['Todo', ...userCats.map(c => c.name)];
    if (hasCatalogo) list.push('Catálogo');
    return list;
  }, [categories]);

  // SANEAMIENTO DE PRECIOS
  const convertPrice = (priceCUP: any) => {
    const p = Number(priceCUP) || 0;
    const rate = Number(rates[posCurrency]) || 1;
    return posCurrency === Currency.CUP ? p : p / rate;
  };

  // CÁLCULO DEFENSIVO DE SUBTOTAL
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const price = Number(item.finalPrice) || 0;
      const qty = Number(item.quantity) || 0;
      return acc + (convertPrice(price) * qty);
    }, 0);
  }, [cart, posCurrency, rates]);
  
  const cartDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'PERCENTAGE') return cartSubtotal * (Number(appliedCoupon.value || 0) / 100);
    return convertPrice(appliedCoupon.value);
  }, [appliedCoupon, cartSubtotal, posCurrency, rates]);

  const cartTotal = useMemo(() => Math.max(0, cartSubtotal - cartDiscount), [cartSubtotal, cartDiscount]);

  // FILTRADO AVANZADO (ALMACÉN + BÚSQUEDA + CATEGORÍA)
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const mWarehouse = p.warehouseId === activeWarehouseId;
      if (!mWarehouse) return false;
      const query = searchQuery.toLowerCase();
      const mSrc = p.name.toLowerCase().includes(query) || (p.sku || '').toLowerCase().includes(query);
      if (!mSrc) return false;
      const mCat = selectedCategory === 'Todo' || p.categories.includes(selectedCategory);
      return mCat;
    });
  }, [products, selectedCategory, searchQuery, activeWarehouseId]);

  const isProductLocked = (p: Product) => {
    if (!p.warehouseId) return false;
    const whIndex = warehouses.findIndex(w => w.id === p.warehouseId);
    return isItemLocked('WAREHOUSES', whIndex);
  };

  const addToCart = (p: Product, variantId?: string) => {
      if (isProductLocked(p)) return;
      if (p.variants && p.variants.length > 0 && !variantId) {
          setSelectedProductForVariants(p);
          return;
      }
      const uniqueCartId = variantId ? `${p.id}-${variantId}` : p.id;
      const existing = cart.find(item => item.cartId === uniqueCartId);
      if (existing) {
          updateQuantity(uniqueCartId, 1);
      } else {
          let itemPrice = Number(p.price) || 0;
          let itemName = p.name;
          if (variantId) {
              const variant = p.variants?.find(v => v.id === variantId);
              if (variant) {
                  itemPrice = Number(variant.price) || 0;
                  itemName = `${p.name} (${variant.name})`;
              }
          }
          storeAddToCart({ 
              ...p, 
              cartId: uniqueCartId,
              quantity: 1, 
              finalPrice: itemPrice, 
              selectedVariantId: variantId, 
              name: itemName 
          });
      }
      setSelectedProductForVariants(null);
  };

  const handlePaymentConfirm = (payments: PaymentDetail[]) => {
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
          clearCart();
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
              <button onClick={() => openShift({ CUP: 0, USD: 0, EUR: 0 })} className="w-full bg-brand-600 text-white font-black py-6 rounded-3xl hover:bg-brand-700 shadow-xl transition-all uppercase tracking-widest">Apertura Rápida</button>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-100 overflow-hidden animate-in fade-in duration-500">
      <div className="flex-1 flex flex-col h-full overflow-hidden print:hidden border-b lg:border-b-0 lg:border-r border-gray-200">
        <div className="bg-white p-4 shadow-sm z-10 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 flex-1 w-full md:max-w-xl">
            {businessConfig.posTerminals && businessConfig.posTerminals.length > 1 && (
                <div className="relative">
                    <select 
                        className="bg-gray-100 border-none rounded-2xl py-4 pl-10 pr-6 font-black text-[10px] uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-500 appearance-none cursor-pointer"
                        value={activePosTerminalId || ''}
                        onChange={e => setActivePosTerminalId(e.target.value)}
                    >
                        {businessConfig.posTerminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <Monitor size={14} className="absolute left-4 top-4.5 text-brand-600 pointer-events-none" />
                </div>
            )}
            <div className="relative flex-1">
                <Search className="absolute left-4 top-4 text-gray-300" size={20} />
                <input type="text" placeholder="Buscar por nombre o SKU..." className="w-full pl-12 pr-4 py-4 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold outline-none text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 rounded-2xl p-1 shadow-inner">
                  {['CUP', 'USD', 'EUR'].map(curr => (
                      <button key={curr} onClick={() => setPosCurrency(curr)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${posCurrency === curr ? 'bg-white shadow-md text-brand-600' : 'text-gray-400'}`}>{curr}</button>
                  ))}
              </div>
          </div>
        </div>

        <div className="bg-white px-4 pb-4 border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {sortedCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-6 py-2.5 rounded-xl whitespace-nowrap text-sm font-black transition-all ${selectedCategory === cat ? 'bg-brand-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{cat}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 scroll-smooth">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {filteredProducts.map(product => {
                const totalStock = product.variants?.length ? product.variants.reduce((a, b) => a + (Number(b.stock) || 0), 0) : (Number(product.stock) || 0);
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
                                <span className="text-[10px] font-black uppercase text-amber-600">Bloqueado</span>
                            </div>
                        </div>
                    )}
                    <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-white shadow-lg">
                        {totalStock} <span className="opacity-50">UN.</span>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-black text-slate-800 text-[10px] leading-tight mb-2 line-clamp-2 uppercase tracking-tighter">{product.name}</h3>
                    <div className="mt-auto pt-1 flex items-end justify-between">
                        <span className="font-black text-base text-brand-700">${convertPrice(product.price).toFixed(2)}</span>
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
          {cart.map((item, idx) => (
            <div key={item.cartId || `${item.id}-${idx}`} className="bg-white p-4 rounded-[1.8rem] border border-gray-100 shadow-sm flex gap-4 items-center animate-in slide-in-from-right duration-300">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex-shrink-0 overflow-hidden shadow-inner">
                  {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-slate-800 truncate text-xs uppercase tracking-tighter">{item.name}</div>
                <div className="text-brand-600 font-black text-sm">${convertPrice(item.finalPrice).toFixed(2)}</div>
              </div>
              <div className="flex items-center bg-gray-100 rounded-2xl p-1 gap-1">
                <button onClick={() => updateQuantity(item.cartId, -1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-white rounded-xl transition-colors"><Minus size={14} /></button>
                {/* INPUT DIRECTO DE CANTIDAD */}
                <input 
                  type="number"
                  className="w-12 text-center bg-transparent font-black text-sm outline-none"
                  value={item.quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) updateQuantity(item.cartId, val - item.quantity);
                  }}
                  onBlur={(e) => {
                    if (!e.target.value || parseInt(e.target.value) < 1) updateQuantity(item.cartId, 1 - item.quantity);
                  }}
                />
                <button onClick={() => updateQuantity(item.cartId, 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-white rounded-xl transition-colors"><Plus size={14} /></button>
              </div>
              <button onClick={() => removeFromCart(item.cartId)} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>

        <div className="bg-white border-t border-gray-100 p-6 space-y-4 flex-shrink-0">
            <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400"><span>Subtotal</span><span>${(Number.isFinite(cartSubtotal) ? cartSubtotal : 0).toFixed(2)}</span></div>
                <div className="flex justify-between items-end pt-2 border-t border-dashed border-gray-100">
                    <span className="font-black text-xl text-slate-800 uppercase tracking-tighter">Total Cobro</span>
                    <div className="text-right">
                        <div className="font-black text-4xl text-brand-600 tracking-tighter">${(Number.isFinite(cartTotal) ? cartTotal : 0).toFixed(2)} <span className="text-xs">{posCurrency}</span></div>
                    </div>
                </div>
            </div>
            <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full bg-slate-900 hover:bg-brand-600 text-white font-black py-6 rounded-3xl shadow-2xl transition-all disabled:bg-gray-100 uppercase tracking-[0.2em] text-xs">Procesar Venta</button>
        </div>
      </div>

      {showPaymentModal && <PaymentModal total={cartTotal} currencyCode={posCurrency} onClose={() => setShowPaymentModal(false)} onConfirm={handlePaymentConfirm} />}
      
      {/* MODAL TICKET RE-VISTO */}
      {showTicketModal && currentTicket && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
              <div className="bg-white p-8 rounded-[3rem] w-full max-w-sm text-center shadow-2xl">
                  <div className="bg-emerald-50 text-emerald-600 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6"><Receipt size={40}/></div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Venta Exitosa</h3>
                  <div className="bg-gray-50 p-6 rounded-3xl mb-6 space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase text-gray-400"><span>ID Venta</span><span>{currentTicket.id.slice(-6)}</span></div>
                      <div className="flex justify-between text-xl font-black"><span>Total</span><span>${currentTicket.total.toFixed(2)} {currentTicket.currency}</span></div>
                      {/* Mostrar cambio en CUP en el ticket final */}
                      {(() => {
                        const totalPaidInSaleCurr = currentTicket.payments.reduce((a, b) => a + b.amount, 0);
                        const overpay = totalPaidInSaleCurr - currentTicket.total;
                        if (overpay > 0.01) {
                            const rate = Number(rates['CUP']) / Number(rates[currentTicket.currency]); // Relativo
                            // Simulación rápida para UI ya que la función convert está en context
                            const changeCUP = overpay * (rates[currentTicket.currency] || 1);
                            return <div className="flex justify-between text-emerald-600 font-black"><span>Cambio (CUP)</span><span>₱{changeCUP.toFixed(2)}</span></div>;
                        }
                        return null;
                      })()}
                  </div>
                  <button onClick={() => setShowTicketModal(false)} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase text-xs">Finalizar</button>
              </div>
          </div>
      )}
    </div>
  );
};
