import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    Search, Plus, Minus, Trash2, Receipt, User as UserIcon, Tag, Ticket as TicketIcon, 
    Lock, Unlock, Layers, X, AlertTriangle, Monitor, ChevronRight, CheckCircle, Percent, Wallet, DollarSign, Calendar, Zap, Package, LogOut, Printer, FileDown
} from 'lucide-react';
import { PaymentModal } from '../components/PaymentModal';
import { Currency, Ticket, Product, PaymentDetail, Coupon, ProductVariant, Client, View } from '../types';
import { ShiftManager } from './ShiftManager';
import { jsPDF } from 'jspdf';

export const POS: React.FC = () => {
  const { 
    products, addToCart: storeAddToCart, cart, removeFromCart, updateQuantity, processSale, 
    rates, activeShift, openShift, clearCart, warehouses, categories, setView,
    clients, selectedClientId, setSelectedClientId,
    posCurrency, setPosCurrency, currentUser, login, coupons, isItemLocked,
    businessConfig, activePosTerminalId, setActivePosTerminalId, notify, currencies
  } = useStore();
  
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
    const sum = cart.reduce((acc, item) => acc + (convertValue(getEffectiveUnitPrice(item)) * item.quantity), 0);
    return round2(sum);
  }, [cart, posCurrency, rates]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    let disc = 0;
    if (appliedCoupon.type === 'PERCENTAGE') disc = cartSubtotal * (appliedCoupon.value / 100);
    else disc = convertValue(appliedCoupon.value);
    return round2(disc);
  }, [appliedCoupon, cartSubtotal, posCurrency, rates]);

  const cartTotal = useMemo(() => round2(Math.max(0, cartSubtotal - discountAmount)), [cartSubtotal, discountAmount]);

  // --- ACCIONES DE TICKET (PRINT) ---
  const printRawHTML = (html: string) => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      notify("Habilite ventanas emergentes para imprimir", "error");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Ticket</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 4mm; font-family: 'Courier New', Courier, monospace; font-size: 10pt; color: #000; width: 72mm; }
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
        <body>${html}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const getTicketHTML = (ticket: Ticket) => {
    const symbol = currencies.find(c => c.code === ticket.currency)?.symbol || '$';
    const dateStr = new Date(ticket.timestamp).toLocaleString();
    const client = clients.find(c => c.id === ticket.clientId);
    
    const totalPaid = ticket.payments.reduce((acc, p) => acc + p.amount, 0);
    const overpay = totalPaid - ticket.total;
    const changeCUP = overpay > 0.0001 ? round2(overpay * (rates[ticket.currency] || 1)) : 0;

    return `
      <div class="center">
        <h2 class="bold" style="margin:0; font-size: 14pt;">${businessConfig.name.toUpperCase()}</h2>
        <p style="margin:1mm 0; font-size: 8pt;">${businessConfig.address}<br>Tel: ${businessConfig.phone}</p>
        <p class="bold" style="font-size: 9pt; margin-top: 2mm;">TICKET: #${ticket.id.slice(-6)}</p>
      </div>
      
      <div class="dashed"></div>
      
      <div style="font-size: 8pt; line-height: 1.4;">
        FECHA: ${dateStr}<br>
        VENDEDOR: ${(ticket.sellerName || 'SISTEMA').toUpperCase()}<br>
        ${client ? `CLIENTE: ${client.name.toUpperCase()}` : 'CLIENTE: CONSUMIDOR FINAL'}
      </div>
      
      <div class="dashed"></div>
      
      <table>
        <thead>
          <tr class="bold" style="border-bottom: 1px solid #000;">
            <th class="col-desc">DESC.</th>
            <th class="col-qty">CT</th>
            <th class="col-total">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${ticket.items.map(i => {
            const lineTotal = (i.quantity) * convertValue(getEffectiveUnitPrice(i));
            return `
              <tr>
                <td class="col-desc">${i.name.toUpperCase().substring(0, 20)}</td>
                <td class="col-qty">${i.quantity}</td>
                <td class="col-total">${symbol}${formatNum(lineTotal)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div class="dashed"></div>
      
      <div style="font-size: 10pt;">
        <div style="display:flex; justify-content: space-between;"><span>SUBTOTAL:</span><span>${symbol}${formatNum(ticket.subtotal)}</span></div>
        ${ticket.discount > 0 ? `<div style="display:flex; justify-content: space-between;"><span>DESC.:</span><span>-${symbol}${formatNum(ticket.discount)}</span></div>` : ''}
        <div style="display:flex; justify-content: space-between;" class="bold"><span>TOTAL (${ticket.currency}):</span><span>${symbol}${formatNum(ticket.total)}</span></div>
      </div>
      
      <div class="dashed"></div>
      
      <div style="font-size: 9pt;">
        <p class="bold" style="margin-bottom: 1mm;">DETALLE DE PAGO:</p>
        ${ticket.payments.map(p => `
          <div style="display:flex; justify-content: space-between;">
            <span>${p.method === 'CREDIT' ? 'CRÉDITO CLIENTE' : p.method.toUpperCase()} (${p.currency}):</span>
            <span class="bold">${currencies.find(c => c.code === p.currency)?.symbol || '$'}${formatNum(p.amount)}</span>
          </div>
        `).join('')}
        
        ${changeCUP > 0.009 ? `
          <div style="display:flex; justify-content: space-between; margin-top: 2mm;" class="bold">
            <span>CAMBIO ENTREGADO (CUP):</span>
            <span>₱${formatNum(changeCUP)}</span>
          </div>
        ` : ''}

        ${ticket.clientRemainingCredit !== undefined ? `
          <div style="display:flex; justify-content: space-between; margin-top: 2mm; font-style: italic;">
            <span>CRÉDITO RESTANTE:</span>
            <span>$${formatNum(ticket.clientRemainingCredit)} CUP</span>
          </div>
        ` : ''}
      </div>
      
      <div class="dashed"></div>
      
      <div class="center" style="font-size: 8pt; margin-top: 4mm;">
        <p class="bold">${businessConfig.footerMessage.toUpperCase()}</p>
        <p style="margin-top: 2mm; opacity: 0.5;">CAPIBARIO TPV CLOUD</p>
      </div>
    `;
  };

  const handlePrintTicket = (ticket: Ticket) => {
    const html = getTicketHTML(ticket);
    printRawHTML(html);
  };

  const handleDownloadPDF = (ticket: Ticket) => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 200]
    });

    const symbol = currencies.find(c => c.code === ticket.currency)?.symbol || '$';
    const dateStr = new Date(ticket.timestamp).toLocaleString();
    const totalPaid = ticket.payments.reduce((acc, p) => acc + p.amount, 0);
    const overpay = totalPaid - ticket.total;
    const changeCUP = overpay > 0.0001 ? round2(overpay * (rates[ticket.currency] || 1)) : 0;
    
    let y = 15;
    const margin = 10;
    const width = 80;
    const innerWidth = width - (margin * 2);

    // Encabezado
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text(businessConfig.name.toUpperCase(), 40, y, { align: 'center' }); y += 6;
    
    doc.setFontSize(7);
    doc.setFont('courier', 'normal');
    const splitAddress = doc.splitTextToSize(businessConfig.address, innerWidth);
    doc.text(splitAddress, 40, y, { align: 'center' }); y += (splitAddress.length * 3.5);
    
    doc.text(`TEL: ${businessConfig.phone || 'N/A'}`, 40, y, { align: 'center' }); y += 6;

    (doc as any).setLineDash([1, 1]);
    doc.line(margin, y, width - margin, y); y += 6;
    (doc as any).setLineDash([]);

    // Meta info
    doc.setFont('courier', 'bold');
    doc.text(`TICKET:`, margin, y); doc.text(`#${ticket.id.slice(-6)}`, width - margin, y, { align: 'right' }); y += 4;
    doc.setFont('courier', 'normal');
    doc.text(`FECHA:`, margin, y); doc.text(dateStr, width - margin, y, { align: 'right' }); y += 4;
    doc.text(`VENDEDOR:`, margin, y); doc.text((ticket.sellerName || 'SISTEMA').toUpperCase(), width - margin, y, { align: 'right' }); y += 4;
    if (ticket.clientId) {
      const client = clients.find(c => c.id === ticket.clientId);
      doc.text(`CLIENTE:`, margin, y); doc.text((client?.name || 'GENÉRICO').toUpperCase(), width - margin, y, { align: 'right' }); y += 4;
    }
    y += 4;

    // Tabla de ítems
    doc.setFont('courier', 'bold');
    doc.line(margin, y, width - margin, y); y += 4;
    doc.text('DESC.', margin, y); doc.text('CT', 48, y); doc.text('TOTAL', width - margin, y, { align: 'right' }); y += 3;
    doc.line(margin, y, width - margin, y); y += 5;
    
    doc.setFont('courier', 'normal');
    ticket.items.forEach(item => {
      const linePrice = convertValue(getEffectiveUnitPrice(item));
      const lineTotal = formatNum(item.quantity * linePrice);
      const valStr = `${symbol}${lineTotal}`;
      
      const itemName = item.name.toUpperCase();
      const splitName = doc.splitTextToSize(itemName, 32);
      
      doc.text(splitName, margin, y);
      doc.text(String(item.quantity), 48, y);
      doc.text(valStr, width - margin, y, { align: 'right' });
      y += (splitName.length * 3.5) + 1;
    });

    y += 2;
    doc.line(margin, y, width - margin, y); y += 6;
    
    doc.setFontSize(8);
    doc.text('SUBTOTAL:', margin, y); doc.text(`${symbol}${formatNum(ticket.subtotal)}`, width - margin, y, { align: 'right' }); y += 4;
    if(ticket.discount > 0) {
      doc.text('DESCUENTO:', margin, y); doc.text(`-${symbol}${formatNum(ticket.discount)}`, width - margin, y, { align: 'right' }); y += 4;
    }
    
    y += 2;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text(`TOTAL (${ticket.currency}):`, margin, y); doc.text(`${symbol}${formatNum(ticket.total)}`, width - margin, y, { align: 'right' }); y += 6;

    doc.setFontSize(7);
    doc.text(`DETALLE DE PAGO:`, margin, y); y += 4;
    doc.setFont('courier', 'normal');
    ticket.payments.forEach(p => {
      const pSymbol = currencies.find(c => c.code === p.currency)?.symbol || '$';
      doc.text(`- ${p.method === 'CREDIT' ? 'CRÉDITO CLIENTE' : p.method.toUpperCase()}:`, margin, y); 
      doc.text(`${pSymbol}${formatNum(p.amount)}`, width - margin, y, { align: 'right' }); y += 4;
    });

    if (changeCUP > 0.009) {
      y += 2;
      doc.setFont('courier', 'bold');
      doc.text(`CAMBIO ENTREGADO (CUP):`, margin, y); doc.text(`₱${formatNum(changeCUP)}`, width - margin, y, { align: 'right' }); y += 4;
    }

    if (ticket.clientRemainingCredit !== undefined) {
      y += 1;
      doc.setFont('courier', 'normal');
      doc.text(`CRÉDITO RESTANTE:`, margin, y); doc.text(`$${formatNum(ticket.clientRemainingCredit)} CUP`, width - margin, y, { align: 'right' }); y += 4;
    }

    y += 12;
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(businessConfig.footerMessage.toUpperCase(), 40, y, { align: 'center' }); y += 6;

    doc.save(`Ticket_${ticket.id.slice(-6)}.pdf`);
  };

  // --- ACCIONES ---
  const handleAddToCart = (p: Product, vId?: string, isBase: boolean = false) => {
    if (p.variants?.length > 0 && !vId && !isBase) {
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

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden relative font-sans animate-in fade-in duration-500">
        
        {/* --- COLUMNA IZQUIERDA: CATÁLOGO --- */}
        <div className="flex-1 flex flex-col h-full bg-gray-50 border-r border-gray-200 min-w-0">
            <div className="bg-white p-3 md:p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:gap-4 items-center shrink-0">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-3.5 md:top-4 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={16} />
                    <input 
                        className="w-full bg-gray-100 border-none p-3 md:p-4 pl-10 md:pl-12 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-brand-500/20" 
                        placeholder="Buscar..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl md:rounded-2xl gap-1 w-full md:w-auto overflow-x-auto scrollbar-hide">
                    {currencies.map(c => (
                        <button 
                            key={c.code} 
                            onClick={() => setPosCurrency(c.code)}
                            className={`px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black transition-all flex-1 md:flex-none ${posCurrency === c.code ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:bg-gray-200'}`}
                        >
                            {c.code}
                        </button>
                    ))}
                </div>
                <button 
                  onClick={() => setShowShiftManager(true)} 
                  title="Gestión de Turno"
                  className="hidden md:flex p-3.5 bg-slate-900 text-white rounded-2xl hover:bg-brand-600 transition-all shadow-lg"
                >
                  <Unlock size={18}/>
                </button>
            </div>

            <div className="bg-white px-3 md:px-4 pb-3 md:pb-4 border-b border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
                {['Todo', ...categories.map(c => c.name)].map(cat => (
                    <button 
                        key={cat} 
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl whitespace-nowrap text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === cat ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-50 text-slate-400 hover:bg-gray-100'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar">
                <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-7 gap-1.5 md:gap-3">
                    {filteredProducts.map(p => {
                        const effectivePrice = convertValue(p.price);
                        const totalInitialStock = (p.stock || 0) + (p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0);
                        const totalInCart = cart.filter(item => item.id === p.id).reduce((acc, item) => acc + item.quantity, 0);
                        const displayStock = totalInitialStock - totalInCart;

                        return (
                            <button 
                                key={p.id}
                                onClick={() => handleAddToCart(p)}
                                disabled={displayStock <= 0}
                                className={`bg-white rounded-xl md:rounded-3xl border border-slate-100 p-1.5 md:p-2 text-left flex flex-col h-auto group hover:shadow-xl hover:-translate-y-1 transition-all ${displayStock <= 0 ? 'opacity-50 grayscale' : ''}`}
                            >
                                <div className="aspect-square bg-gray-50 rounded-lg md:rounded-2xl mb-1.5 md:mb-3 overflow-hidden relative">
                                    {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Layers className="w-full h-full p-2 md:p-4 text-slate-200" />}
                                    <div className="absolute top-1 right-1 bg-slate-900/80 backdrop-blur-md px-1.5 py-0.5 rounded-full text-[6px] md:text-[8px] font-black text-white">{displayStock} U</div>
                                </div>
                                <h3 className="text-[7px] md:text-[9px] font-black text-slate-800 uppercase line-clamp-1 md:line-clamp-2 leading-tight mb-1 md:mb-2 flex-1 tracking-tighter">{p.name}</h3>
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-[9px] md:text-xs text-brand-600 truncate">{currencies.find(c => c.code === posCurrency)?.symbol}{effectivePrice.toFixed(2)}</span>
                                    <div className="bg-gray-100 p-1 rounded-md text-slate-400 group-hover:bg-brand-500 group-hover:text-white transition-colors"><Plus size={10}/></div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* --- COLUMNA DERECHA: TICKET --- */}
        <div className={`
            fixed lg:relative inset-y-0 right-0 w-full lg:w-[420px] bg-white shadow-2xl flex flex-col z-[80] transition-transform duration-500
            ${isTicketOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <h2 className="text-lg font-black uppercase tracking-[0.2em] flex items-center gap-3"><Receipt className="text-brand-400" /> Ticket</h2>
                <div className="flex gap-2">
                    <button onClick={clearCart} className="p-3 bg-white/10 hover:bg-red-500/20 rounded-2xl transition-colors"><Trash2 size={18}/></button>
                    <button onClick={() => setIsTicketOpen(false)} className="lg:hidden p-3 bg-white/10 rounded-2xl"><X size={18}/></button>
                </div>
            </div>

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

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50 custom-scrollbar">
                {cart.map(item => {
                    const unitPrice = getEffectiveUnitPrice(item);
                    return (
                        <div key={item.cartId} className="bg-white p-4 rounded-3xl border border-slate-100 flex gap-4 items-center animate-in slide-in-from-right">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 relative">
                                {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Layers className="p-2 text-slate-300 w-full h-full" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-black text-[10px] text-slate-800 uppercase truncate mb-0.5">{item.name}</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-brand-600 font-black text-xs">{currencies.find(c => c.code === posCurrency)?.symbol}{convertValue(unitPrice).toFixed(2)}</span>
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
            </div>

            <div className="p-6 bg-white border-t border-gray-100 space-y-4">
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

        {/* --- MODALES Y OTROS COMPONENTES --- */}
        {showPaymentModal && (
            <PaymentModal 
                total={cartTotal} 
                currencyCode={posCurrency} 
                clientId={selectedClientId}
                onClose={() => setShowPaymentModal(false)} 
                onConfirm={handleConfirmSale} 
            />
        )}

        {showTicketModal && currentTicket && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[300] p-4">
                <div className="bg-white p-10 rounded-[4rem] w-full max-sm text-center shadow-2xl animate-in zoom-in">
                    <div className="bg-emerald-50 text-emerald-600 p-8 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-8 shadow-inner"><Receipt size={48}/></div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Venta Exitosa</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">Comprobante ID: {currentTicket.id.slice(-6)}</p>
                    
                    <div className="flex gap-2 mb-6">
                        <button 
                            onClick={() => handlePrintTicket(currentTicket)}
                            className="flex-1 bg-gray-100 text-slate-700 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
                        >
                            <Printer size={16}/> Imprimir
                        </button>
                        <button 
                            onClick={() => handleDownloadPDF(currentTicket)}
                            className="flex-1 bg-gray-100 text-slate-700 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
                        >
                            <FileDown size={16}/> PDF
                        </button>
                    </div>

                    <button onClick={() => setShowTicketModal(false)} className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] uppercase tracking-[0.2em] text-xs shadow-xl">Finalizar</button>
                </div>
            </div>
        )}

        {/* MODAL SELECTOR CLIENTES */}
        {isClientModalOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
                <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in h-[70vh] flex flex-col">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black uppercase tracking-tighter">Vincular Cliente</h3>
                        <button onClick={() => { setIsClientModalOpen(false); }} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
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

    </div>
  );
};
