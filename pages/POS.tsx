
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    Search, Plus, Minus, Trash2, Receipt, User as UserIcon, Tag, Ticket as TicketIcon, 
    Lock, Unlock, Layers, X, AlertTriangle, Monitor, ChevronRight, CheckCircle, Percent, Wallet, DollarSign, Calendar, Zap, Package, LogOut, Printer, FileDown, Sparkles, Gift, ArrowLeft, History, RefreshCcw, Key, Box
} from 'lucide-react';
import { PaymentModal } from '../components/PaymentModal';
import { Currency, Ticket, Product, PaymentDetail, Coupon, ProductVariant, Client, View, BogoOffer, Sale, RefundItem, User, Role } from '../types';
import { ShiftManager } from './ShiftManager';
import { jsPDF } from 'jspdf';
import { escapeHtml, safeText } from '../utils/escapeHtml';

export const POS: React.FC = () => {
  const { 
    products, addToCart: storeAddToCart, cart, removeFromCart, updateQuantity, processSale, 
    rates, activeShift, openShift, clearCart, warehouses, categories, setView,
    clients, selectedClientId, setSelectedClientId,
    posCurrency, setPosCurrency, currentUser, login, coupons, bogoOffers, isItemLocked,
    businessConfig, activePosTerminalId, setActivePosTerminalId, notify, currencies,
    sales, processRefund, validatePin
  } = useStore();
  
  void escapeHtml; // Uso neutro para cumplir con importación literal obligatoria

  // --- UTILIDADES DE PRECISIÓN ---
  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
  const formatNum = (num: number) => new Intl.NumberFormat('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

  // --- ESTADOS LOCALES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [isTicketOpen, setIsTicketOpen] = useState(false); // Móvil
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [showShiftManager, setShowShiftManager] = useState(false);
  
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<Product | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // NUEVOS ESTADOS FASE ÓRDENES
  const [activeRightTab, setActiveRightTab] = useState<'CART' | 'ORDERS'>('CART');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Sale | null>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundQtys, setRefundQtys] = useState<Record<string, number>>({});
  const [refundSource, setRefundSource] = useState<'CASHBOX' | 'OUTSIDE_CASHBOX'>('CASHBOX');
  const [showAuthPinModal, setShowAuthPinModal] = useState(false);
  const [authPin, setAuthPin] = useState('');

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

  // --- FILTRADO DE ÓRDENES ---
  const filteredOrders = useMemo(() => {
    const q = orderSearch.toLowerCase();
    return [...sales].reverse().filter(s => 
        s.id.toLowerCase().includes(q) || 
        (s.clientId && clients.find(c => c.id === s.clientId)?.name.toLowerCase().includes(q))
    );
  }, [sales, orderSearch, clients]);

  // --- ACCIONES ---
  const handleAddToCart = (p: Product, vId?: string, isBase: boolean = false) => {
    if (p.variants?.length > 0 && !vId && !isBase) {
        setSelectedProductForVariants(p);
        return;
    }

    const cartId = vId ? `${p.id}-${vId}` : p.id;
    const existing = cart.find(i => i.cartId === cartId);
    const stockAvailable = vId 
        ? (p.variants.find(v => v.id === vId)?.stock || 0)
        : (p.stock || 0);

    const currentQtyInCart = existing?.quantity || 0;
    if (currentQtyInCart + 1 > stockAvailable) {
        notify(`Stock insuficiente: ${stockAvailable} disponibles`, "error");
        return;
    }

    if (existing) {
        updateQuantity(cartId, 1);
    } else {
        const variant = vId ? p.variants.find(v => v.id === vId) : null;
        const name = variant ? `${p.name} (${variant.name})` : p.name;
        const price = variant ? variant.price : p.price;
        const image = variant?.image || p.image;
        
        storeAddToCart({ 
            ...p, 
            cartId, 
            id: p.id,
            quantity: 1, 
            finalPrice: price, 
            selectedVariantId: vId, 
            name,
            image
        });
    }
    setSelectedProductForVariants(null);
  };

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
    const sum = cart.reduce((acc, item) => acc + (convertValue(getEffectiveUnitPrice(item)) * item.quantity), 0);
    return round2(sum);
  }, [cart, posCurrency, rates]);

  // --- MOTOR DE OFERTAS BOGO ---
  const bogoInfo = useMemo(() => {
    let totalDiscount = 0;
    let totalApps = 0;
    const now = new Date();
    const activeBogoOffers = bogoOffers.filter(o => 
        o.status === 'ACTIVE' && now >= new Date(o.startAt) && now <= new Date(o.endAt)
    );
    activeBogoOffers.forEach(offer => {
        const triggerItem = cart.find(i => i.id === offer.buyProductId && !i.selectedVariantId);
        const rewardItem = cart.find(i => i.id === offer.getProductId && !i.selectedVariantId);
        if (triggerItem && rewardItem) {
            const applications = Math.floor(triggerItem.quantity / offer.buyQty);
            const rewardAvailable = rewardItem.quantity;
            const effectiveApps = Math.min(applications, Math.floor(rewardAvailable / offer.getQty));
            if (effectiveApps > 0) {
                const unitPriceCUP = getEffectiveUnitPrice(rewardItem);
                const unitPriceCurrent = convertValue(unitPriceCUP);
                let discountPerApp = 0;
                if (offer.rewardType === 'FREE') discountPerApp = unitPriceCurrent * offer.getQty;
                else if (offer.rewardType === 'PERCENT_DISCOUNT') discountPerApp = (unitPriceCurrent * (offer.rewardValue / 100)) * offer.getQty;
                else if (offer.rewardType === 'FIXED_PRICE') {
                    const priceDiff = unitPriceCurrent - convertValue(offer.rewardValue);
                    discountPerApp = Math.max(0, priceDiff) * offer.getQty;
                }
                totalDiscount += discountPerApp * effectiveApps;
                totalApps += effectiveApps;
            }
        }
    });
    return { totalDiscount: round2(totalDiscount), totalApps };
  }, [cart, bogoOffers, posCurrency, rates]);

  const couponDiscountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    let disc = 0;
    if (appliedCoupon.type === 'PERCENTAGE') disc = cartSubtotal * (appliedCoupon.value / 100);
    else disc = convertValue(appliedCoupon.value);
    return round2(disc);
  }, [appliedCoupon, cartSubtotal, posCurrency, rates]);

  const cartTotal = useMemo(() => {
    const afterBogo = cartSubtotal - bogoInfo.totalDiscount;
    return round2(Math.max(0, afterBogo - couponDiscountAmount));
  }, [cartSubtotal, bogoInfo.totalDiscount, couponDiscountAmount]);

  // --- ACCIONES DE FIDELIZACIÓN ---
  const handleApplyCoupon = () => {
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) return;
    const found = coupons.find(c => c.code.toUpperCase() === code);
    if (!found) { notify("Cupón no encontrado", "error"); return; }
    const now = new Date();
    if (found.isSuspended) { notify("Cupón suspendido", "error"); return; }
    if (now < new Date(found.startDate) || now > new Date(found.endDate)) { notify("Cupón fuera de vigencia", "error"); return; }
    if (found.usageLimit > 0 && found.currentUsages >= found.usageLimit) { notify("Límite de usos alcanzado", "error"); return; }
    const minNeeded = convertValue(found.minInvoiceAmount || 0);
    if (cartSubtotal < minNeeded) { notify(`Monto mínimo requerido: ${currencies.find(c => c.code === posCurrency)?.symbol}${minNeeded.toFixed(2)}`, "error"); return; }
    if (found.targetType === 'CLIENT' && found.targetId !== selectedClientId) { notify("Este cupón es exclusivo para otro cliente", "error"); return; }
    if (found.targetType === 'GROUP') {
        const client = clients.find(cl => cl.id === selectedClientId);
        if (!client || client.groupId !== found.targetId) { notify("No pertenece al grupo destinatario de este cupón", "error"); return; }
    }
    if (found.productIds?.length && !cart.some(item => found.productIds?.includes(item.id))) { notify("El cupón no aplica a los productos seleccionados", "error"); return; }
    setAppliedCoupon(found);
    notify("Cupón aplicado con éxito", "success");
    setCouponCodeInput('');
  };

  const removeCoupon = () => { setAppliedCoupon(null); notify("Cupón removido", "success"); };

  // --- IMPRESIÓN ESTABLE MEDIANTE IFRAME ---
  const buildPrintDocument = (innerHtml: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Impresión de Ticket</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { 
            margin: 0; 
            padding: 4mm; 
            font-family: 'Courier New', Courier, monospace; 
            font-size: 10pt; 
            color: #000; 
            width: 72mm; 
            background: white;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .dashed { border-top: 1px dashed #000; margin: 3mm 0; }
          table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
          th, td { text-align: left; vertical-align: top; padding: 1mm 0; }
          .col-desc { width: 45%; overflow: hidden; }
          .col-qty { width: 15%; text-align: center; }
          .col-total { width: 40%; text-align: right; white-space: nowrap; }
        </style>
      </head>
      <body>${innerHtml}</body>
    </html>
  `;

  const printRawHTML = (html: string) => {
    if (!html || html.trim() === '') {
      notify("Ticket vacío o inválido. No se pudo imprimir", "error");
      console.error("Print Error: HTML content is empty");
      return;
    }

    // Crear iframe oculto para evitar popups bloqueados
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.srcdoc = buildPrintDocument(html);

    iframe.onload = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Limpieza tras un tiempo prudencial
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    };

    document.body.appendChild(iframe);
  };

  const getTicketHTML = (ticket: Ticket | Sale) => {
    const ticketRate = rates[ticket.currency] || 1;
    const symbol = currencies.find(c => c.code === ticket.currency)?.symbol || '$';
    const dateStr = new Date(ticket.timestamp).toLocaleString();
    const client = clients.find(c => c.id === ticket.clientId);
    const totalPaid = ticket.payments.reduce((acc, p) => acc + p.amount, 0);
    const overpay = totalPaid - ticket.total;
    const changeCUP = overpay > 0.0001 ? round2(overpay * ticketRate) : 0;

    // Saneamiento de variables dinámicas usando safeText (trunca ANTES de escapar)
    const safeBizName = safeText(businessConfig.name, { maxLen: 28, upper: true });
    const safeAddress = safeText(businessConfig.address, { maxLen: 60 });
    const safePhone = safeText(businessConfig.phone, { maxLen: 20 });
    const safeTicketId = safeText(ticket.id.slice(-6), { maxLen: 6 });
    const safeSeller = safeText(ticket.sellerName || 'SISTEMA', { maxLen: 30, upper: true });
    const safeClient = safeText(client?.name || 'CONSUMIDOR FINAL', { maxLen: 30, upper: true });
    const safeFooter = safeText(businessConfig.footerMessage, { maxLen: 80, upper: true });
    const safeCurrencyLabel = safeText(ticket.currency, { maxLen: 5, upper: true });

    return `
      <div class="center"><h2 class="bold" style="margin:0; font-size: 14pt;">${safeBizName}</h2><p style="margin:1mm 0; font-size: 8pt;">${safeAddress}<br>Tel: ${safePhone}</p><p class="bold" style="font-size: 9pt; margin-top: 2mm;">TICKET: #${safeTicketId}</p></div>
      <div class="dashed"></div>
      <div style="font-size: 8pt; line-height: 1.4;">FECHA: ${dateStr}<br>VENDEDOR: ${safeSeller}<br>CLIENTE: ${safeClient}</div>
      <div class="dashed"></div>
      <table><thead><tr class="bold" style="border-bottom: 1px solid #000;"><th class="col-desc">DESC.</th><th class="col-qty">CT</th><th class="col-total">TOTAL</th></tr></thead><tbody>
          ${ticket.items.map(i => {
            const itemFinalAmount = i.quantity * i.finalPrice / (ticket.currency === 'CUP' ? 1 : ticketRate);
            return `<tr><td class="col-desc">${safeText(i.name, { maxLen: 20, upper: true })}</td><td class="col-qty">${i.quantity}</td><td class="col-total">${symbol}${formatNum(itemFinalAmount)}</td></tr>`;
          }).join('')}
      </tbody></table>
      <div class="dashed"></div>
      <div style="font-size: 10pt;"><div style="display:flex; justify-content: space-between;"><span>SUBTOTAL:</span><span>${symbol}${formatNum(ticket.subtotal)}</span></div>${ticket.discount > 0 ? `<div style="display:flex; justify-content: space-between;"><span>DESC.:</span><span>-${symbol}${formatNum(ticket.discount)}</span></div>` : ''}<div style="display:flex; justify-content: space-between;" class="bold"><span>TOTAL (${safeCurrencyLabel}):</span><span>${symbol}${formatNum(ticket.total)}</span></div></div>
      <div class="dashed"></div>
      <div style="font-size: 9pt;"><p class="bold" style="margin-bottom: 1mm;">DETALLE DE PAGO:</p>
        ${ticket.payments.map(p => {
          const safeMethodLabel = p.method === 'CREDIT' ? 'CRÉDITO CLIENTE' : safeText(p.method, { maxLen: 18, upper: true });
          const safePayCurrency = safeText(p.currency, { maxLen: 5, upper: true });
          let line = `<div style="display:flex; justify-content: space-between;"><span>${safeMethodLabel} (${safePayCurrency}):</span><span class="bold">${currencies.find(c => c.code === p.currency)?.symbol || '$'}${formatNum(p.amount)}</span></div>`;
          if (p.method === 'CREDIT' && ticket.clientRemainingCredit !== undefined) {
             line += `<div style="display:flex; justify-content: space-between; font-size: 8pt; color: #444;"><span>CRÉDITO RESTANTE:</span><span>₱${formatNum(ticket.clientRemainingCredit)}</span></div>`;
          }
          return line;
        }).join('')}
        ${changeCUP > 0.009 ? `<div style="display:flex; justify-content: space-between; margin-top: 2mm;" class="bold"><span>CAMBIO (CUP):</span><span>₱${formatNum(changeCUP)}</span></div>` : ''}
      </div>
      ${(ticket as Sale).refunds?.length ? `<div class="dashed"></div><div class="center bold" style="color:red;">REEMBOLSO APLICADO</div>` : ''}
      <div class="dashed"></div>
      <div class="center" style="font-size: 8pt; margin-top: 4mm;">
        <p class="bold">${safeFooter}</p>
        <p style="margin-top: 2mm; opacity: 0.5; margin-bottom: 0;">CAPIBARIO TPV</p>
        <p style="opacity: 0.5; margin: 0;">www.capibario.com</p>
      </div>
    `;
  };

  const handleConfirmSale = (payments: PaymentDetail[]) => {
    try {
      const ticket = processSale({ 
          items: cart, 
          subtotal: cartSubtotal, 
          discount: round2(couponDiscountAmount + bogoInfo.totalDiscount), 
          couponDiscount: couponDiscountAmount,
          bogoDiscount: bogoInfo.totalDiscount,
          bogoAppsCount: bogoInfo.totalApps,
          total: cartTotal, 
          payments, 
          currency: posCurrency, 
          clientId: selectedClientId, 
          appliedCouponId: appliedCoupon?.id 
      });

      if (ticket) { 
          setCurrentTicket(ticket); 
          setShowTicketModal(true); 
          clearCart(); 
          setAppliedCoupon(null); 
          setSelectedClientId(null); 
          setShowPaymentModal(false); 
      } else {
          // Si processSale retorna null, las notificaciones internas ya se dispararon.
          // No limpiamos el carrito para permitir reintentos.
          console.warn("Sale processing returned null - possible validation fail or managed exception.");
      }
    } catch (err) {
      console.error("UNHANDLED CONFIRM SALE ERROR:", err);
      notify("Ocurrió un error inesperado al cerrar la venta. Revise la consola.", "error");
    }
  };

  // --- LÓGICA DE REEMBOLSOS ---
  const handleStartRefund = (order: Sale) => {
    if (currentUser?.role === Role.ADMIN || currentUser?.role === Role.ACCOUNTANT) {
        setRefundQtys({});
        setRefundSource('CASHBOX');
        setIsRefundModalOpen(true);
    } else {
        setShowAuthPinModal(true);
    }
  };

  const handleVerifyAuthPin = async () => {
    const user = await validatePin(authPin);
    if (user && (user.role === Role.ADMIN || user.role === Role.ACCOUNTANT)) {
        setShowAuthPinModal(false);
        setAuthPin('');
        setRefundQtys({});
        setRefundSource('CASHBOX');
        setIsRefundModalOpen(true);
    } else {
        notify("Autorización denegada: Se requiere Administrador", "error");
        setAuthPin('');
    }
  };

  const handleProcessFinalRefund = () => {
    if (!selectedOrder) return;
    const itemsToRefund: RefundItem[] = [];
    Object.entries(refundQtys).forEach(([cartId, qty]) => {
        // Fix: Explicitly cast qty to number to handle "unknown" potentials in some TS environments
        const q = qty as number;
        if (q > 0) {
            const item = (selectedOrder.items as any[]).find(si => si.cartId === cartId);
            if (item) {
                const unitPriceCUP = item.finalPrice;
                itemsToRefund.push({ cartId, qty: q, amountCUP: unitPriceCUP * q });
            }
        }
    });

    if (itemsToRefund.length === 0) { notify("Seleccione al menos un producto", "error"); return; }
    
    const success = processRefund(selectedOrder.id, itemsToRefund, currentUser!, refundSource);
    if (success) {
        setIsRefundModalOpen(false);
        setSelectedOrder(null);
    }
  };

  if (!currentUser) return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-sm w-full border border-gray-100">
              <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-8 text-brand-600 shadow-inner"><Lock size={40} /></div>
              <h2 className="text-2xl font-black mb-2 text-slate-800 uppercase tracking-tighter">Terminal Bloqueada</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10">Introduzca su PIN de Operador</p>
              <input type="password" autoFocus className="bg-gray-50 border-none p-6 rounded-3xl text-center text-4xl mb-8 w-full font-black outline-none focus:ring-4 focus:ring-brand-500/20" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} maxLength={4} onKeyDown={e => e.key === 'Enter' && (login(searchQuery), setSearchQuery(''))} />
              <button onClick={() => { if(login(searchQuery)) setSearchQuery(''); }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-slate-200">Acceder</button>
          </div>
      </div>
  );

  if (!activeShift || showShiftManager) return <div className="h-full"><ShiftManager onOpen={() => setShowShiftManager(false)} /></div>;

  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden relative font-sans animate-in fade-in duration-500">
        
        {/* --- COLUMNA IZQUIERDA: CATÁLOGO --- */}
        <div className="flex-1 flex flex-col h-full bg-gray-50 border-r border-gray-200 min-w-0">
            <div className="bg-white p-3 md:p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:gap-4 items-center shrink-0">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-3.5 md:top-4 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={16} />
                    <input className="w-full bg-gray-100 border-none p-3 md:p-4 pl-10 md:pl-12 rounded-xl md:rounded-2xl font-bold text-xs md:sm outline-none focus:ring-2 focus:ring-brand-500/20" placeholder="Buscar por nombre, SKU..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl md:rounded-2xl gap-1 w-full md:w-auto overflow-x-auto scrollbar-hide">
                    {currencies.map(c => (
                        <button key={c.code} onClick={() => setPosCurrency(c.code)} className={`px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black transition-all flex-1 md:flex-none ${posCurrency === c.code ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:bg-gray-200'}`}>{c.code}</button>
                    ))}
                </div>
                <button onClick={() => setShowShiftManager(true)} title="Finalizar Turno" className="hidden md:flex p-3.5 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-lg"><Lock size={18}/></button>
            </div>

            <div className="bg-white px-3 md:px-4 py-3 md:py-4 border-b border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
                {['Todo', ...categories.map(c => c.name)].map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl whitespace-nowrap text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-50 text-slate-400 hover:bg-gray-100'}`}>{cat}</button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar pb-24 lg:pb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-1.5 md:gap-3">
                    {filteredProducts.map(p => {
                        const effectivePrice = convertValue(p.price);
                        const displayStock = (p.stock || 0) + (p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0) - cart.filter(item => item.id === p.id).reduce((acc, item) => acc + item.quantity, 0);
                        return (
                            <button key={p.id} onClick={() => handleAddToCart(p)} disabled={displayStock <= 0} className={`bg-white rounded-xl md:rounded-3xl border border-slate-100 p-1.5 md:p-2 text-left flex flex-col h-auto group hover:shadow-xl hover:-translate-y-1 transition-all ${displayStock <= 0 ? 'opacity-50 grayscale' : ''}`}>
                                <div className="aspect-square bg-gray-50 rounded-lg md:rounded-2xl mb-1.5 md:mb-3 overflow-hidden relative">
                                    {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package className="w-full h-full p-2 md:p-4 text-slate-200" />}
                                    <div className="absolute bottom-1 right-1 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-full text-[10px] md:text-xs font-black text-white">{displayStock} U</div>
                                </div>
                                <h3 className="text-[10px] md:text-xs font-black text-slate-800 uppercase line-clamp-2 leading-tight mb-1 md:mb-2 flex-1 tracking-tighter">{p.name}</h3>
                                <div className="flex justify-between items-center"><span className="font-black text-xs md:text-sm text-brand-600 truncate">{currencies.find(c => c.code === posCurrency)?.symbol}{effectivePrice.toFixed(2)}</span><div className="bg-gray-100 p-1.5 rounded-md text-slate-400 group-hover:bg-brand-500 group-hover:text-white transition-colors">{p.variants?.length > 0 ? <Layers size={14}/> : <Plus size={14}/>}</div></div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* --- COLUMNA DERECHA: TICKET Y ÓRDENES --- */}
        <div className={`fixed lg:relative inset-y-0 right-0 w-full lg:w-[420px] bg-white shadow-2xl flex flex-col z-[100] transition-transform duration-500 ${isTicketOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
            
            {/* TABS SELECTOR */}
            <div className="flex bg-slate-900 p-1.5 shrink-0">
                <button onClick={() => setActiveRightTab('CART')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeRightTab === 'CART' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}><Receipt size={16}/> Ticket {cart.length > 0 && `(${totalItemsCount})`}</button>
                <button onClick={() => setActiveRightTab('ORDERS')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeRightTab === 'ORDERS' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}><History size={16}/> Órdenes</button>
                <button onClick={() => setIsTicketOpen(false)} className="lg:hidden p-3 text-white"><X size={18}/></button>
            </div>

            {activeRightTab === 'CART' ? (
                <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3"><div className="bg-brand-100 text-brand-600 p-2.5 rounded-xl"><UserIcon size={18}/></div><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cliente</p><h4 className="text-[11px] font-black text-slate-800 uppercase">{selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : 'Consumidor Final'}</h4></div></div>
                        <button onClick={() => setIsClientModalOpen(true)} className="text-brand-600 font-black text-[9px] uppercase tracking-widest hover:underline">Vincular</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50 custom-scrollbar">
                        {cart.map(item => (
                            <div key={item.cartId} className="bg-white p-4 rounded-3xl border border-slate-100 flex gap-4 items-center animate-in slide-in-from-right">
                                <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">{item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package className="p-2 text-slate-300 w-full h-full" />}</div>
                                <div className="flex-1 min-w-0"><div className="font-black text-[10px] text-slate-800 uppercase truncate mb-0.5">{item.name}</div><div className="flex items-center gap-2"><span className="text-brand-600 font-black text-xs">{currencies.find(c => c.code === posCurrency)?.symbol}{convertValue(getEffectiveUnitPrice(item)).toFixed(2)}</span></div></div>
                                <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-2"><button onClick={() => updateQuantity(item.cartId, -1)} className="w-7 h-7 flex items-center justify-center text-slate-400 bg-white rounded-lg shadow-sm"><Minus size={12}/></button><span className="w-6 text-center font-black text-[11px] text-slate-700">{item.quantity}</span><button onClick={() => updateQuantity(item.cartId, 1)} className="w-7 h-7 flex items-center justify-center text-slate-400 bg-white rounded-lg shadow-sm"><Plus size={12}/></button></div>
                                <button onClick={() => removeFromCart(item.cartId)} className="text-slate-300 hover:text-red-500 p-1"><X size={16}/></button>
                            </div>
                        ))}
                        {cart.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20 opacity-30"><Receipt size={64} className="mb-4"/><p className="font-black uppercase text-xs tracking-widest">Carrito Vacío</p></div>
                        )}
                    </div>

                    {/* SECCIÓN CUPÓN */}
                    <div className="px-6 py-4 bg-white border-t border-gray-100">
                        {appliedCoupon ? (
                            <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-2xl border border-emerald-100 animate-in zoom-in">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-500 text-white p-2 rounded-lg"><Tag size={14}/></div>
                                    <div>
                                        <p className="text-[8px] font-black text-emerald-600 uppercase">Cupón Aplicado</p>
                                        <p className="text-[10px] font-bold text-emerald-700">{appliedCoupon.code}</p>
                                    </div>
                                </div>
                                <button onClick={removeCoupon} className="text-emerald-400 hover:text-red-500"><X size={18}/></button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Tag className="absolute left-3 top-3 text-slate-300" size={14} />
                                    <input 
                                        className="w-full bg-gray-50 border-none p-2.5 pl-9 rounded-xl font-bold text-[10px] outline-none focus:ring-2 focus:ring-brand-500/20 uppercase" 
                                        placeholder="CÓDIGO DE CUPÓN..." 
                                        value={couponCodeInput}
                                        onChange={e => setCouponCodeInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                                    />
                                </div>
                                <button onClick={handleApplyCoupon} className="bg-slate-900 text-white px-4 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-brand-600 transition-all">Aplicar</button>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-white border-t border-gray-100 space-y-4">
                        <div className="space-y-2 border-b border-gray-100 pb-4">
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>Subtotal</span><span>{currencies.find(c => c.code === posCurrency)?.symbol}{cartSubtotal.toFixed(2)}</span></div>
                            {(bogoInfo.totalDiscount > 0 || couponDiscountAmount > 0) && (
                                <div className="flex justify-between text-[10px] font-black text-amber-600 uppercase tracking-widest"><span>Descuentos</span><span>-{currencies.find(c => c.code === posCurrency)?.symbol}{(bogoInfo.totalDiscount + couponDiscountAmount).toFixed(2)}</span></div>
                            )}
                        </div>
                        <div className="flex justify-between items-center"><span className="font-black text-sm uppercase tracking-widest text-slate-400">Total</span><span className="text-3xl font-black text-slate-900 tracking-tighter">{currencies.find(c => c.code === posCurrency)?.symbol}{cartTotal.toFixed(2)}</span></div>
                        <button disabled={cart.length === 0} onClick={() => setShowPaymentModal(true)} className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl hover:bg-brand-600 transition-all uppercase tracking-[0.3em] text-[10px] disabled:opacity-50">Procesar Pago</button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 animate-in fade-in">
                    <div className="p-4 border-b border-gray-200">
                        <div className="relative"><Search className="absolute left-3 top-3 text-slate-300" size={14}/><input className="w-full bg-white p-2.5 pl-9 rounded-xl font-bold text-[10px] outline-none border border-gray-200" placeholder="BUSCAR TICKET O CLIENTE..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {filteredOrders.map(order => (
                            <button key={order.id} onClick={() => setSelectedOrder(order)} className="w-full bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:shadow-xl transition-all group">
                                <div className="text-left">
                                    <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest flex items-center gap-2">TICKET #{order.id.slice(-6)} {order.refunds?.length ? <RefreshCcw size={10} className="text-amber-500"/> : null}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{new Date(order.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-slate-900 text-sm tracking-tighter">${order.total.toFixed(2)} {order.currency}</div>
                                    <div className="text-[8px] font-black text-brand-500 uppercase">{order.items.reduce((acc, i) => acc + i.quantity, 0)} ítem(s)</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* MODAL DETALLE DE ORDEN */}
        {selectedOrder && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
                <div className="bg-white rounded-[4rem] w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in overflow-hidden">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3"><History size={24}/> Ficha de Orden</h2>
                            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">ID: {selectedOrder.id}</p>
                        </div>
                        <button onClick={() => setSelectedOrder(null)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-gray-50 custom-scrollbar">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Vendido por</p>
                                <p className="font-black text-slate-800 uppercase text-xs">{selectedOrder.sellerName}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Estatus</p>
                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${selectedOrder.refunds?.length ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>{selectedOrder.refunds?.length ? 'Reembolsada' : 'Finalizada'}</span>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b text-[8px] font-black uppercase text-slate-400 tracking-widest"><tr className="p-4"><th className="p-4">Producto</th><th className="p-4 text-center">Cant</th><th className="p-4 text-right">Monto</th></tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(selectedOrder.items as any[]).map(item => (
                                        <tr key={item.cartId} className="text-[10px] font-bold text-slate-600">
                                            <td className="p-4 uppercase">{item.name}</td>
                                            <td className="p-4 text-center">{item.quantity}</td>
                                            <td className="p-4 text-right font-black text-slate-800">${(item.quantity * item.finalPrice).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {selectedOrder.refunds?.length && (
                            <div className="bg-red-50 p-6 rounded-3xl border border-red-100 space-y-3">
                                <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2"><RefreshCcw size={14}/> Historial de Reembolsos</h4>
                                {selectedOrder.refunds.map(r => (
                                    <div key={r.id} className="bg-white/60 p-3 rounded-2xl text-[9px] flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-600">{new Date(r.timestamp).toLocaleString()} - Por: {r.authorizedBy}</span>
                                            <span className="text-[8px] font-black uppercase text-slate-400 mt-0.5">{r.refundSource === 'CASHBOX' ? 'Desde Caja' : 'Fuera de Caja'}</span>
                                        </div>
                                        <span className="font-black text-red-500">-${r.totalCUP.toFixed(2)} CUP</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-8 bg-white border-t border-gray-100 flex flex-col md:flex-row gap-3 shrink-0">
                        <button onClick={() => printRawHTML(getTicketHTML(selectedOrder))} className="flex-1 bg-gray-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><Printer size={18}/> Reimprimir</button>
                        <button onClick={() => handleStartRefund(selectedOrder)} className="flex-1 bg-red-50 text-red-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><RefreshCcw size={18}/> Reembolsar</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL REEMBOLSO */}
        {isRefundModalOpen && selectedOrder && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[300] flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-[4rem] w-full max-w-xl shadow-2xl animate-in zoom-in overflow-hidden flex flex-col h-auto max-h-[85vh]">
                    <div className="p-8 bg-red-600 text-white flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tighter">Procesar Reembolso</h2>
                            <p className="text-[9px] font-bold uppercase opacity-70">Seleccione ítems a devolver al inventario</p>
                        </div>
                        <button onClick={() => setIsRefundModalOpen(false)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                        <div className="space-y-4">
                            {(selectedOrder.items as any[]).map(item => {
                                const alreadyRefunded = selectedOrder.refunds?.reduce((acc, r) => acc + (r.items.find(ri => ri.cartId === item.cartId)?.qty || 0), 0) || 0;
                                const maxAvailable = item.quantity - alreadyRefunded;
                                if (maxAvailable <= 0) return null;
                                return (
                                    <div key={item.cartId} className="bg-gray-50 p-5 rounded-3xl border border-gray-100 flex items-center gap-4">
                                        <div className="flex-1">
                                            <h4 className="text-[10px] font-black uppercase text-slate-800 line-clamp-1">{item.name}</h4>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Disp: {maxAvailable} de {item.quantity}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setRefundQtys({...refundQtys, [item.cartId]: Math.max(0, (refundQtys[item.cartId] || 0) - 1)})} className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400"><Minus size={14}/></button>
                                            <span className="w-6 text-center font-black text-xs text-slate-900">{refundQtys[item.cartId] || 0}</span>
                                            <button onClick={() => setRefundQtys({...refundQtys, [item.cartId]: Math.min(maxAvailable, (refundQtys[item.cartId] || 0) + 1)})} className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-900"><Plus size={14}/></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* SECTOR ORIGEN REEMBOLSO */}
                        <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                             <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Origen del Reembolso</h4>
                             <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setRefundSource('CASHBOX')} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${refundSource === 'CASHBOX' ? 'bg-white border-red-500 text-red-600 shadow-lg' : 'bg-transparent border-gray-200 text-gray-400'}`}>
                                    <Wallet size={20}/>
                                    <span className="text-[8px] font-black uppercase tracking-tighter">En Caja</span>
                                </button>
                                <button onClick={() => setRefundSource('OUTSIDE_CASHBOX')} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${refundSource === 'OUTSIDE_CASHBOX' ? 'bg-white border-slate-900 text-slate-900 shadow-lg' : 'bg-transparent border-gray-200 text-gray-400'}`}>
                                    <Box size={20}/>
                                    <span className="text-[8px] font-black uppercase tracking-tighter">Fuera de Caja</span>
                                </button>
                             </div>
                             <p className="mt-3 text-[8px] font-bold text-slate-400 uppercase text-center leading-tight">
                                {refundSource === 'CASHBOX' ? 'Resta efectivo de la caja del turno (requiere liquidez).' : 'Devuelve stock sin afectar el efectivo del turno.'}
                             </p>
                        </div>
                    </div>
                    <div className="p-8 bg-white border-t border-gray-100">
                        <button onClick={handleProcessFinalRefund} className="w-full bg-red-600 text-white font-black py-5 rounded-3xl shadow-xl uppercase tracking-widest text-xs hover:bg-red-700 transition-all flex items-center justify-center gap-2">Confirmar Devolución <RefreshCcw size={18}/></button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL PIN AUTORIZACIÓN */}
        {showAuthPinModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
                <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-sm w-full text-center animate-in zoom-in">
                    <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 text-red-500 shadow-inner"><Key size={40}/></div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2">Requerida Autorización</h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-10 tracking-widest">Introduzca PIN de Administrador para reembolsar</p>
                    <input type="password" autoFocus className="w-full bg-gray-50 border-none p-6 rounded-3xl text-center text-5xl mb-10 font-black outline-none focus:ring-4 focus:ring-brand-500/20" value={authPin} onChange={e => setAuthPin(e.target.value)} maxLength={4} onKeyDown={e => e.key === 'Enter' && handleVerifyAuthPin()} />
                    <div className="flex gap-4"><button onClick={handleVerifyAuthPin} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest">Validar</button><button onClick={() => setShowAuthPinModal(false)} className="flex-1 bg-gray-100 text-slate-400 font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest">Cerrar</button></div>
                </div>
            </div>
        )}

        {/* --- MODAL SELECTOR DE VARIANTES --- */}
        {selectedProductForVariants && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
                <div className="bg-white rounded-[4rem] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3"><Layers size={24}/> Seleccionar Versión</h2>
                            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">{selectedProductForVariants.name}</p>
                        </div>
                        <button onClick={() => setSelectedProductForVariants(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button disabled={selectedProductForVariants.stock <= 0} onClick={() => handleAddToCart(selectedProductForVariants, undefined, true)} className={`p-6 rounded-[2.5rem] border-2 text-left transition-all flex items-center gap-5 ${selectedProductForVariants.stock > 0 ? 'bg-white border-slate-100 hover:border-brand-500 shadow-sm' : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'}`}>
                            <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden flex-shrink-0">{selectedProductForVariants.image ? <img src={selectedProductForVariants.image} className="w-full h-full object-cover" /> : <Package className="p-4 text-slate-300 w-full h-full" />}</div>
                            <div className="flex-1"><h4 className="font-black text-slate-800 uppercase text-xs">Estándar (Base)</h4><div className="flex justify-between items-center mt-1"><span className="text-[10px] font-black text-brand-600">{currencies.find(c => c.code === posCurrency)?.symbol}{convertValue(selectedProductForVariants.price).toFixed(2)}</span><span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${selectedProductForVariants.stock > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{selectedProductForVariants.stock} DISP.</span></div></div>
                        </button>
                        {selectedProductForVariants.variants?.map(v => (
                            <button key={v.id} disabled={v.stock <= 0} onClick={() => handleAddToCart(selectedProductForVariants, v.id)} className={`p-6 rounded-[2.5rem] border-2 text-left transition-all flex items-center gap-5 ${v.stock > 0 ? 'bg-white border-slate-100 hover:border-brand-500 shadow-sm' : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'}`}>
                                <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden flex-shrink-0 relative">{v.image ? <img src={v.image} className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ backgroundColor: v.color || '#64748b' }}></div>}</div>
                                <div className="flex-1"><h4 className="font-black text-slate-800 uppercase text-xs line-clamp-1">{v.name}</h4><div className="flex justify-between items-center mt-1"><span className="text-[10px] font-black text-brand-600">{currencies.find(c => c.code === posCurrency)?.symbol}{convertValue(v.price).toFixed(2)}</span><span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${v.stock > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{v.stock} DISP.</span></div></div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* MODALES Y OTROS COMPONENTES */}
        {showPaymentModal && <PaymentModal total={cartTotal} currencyCode={posCurrency} clientId={selectedClientId} onClose={() => setShowPaymentModal(false)} onConfirm={handleConfirmSale} />}
        {showTicketModal && currentTicket && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[300] p-4">
                <div className="bg-white p-8 md:p-10 rounded-[4rem] w-full max-w-md text-center shadow-2xl animate-in zoom-in overflow-hidden flex flex-col">
                    <div className="bg-emerald-50 text-emerald-600 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-inner shrink-0"><Receipt size={40}/></div>
                    <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-2 shrink-0">Venta Exitosa</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6 shrink-0">Comprobante ID: {currentTicket.id.slice(-6)}</p>
                    
                    {/* VISTA PREVIA DEL TICKET */}
                    <div className="flex-1 bg-gray-50 border border-gray-100 rounded-3xl p-4 mb-6 overflow-y-auto max-h-[40vh] custom-scrollbar text-left shadow-inner">
                        <div className="bg-white p-4 shadow-sm min-h-full ticket-preview-content">
                            <div dangerouslySetInnerHTML={{ __html: getTicketHTML(currentTicket) }} />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-2 mb-2 shrink-0">
                        <button 
                            onClick={() => {
                                const html = getTicketHTML(currentTicket);
                                console.log("Imprimiendo Ticket - Length:", html?.length, "ID:", currentTicket.id);
                                printRawHTML(html);
                            }} 
                            className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
                        >
                            <Printer size={16}/> Imprimir
                        </button>
                        <button onClick={() => setShowTicketModal(false)} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl">Finalizar</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL SELECTOR CLIENTES */}
        {isClientModalOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
                <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in h-[70vh] flex flex-col">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0"><h3 className="text-xl font-black uppercase tracking-tighter">Vincular Cliente</h3><button onClick={() => setIsClientModalOpen(false)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button></div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        <button onClick={() => { setSelectedClientId(null); setIsClientModalOpen(false); }} className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-100 text-slate-400 font-black uppercase text-[10px] hover:bg-gray-50 transition-all">Consumidor Final (Sin Registro)</button>
                        {clients.map(c => (
                            <button key={c.id} onClick={() => { setSelectedClientId(c.id); setIsClientModalOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedClientId === c.id ? 'bg-brand-50 border-brand-500' : 'bg-white border-slate-100 hover:bg-gray-50'}`}><div className="flex items-center gap-4 text-left"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black">{c.name.charAt(0)}</div><div><h4 className="text-xs font-black text-slate-800 uppercase tracking-tighter">{c.name}</h4><p className="text-[9px] text-slate-400 font-bold uppercase">{c.phone || 'Sin teléfono'}</p></div></div>{selectedClientId === c.id && <CheckCircle size={20} className="text-brand-500"/>}</button>
                        ))}
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};
