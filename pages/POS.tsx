
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    Search, Plus, Minus, Trash2, Receipt, User as UserIcon, Tag, Ticket as TicketIcon, 
    Lock, Layers, X, AlertTriangle, Monitor, ChevronRight, CheckCircle, Percent, Wallet, DollarSign, Calendar, Zap
} from 'lucide-react';
import { PaymentModal } from '../components/PaymentModal';
import { Currency, Ticket, Product, PaymentDetail, Coupon, ProductVariant, Client } from '../types';

export const POS: React.FC = () => {
  const { 
    products, addToCart: storeAddToCart, cart, removeFromCart, updateQuantity, processSale, 
    rates, activeShift, openShift, clearCart, warehouses, categories,
    clients, selectedClientId, setSelectedClientId,
    posCurrency, setPosCurrency, currentUser, login, coupons, isItemLocked,
    businessConfig, activePosTerminalId, setActivePosTerminalId, notify, currencies
  } = useStore();
  
  // --- ESTADOS LOCALES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [isTicketOpen, setIsTicketOpen] = useState(false); // Móvil
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<Product | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // --- LÓGICA DE ALMACÉN Y TERMINAL ---
  const activeTerminal = useMemo(() => {
    return businessConfig.posTerminals?.find(t => t.id === activePosTerminalId) || businessConfig.posTerminals?.[0];
  }, [businessConfig.posTerminals, activePosTerminalId]);

  const activeWarehouseId = activeTerminal?.warehouseId || 'wh-default';

  // --- FILTRADO DE PRODUCTOS ---
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p.warehouseId !== activeWarehouseId || p.hidden) return false;
      const query = searchQuery.toLowerCase();
      const mName = p.name.toLowerCase().includes(query);
      const mSku = (p.sku || '').toLowerCase().includes(query);
      const mPrice = !isNaN(Number(query)) && query.length > 0 ? p.price.toString().includes(query) : false;
      const mCat = selectedCategory === 'Todo' || p.categories.includes(selectedCategory);
      return (mName || mSku || mPrice) && mCat;
    });
  }, [products, searchQuery, selectedCategory, activeWarehouseId]);

  // --- CÁLCULOS DEL TICKET ---
  const getEffectiveUnitPrice = (item: any) => {
    const p = products.find(prod => prod.id === item.id);
    if (!p) return item.finalPrice;
    
    const targetId = item.selectedVariantId || 'PARENT';
    const activeRules = p.pricingRules?.filter(r => 
        r.isActive !== false && 
        r.targetId === targetId &&
        item.quantity >= r.minQuantity &&
        item.quantity <= r.maxQuantity
    ) || [];

    if (activeRules.length > 0) return activeRules[0].newPrice;
    return item.selectedVariantId ? (p.variants.find(v => v.id === item.selectedVariantId)?.price || p.price) : p.price;
  };

  const convertValue = (valCUP: number) => {
    const rate = rates[posCurrency] || 1;
    return posCurrency === 'CUP' ? valCUP : valCUP / rate;
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (convertValue(getEffectiveUnitPrice(item)) * item.quantity), 0);
  }, [cart, posCurrency, rates]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'PERCENTAGE') return cartSubtotal * (appliedCoupon.value / 100);
    return convertValue(appliedCoupon.value);
  }, [appliedCoupon, cartSubtotal, posCurrency, rates]);

  const cartTotal = useMemo(() => Math.max(0, cartSubtotal - discountAmount), [cartSubtotal, discountAmount]);

  // --- ACCIONES ---
  const handleAddToCart = (p: Product, vId?: string) => {
    if (p.variants?.length > 0 && !vId) {
        setSelectedProductForVariants(p);
        return;
    }
    const cartId = vId ? `${p.id}-${vId}` : p.id;
    const existing = cart.find(i => i.cartId === cartId);
    if (existing) {
        updateQuantity(cartId, 1);
    } else {
        const name = vId ? `${p.name} (${p.variants.find(v => v.id === vId)?.name})` : p.name;
        const price = vId ? p.variants.find(v => v.id === vId)!.price : p.price;
        storeAddToCart({ ...p, cartId, quantity: 1, finalPrice: price, selectedVariantId: vId, name });
    }
    setSelectedProductForVariants(null);
  };

  const handleApplyCoupon = () => {
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) return;
    const found = coupons.find(c => c.code.toUpperCase() === code);
    if (!found) { notify("Cupón no encontrado", "error"); return; }
    
    const now = new Date();
    if (found.isSuspended) { notify("Cupón suspendido", "error"); return; }
    if (now < new Date(found.startDate) || now > new Date(found.endDate)) { notify("Cupón fuera de vigencia", "error"); return; }
    if (found.usageLimit > 0 && found.currentUsages >= found.usageLimit) { notify("Límite de usos alcanzado", "error"); return; }
    if (found.minInvoiceAmount && cartSubtotal < convertValue(found.minInvoiceAmount)) { notify(`Mínimo de compra: $${found.minInvoiceAmount} CUP`, "error"); return; }
    
    if (found.targetType === 'CLIENT' && found.targetId !== selectedClientId) { notify("Este cupón es para otro cliente", "error"); return; }
    if (found.targetType === 'GROUP') {
        const client = clients.find(c => c.id === selectedClientId);
        if (client?.groupId !== found.targetId) { notify("No pertenece al grupo del cupón", "error"); return; }
    }
    if (found.productIds?.length && !cart.some(i => found.productIds?.includes(i.id))) { notify("No incluye productos de la promoción", "error"); return; }

    setAppliedCoupon(found);
    notify("Cupón aplicado", "success");
    setCouponCodeInput('');
  };

  const handleConfirmSale = (payments: PaymentDetail[]) => {
    const ticket = processSale({
        items: cart, subtotal: cartSubtotal, discount: discountAmount, total: cartTotal,
        payments, currency: posCurrency, clientId: selectedClientId, appliedCouponId: appliedCoupon?.id
    });
    if (ticket) {
        setCurrentTicket(ticket);
        setShowTicketModal(true);
        clearCart();
        setAppliedCoupon(null);
        setSelectedClientId(null);
        setShowPaymentModal(false);
    }
  };

  if (!currentUser) return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-sm w-full border border-gray-100">
              <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-8 text-brand-600 shadow-inner"><Lock size={40} /></div>
              <h2 className="text-2xl font-black mb-2 text-slate-800 uppercase tracking-tighter">Terminal Bloqueada</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10">Introduzca su PIN de Operador</p>
              <input type="password" autoFocus className="bg-gray-50 border-none p-6 rounded-3xl text-center text-4xl mb-8 w-full font-black outline-none focus:ring-4 focus:ring-brand-500/20" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} maxLength={4} onKeyDown={e => e.key === 'Enter' && (login(searchQuery), setSearchQuery(''))} />
              <button onClick={() => { if(login(searchQuery)) setSearchQuery(''); }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-slate-200">Acceder</button>
          </div>
      </div>
  );

  if (!activeShift) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <div className="bg-white p-12 rounded-[4rem] shadow-2xl max-w-lg w-full border border-gray-100">
            <div className="bg-brand-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-brand-600 shadow-inner"><Monitor size={48} /></div>
            <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tighter uppercase">Caja Cerrada</h1>
            <p className="text-slate-400 font-bold mb-12 text-sm uppercase tracking-widest leading-relaxed">El sistema requiere la apertura de un turno fiscal para operar el TPV.</p>
            <button onClick={() => openShift({ CUP: 0, USD: 0, EUR: 0 })} className="w-full bg-slate-900 text-white font-black py-7 rounded-[2rem] hover:bg-brand-600 shadow-2xl transition-all uppercase tracking-[0.3em] text-xs">Apertura Maestra</button>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden relative font-sans animate-in fade-in duration-500">
        
        {/* --- COLUMNA IZQUIERDA: CATÁLOGO (GRID 7x4) --- */}
        <div className="flex-1 flex flex-col h-full bg-gray-50 border-r border-gray-200">
            {/* Header POS: Búsqueda y Monedas */}
            <div className="bg-white p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-4 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={18} />
                    <input 
                        className="w-full bg-gray-100 border-none p-4 pl-12 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500/20" 
                        placeholder="Buscar por Nombre, SKU o Precio..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex bg-gray-100 p-1 rounded-2xl gap-1">
                    {currencies.map(c => (
                        <button 
                            key={c.code} 
                            onClick={() => setPosCurrency(c.code)}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${posCurrency === c.code ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:bg-gray-200'}`}
                        >
                            {c.code}
                        </button>
                    ))}
                </div>
            </div>

            {/* Categorías */}
            <div className="bg-white px-4 pb-4 border-b border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
                {['Todo', ...categories.map(c => c.name)].map(cat => (
                    <button 
                        key={cat} 
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-6 py-2.5 rounded-xl whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-50 text-slate-400 hover:bg-gray-100'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Catálogo Grid 7x4 Desktop */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {filteredProducts.map(p => {
                        const effectivePrice = convertValue(p.price);
                        const stock = p.stock || 0;
                        return (
                            <button 
                                key={p.id}
                                onClick={() => handleAddToCart(p)}
                                disabled={stock <= 0}
                                className={`bg-white rounded-3xl border border-slate-100 p-2 text-left flex flex-col h-auto group hover:shadow-xl hover:-translate-y-1 transition-all ${stock <= 0 ? 'opacity-50 grayscale' : ''}`}
                            >
                                <div className="aspect-square bg-gray-50 rounded-2xl mb-3 overflow-hidden relative">
                                    {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Layers className="w-full h-full p-4 text-slate-200" />}
                                    <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[8px] font-black text-white">{stock} UN</div>
                                    {p.variants?.length > 0 && <div className="absolute bottom-2 left-2 bg-brand-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Variantes</div>}
                                </div>
                                <h3 className="text-[9px] font-black text-slate-800 uppercase line-clamp-2 leading-tight mb-2 flex-1 tracking-tighter">{p.name}</h3>
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-xs text-brand-600">{currencies.find(c => c.code === posCurrency)?.symbol}{effectivePrice.toFixed(2)}</span>
                                    <div className="bg-gray-100 p-1.5 rounded-lg text-slate-400 group-hover:bg-brand-500 group-hover:text-white transition-colors"><Plus size={12}/></div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* --- COLUMNA DERECHA: TICKET (SIDEBAR DESKTOP / DRAWER MÓVIL) --- */}
        <div className={`
            fixed lg:relative inset-y-0 right-0 w-full lg:w-[420px] bg-white shadow-2xl flex flex-col z-[80] transition-transform duration-500
            ${isTicketOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
            {/* Header Ticket */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <h2 className="text-lg font-black uppercase tracking-[0.2em] flex items-center gap-3"><Receipt className="text-brand-400" /> Ticket</h2>
                <div className="flex gap-2">
                    <button onClick={clearCart} className="p-3 bg-white/10 hover:bg-red-500/20 rounded-2xl transition-colors"><Trash2 size={18}/></button>
                    <button onClick={() => setIsTicketOpen(false)} className="lg:hidden p-3 bg-white/10 rounded-2xl"><X size={18}/></button>
                </div>
            </div>

            {/* Cliente en Ticket */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-100 text-brand-600 p-2.5 rounded-xl"><UserIcon size={18}/></div>
                    <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cliente Seleccionado</p>
                        <h4 className="text-[11px] font-black text-slate-800 uppercase">{selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : 'Venta Genérica'}</h4>
                    </div>
                </div>
                <button onClick={() => setIsClientModalOpen(true)} className="text-brand-600 font-black text-[9px] uppercase tracking-widest hover:underline">Cambiar</button>
            </div>

            {/* Listado de Ítems */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50 custom-scrollbar">
                {cart.map(item => {
                    const unitPrice = getEffectiveUnitPrice(item);
                    const isRuleApplied = unitPrice !== (item.selectedVariantId ? products.find(p => p.id === item.id)?.variants.find(v => v.id === item.selectedVariantId)?.price : products.find(p => p.id === item.id)?.price);
                    
                    return (
                        <div key={item.cartId} className="bg-white p-4 rounded-3xl border border-slate-100 flex gap-4 items-center animate-in slide-in-from-right">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 relative">
                                {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Layers className="p-2 text-slate-300 w-full h-full" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-black text-[10px] text-slate-800 uppercase truncate mb-0.5">{item.name}</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-brand-600 font-black text-xs">{currencies.find(c => c.code === posCurrency)?.symbol}{convertValue(unitPrice).toFixed(2)}</span>
                                    {isRuleApplied && <span className="bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded text-[7px] font-black uppercase flex items-center gap-1"><Zap size={8}/> Regla Aplicada</span>}
                                </div>
                            </div>
                            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-2">
                                <button onClick={() => updateQuantity(item.cartId, -1)} className="w-7 h-7 flex items-center justify-center text-slate-400 bg-white rounded-lg shadow-sm"><Minus size={12}/></button>
                                <span className="w-6 text-center font-black text-[11px] text-slate-700">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.cartId, 1)} className="w-7 h-7 flex items-center justify-center text-slate-400 bg-white rounded-lg shadow-sm"><Plus size={12}/></button>
                            </div>
                            <button onClick={() => removeFromCart(item.cartId)} className="text-slate-300 hover:text-red-500 p-1"><X size={16}/></button>
                        </div>
                    );
                })}
                {cart.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                        <Receipt size={64} className="mb-4" />
                        <p className="font-black uppercase tracking-widest text-xs">Ticket Vacío</p>
                    </div>
                )}
            </div>

            {/* Cupones y Totales */}
            <div className="p-6 bg-white border-t border-gray-100 space-y-4">
                {/* Input Cupón */}
                {!appliedCoupon ? (
                    <div className="flex gap-2">
                        <input 
                            className="flex-1 bg-gray-50 border-none p-3 px-4 rounded-xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-brand-500/20" 
                            placeholder="CÓDIGO CUPÓN" 
                            value={couponCodeInput}
                            onChange={e => setCouponCodeInput(e.target.value)}
                        />
                        <button onClick={handleApplyCoupon} className="bg-slate-900 text-white px-5 rounded-xl font-black text-[9px] uppercase tracking-widest">Aplicar</button>
                    </div>
                ) : (
                    <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg text-emerald-600"><Percent size={14}/></div>
                            <div>
                                <p className="text-[8px] font-black text-emerald-600 uppercase">Cupón Activo</p>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase">{appliedCoupon.name}</h4>
                            </div>
                        </div>
                        <button onClick={() => setAppliedCoupon(null)} className="text-red-400 p-2"><Trash2 size={14}/></button>
                    </div>
                )}

                <div className="space-y-2 border-b border-gray-100 pb-4">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>Subtotal</span><span>{currencies.find(c => c.code === posCurrency)?.symbol}{cartSubtotal.toFixed(2)}</span></div>
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-[10px] font-black text-emerald-600 uppercase tracking-widest"><span>Descuento</span><span>-{currencies.find(c => c.code === posCurrency)?.symbol}{discountAmount.toFixed(2)}</span></div>
                    )}
                </div>

                <div className="flex justify-between items-center">
                    <span className="font-black text-sm uppercase tracking-widest text-slate-400">Total a Pagar</span>
                    <span className="text-3xl font-black text-slate-900 tracking-tighter">{currencies.find(c => c.code === posCurrency)?.symbol}{cartTotal.toFixed(2)}</span>
                </div>

                <button 
                    disabled={cart.length === 0}
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl hover:bg-brand-600 transition-all uppercase tracking-[0.3em] text-[10px] disabled:opacity-50"
                >
                    Procesar Cobro
                </button>
            </div>
        </div>

        {/* --- MINI TICKET MÓVIL --- */}
        {!isTicketOpen && (
            <div className="lg:hidden fixed bottom-0 inset-x-0 h-20 bg-slate-900 text-white flex items-center px-6 justify-between shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-[70] animate-in slide-in-from-bottom">
                <div className="flex items-center gap-4">
                    <div className="bg-brand-500 p-3 rounded-2xl"><Receipt size={20}/></div>
                    <div>
                        <p className="text-[8px] font-black uppercase text-brand-400">Carrito ({cart.length} ítems)</p>
                        <h4 className="text-xl font-black tracking-tighter">{currencies.find(c => c.code === posCurrency)?.symbol}{cartTotal.toFixed(2)}</h4>
                    </div>
                </div>
                <button onClick={() => setIsTicketOpen(true)} className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2">Abrir <ChevronRight size={14}/></button>
            </div>
        )}

        {/* --- MODAL SELECTOR VARIANTES --- */}
        {selectedProductForVariants && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
                <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tighter">Seleccionar Variante</h3>
                            <p className="text-[10px] text-brand-400 font-bold uppercase">{selectedProductForVariants.name}</p>
                        </div>
                        <button onClick={() => setSelectedProductForVariants(null)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
                    </div>
                    <div className="p-8 grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto">
                        {selectedProductForVariants.variants.map(v => (
                            <button 
                                key={v.id} 
                                onClick={() => handleAddToCart(selectedProductForVariants, v.id)}
                                className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl hover:bg-brand-50 hover:border-brand-100 border border-transparent transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: v.color || '#ddd' }}></div>
                                    <span className="font-black text-slate-700 uppercase text-xs">{v.name}</span>
                                </div>
                                <span className="font-black text-brand-600 group-hover:scale-110 transition-transform">{currencies.find(c => c.code === posCurrency)?.symbol}{convertValue(v.price).toFixed(2)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* --- MODAL SELECTOR CLIENTES --- */}
        {isClientModalOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
                <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in h-[70vh] flex flex-col">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black uppercase tracking-tighter">Vincular Cliente</h3>
                        <button onClick={() => setIsClientModalOpen(false)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
                    </div>
                    <div className="p-6 bg-gray-50 border-b border-gray-100 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-4 top-3 text-slate-300" size={18} />
                            <input className="w-full bg-white p-3 pl-12 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-brand-500/20 font-bold" placeholder="Buscar cliente por nombre o móvil..." />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        <button onClick={() => { setSelectedClientId(null); setIsClientModalOpen(false); }} className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-100 text-slate-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Consumidor Final (Sin Registro)</button>
                        {clients.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => { setSelectedClientId(c.id); setIsClientModalOpen(false); }}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedClientId === c.id ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-100 hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center gap-4 text-left">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black">{c.name.charAt(0)}</div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tighter">{c.name}</h4>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">{c.phone || 'Sin teléfono'}</p>
                                    </div>
                                </div>
                                {selectedClientId === c.id && <CheckCircle size={20} className="text-brand-500"/>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {showPaymentModal && (
            <PaymentModal 
                total={cartTotal} 
                currencyCode={posCurrency} 
                onClose={() => setShowPaymentModal(false)} 
                onConfirm={handleConfirmSale} 
            />
        )}

        {showTicketModal && currentTicket && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[300] p-4">
                <div className="bg-white p-10 rounded-[4rem] w-full max-w-sm text-center shadow-2xl animate-in zoom-in">
                    <div className="bg-emerald-50 text-emerald-600 p-8 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-8 shadow-inner"><Receipt size={48}/></div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Venta Exitosa</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-10">Comprobante ID: {currentTicket.id.slice(-6)}</p>
                    <button onClick={() => setShowTicketModal(false)} className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] uppercase tracking-[0.2em] text-xs shadow-xl">Finalizar</button>
                </div>
            </div>
        )}

    </div>
  );
};
