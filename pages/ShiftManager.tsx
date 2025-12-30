
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Currency, View, Role, Product, Sale, Shift, User } from '../types';
import { Unlock, DollarSign, Printer, AlertTriangle, ArrowUp, X, Key, CheckCircle, Package, Receipt, Truck } from 'lucide-react';
import { escapeHtml, safeText } from '../utils/escapeHtml';

export const ShiftManager: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { 
    activeShift, openShift, closeShift, getCurrentCash, currentUser, validatePin, 
    sales, products, businessConfig, notify, logout, ledger 
  } = useStore();
  
  void escapeHtml; // Uso neutro para cumplir con importación literal obligatoria

  // Estados de flujo
  const [step, setStep] = useState<'IDLE' | 'PIN' | 'ARQUEO' | 'Z_REPORT'>(activeShift ? 'PIN' : 'IDLE');
  const [authUserInfo, setAuthUserInfo] = useState<User | null>(null);
  
  // Estados de apertura
  const [startCashCUP, setStartCashCUP] = useState('');
  
  // Estados de cierre
  const [pinInput, setPinInput] = useState('');
  const [actualCounts, setActualCounts] = useState<Record<string, string>>({});
  const [lastShiftSummary, setLastShiftSummary] = useState<any>(null);

  // Utilidades
  const formatNum = (num: number) => {
    const n = Number(num);
    return isNaN(n) ? "0.00" : new Intl.NumberFormat('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const expectedMetrics = useMemo(() => {
    if (!activeShift) return {};
    const totals: Record<string, number> = {};
    const turnSales = sales.filter(s => s.shiftId === activeShift.id);
    
    const systemCash = getCurrentCash();
    Object.entries(systemCash).forEach(([curr, val]) => {
      totals[`CASH_${curr}`] = Number(val) || 0;
    });

    turnSales.forEach(sale => {
      sale.payments.forEach(pay => {
        if (pay.method !== 'CASH') {
          const key = `${pay.method}_${pay.currency}`;
          totals[key] = (totals[key] || 0) + (Number(pay.amount) || 0);
        }
      });
    });

    return totals;
  }, [activeShift, sales, getCurrentCash]);

  const handleOpenShift = () => {
    const val = parseFloat(startCashCUP) || 0;
    openShift({ CUP: val });
    if (onOpen) onOpen();
  };

  const handleVerifyPIN = async () => {
    const user = await validatePin(pinInput);
    if (user) {
      setAuthUserInfo(user);
      setStep('ARQUEO');
      setPinInput('');
    } else {
      notify("PIN inválido", "error");
      setPinInput('');
    }
  };

  const inventoryReportData = useMemo(() => {
    const currentShift = activeShift || lastShiftSummary?.shift;
    if (!currentShift || !currentShift.initialStock) return [];
    
    const turnSales = sales.filter(s => s.shiftId === currentShift.id);
    const startTime = new Date(currentShift.openedAt).getTime();
    const endTime = currentShift.closedAt ? new Date(currentShift.closedAt).getTime() : Date.now();
    
    const results: any[] = [];

    products.forEach(p => {
      const pId = p.id;
      const startStock = currentShift.initialStock[pId] || 0;
      
      const entriesQty = (p.history || [])
        .filter(log => {
          const logTime = new Date(log.timestamp).getTime();
          return logTime >= startTime && logTime <= endTime && 
                 log.type === 'STOCK_ADJUST' && 
                 log.entityType === 'PRODUCT' && 
                 log.entityId === pId;
        })
        .reduce((sum, log) => sum + (Number(log.details_raw?.after?.qty) || 0), 0);

      let soldQty = 0;
      let refundedQty = 0;

      turnSales.forEach(sale => {
        const item = sale.items.find(i => i.id === pId && !i.selectedVariantId);
        if (item) soldQty += (Number(item.quantity) || 0);

        const itemRefunded = sale.refunds?.filter(r => {
            const rt = new Date(r.timestamp).getTime();
            return rt >= startTime && rt <= endTime;
        }).reduce((rAcc, r) => rAcc + (r.items.find(ri => ri.cartId === pId)?.qty || 0), 0) || 0;
        refundedQty += itemRefunded;
      });

      const netSold = soldQty - refundedQty;

      if (startStock > 0 || soldQty > 0 || entriesQty > 0) {
        results.push({
          name: p.name || 'Producto Sin Nombre',
          start: startStock,
          entries: entriesQty,
          sales: netSold,
          final: p.stock || 0
        });
      }

      (p.variants || []).forEach(v => {
        const vKey = `${pId}-${v.id}`;
        const startV = currentShift.initialStock[vKey] || 0;
        
        const entriesV = (p.history || [])
          .filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return logTime >= startTime && logTime <= endTime && 
                   log.type === 'STOCK_ADJUST' && 
                   log.entityType === 'VARIANT' && 
                   log.entityId === v.id;
          })
          .reduce((sum, log) => sum + (Number(log.details_raw?.after?.qty) || 0), 0);

        let soldV = 0;
        let refundedV = 0;

        turnSales.forEach(sale => {
          const item = sale.items.find(i => i.selectedVariantId === v.id);
          if (item) soldV += (Number(item.quantity) || 0);

          const itemRef = sale.refunds?.filter(r => {
              const rt = new Date(r.timestamp).getTime();
              return rt >= startTime && rt <= endTime;
          }).reduce((rAcc, r) => rAcc + (r.items.find(ri => ri.cartId === vKey)?.qty || 0), 0) || 0;
          refundedV += itemRef;
        });

        const netSoldV = soldV - refundedV;

        if (startV > 0 || soldV > 0 || entriesV > 0) {
          results.push({
            name: `${p.name || ''} (${v.name || 'Variante'})`,
            start: startV,
            entries: entriesV,
            sales: netSoldV,
            final: v.stock || 0
          });
        }
      });
    });
    return results;
  }, [sales, products, activeShift, lastShiftSummary]);

  const handleConfirmClosure = () => {
    if (!activeShift) return;
    const finalCounts: Record<string, number> = {};
    
    let hasMismatch = false;
    Object.keys(expectedMetrics).forEach(key => {
      const actual = parseFloat(actualCounts[key] || '0');
      const expected = Number(expectedMetrics[key]) || 0;
      if (Math.abs(actual - expected) > 0.01) hasMismatch = true;
      finalCounts[key] = actual;
    });

    if (hasMismatch) {
      notify("Existen diferencias en el arqueo. Verifique el conteo.", "error");
      return;
    }

    const turnSales = sales.filter(s => s.shiftId === activeShift.id);
    const startTime = new Date(activeShift.openedAt).getTime();
    const endTime = Date.now();

    let rInCaja = 0;
    let rFueraCaja = 0;
    let couponDisc = 0;
    let bogoDisc = 0;
    let bogoApps = 0;

    turnSales.forEach(sale => {
        couponDisc += (Number(sale.couponDiscount) || 0);
        bogoDisc += (Number(sale.bogoDiscount) || 0);
        bogoApps += (Number(sale.bogoAppsCount) || 0);

        sale.refunds?.filter(r => {
          const rt = new Date(r.timestamp).getTime();
          return rt >= startTime && rt <= endTime;
        }).forEach(ref => {
            if (ref.refundSource === 'OUTSIDE_CASHBOX') rFueraCaja += Number(ref.totalCUP) || 0;
            else rInCaja += Number(ref.totalCUP) || 0;
        });
    });

    const summary = {
      shift: { ...activeShift },
      metrics: { ...expectedMetrics },
      actual: { ...finalCounts },
      inventory: [...inventoryReportData],
      totalGross: turnSales.reduce((a, b) => a + (Number(b.total) || 0), 0),
      closedAt: new Date().toISOString(),
      closedBy: authUserInfo?.name || 'Sistema',
      refundsIn: rInCaja,
      refundsOut: rFueraCaja,
      couponDisc,
      bogoDisc,
      bogoApps
    };

    setLastShiftSummary(summary);
    setStep('Z_REPORT');
    closeShift(finalCounts, authUserInfo?.name || 'Sistema');
  };

  const getZReportHTML = () => {
    if (!lastShiftSummary) return '';
    const s = lastShiftSummary;
    const isAdmin = authUserInfo?.role === Role.ADMIN || authUserInfo?.role === Role.ACCOUNTANT;
    
    // Saneamiento de variables usando safeText
    const safeBizName = safeText(businessConfig.name, { upper: true });
    const safeAddress = safeText(businessConfig.address, { maxLen: 35 });
    const safeShiftId = safeText(s.shift.id.slice(-6));
    const safeOpenedBy = safeText(s.shift.openedBy, { upper: true });
    const safeClosedBy = safeText(s.closedBy, { upper: true });

    return `
      <div style="font-family: 'Courier New', Courier, monospace; width: 72mm; color: #000; font-size: 10pt; line-height: 1.2;">
        <div style="text-align: center; margin-bottom: 4mm;">
          <h2 style="margin: 0; font-size: 13pt; font-weight: bold;">${safeBizName}</h2>
          <p style="margin: 1mm 0; font-size: 8pt;">${safeAddress}</p>
          <div style="border-bottom: 1px dashed #000; margin: 2mm 0;"></div>
          <p style="margin: 0; font-weight: bold; font-size: 11pt;">REPORTE DE CIERRE Z</p>
          <p style="margin: 0;">TURNO: #${safeShiftId}</p>
        </div>

        <div style="font-size: 8pt; margin-bottom: 3mm;">
          FECHA APERTURA: ${new Date(s.shift.openedAt).toLocaleString()}<br>
          FECHA CIERRE: ${new Date(s.closedAt).toLocaleString()}<br>
          OPERADOR APER.: ${safeOpenedBy}<br>
          OPERADOR CIER.: ${safeClosedBy}
        </div>

        <div style="border-bottom: 1px solid #000; margin-bottom: 2mm;"></div>
        <p style="font-weight: bold; margin: 0 0 1mm 0;">RESUMEN CONTABLE</p>
        <table style="width: 100%; font-size: 8pt; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left; padding: 1mm 0;">METODO</th>
            ${isAdmin ? '<th style="text-align: right;">SIS.</th>' : ''}
            <th style="text-align: right;">REAL</th>
          </tr>
          ${Object.entries(s.actual).map(([k, v]) => `
            <tr>
              <td style="padding: 1mm 0;">${safeText((k || '').replace('CASH_', 'EFECTIVO ').replace('_', ' '))}</td>
              ${isAdmin ? `<td style="text-align: right;">$${formatNum(Number(s.metrics[k]) || 0)}</td>` : ''}
              <td style="text-align: right; font-weight: bold;">$${formatNum(Number(v) || 0)}</td>
            </tr>
          `).join('')}
        </table>

        <div style="border-bottom: 1px solid #000; margin: 3mm 0 2mm 0;"></div>
        <p style="font-weight: bold; margin: 0 0 1mm 0;">REEMBOLSOS TURNO (CUP)</p>
        <div style="font-size: 8pt;">
            <div style="display:flex; justify-content: space-between;"><span>EN CAJA:</span><span>$${formatNum(s.refundsIn)}</span></div>
            <div style="display:flex; justify-content: space-between;"><span>FUERA CAJA:</span><span>$${formatNum(s.refundsOut)}</span></div>
            <div style="display:flex; justify-content: space-between; font-weight:bold; margin-top:1mm;"><span>TOTAL DEV.:</span><span>$${formatNum((Number(s.refundsIn) || 0) + (Number(s.refundsOut) || 0))}</span></div>
        </div>

        <div style="border-bottom: 1px solid #000; margin: 3mm 0 2mm 0;"></div>
        <p style="font-weight: bold; margin: 0 0 1mm 0;">DESCUENTOS Y OFERTAS</p>
        <div style="font-size: 8pt;">
            <div style="display:flex; justify-content: space-between;"><span>CUPONES:</span><span>$${formatNum(s.couponDisc)}</span></div>
            <div style="display:flex; justify-content: space-between;"><span>BOGO:</span><span>$${formatNum(s.bogoDisc)}</span></div>
            <div style="display:flex; justify-content: space-between;"><span>APPS BOGO:</span><span>${s.bogoApps}</span></div>
            <div style="display:flex; justify-content: space-between; font-weight:bold; margin-top:1mm;"><span>TOTAL DESC.:</span><span>$${formatNum((Number(s.couponDisc) || 0) + (Number(s.bogoDisc) || 0))}</span></div>
        </div>

        <div style="border-bottom: 1px solid #000; margin: 3mm 0 2mm 0;"></div>
        <p style="font-weight: bold; margin: 0 0 1mm 0;">MOVIMIENTO INVENTARIO (NETO)</p>
        <table style="width: 100%; font-size: 7pt; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left; padding: 1mm 0;">ITEM</th>
            <th style="text-align: right;">INI</th>
            <th style="text-align: right;">ENT</th>
            <th style="text-align: right;">VND</th>
            <th style="text-align: right;">FIN</th>
          </tr>
          ${(s.inventory || []).map((m: any) => `
            <tr>
              <td style="padding: 1mm 0; white-space: nowrap; overflow: hidden; max-width: 30mm;">${safeText(m.name, { upper: true })}</td>
              <td style="text-align: right;">${m.start}</td>
              <td style="text-align: right;">${m.entries || 0}</td>
              <td style="text-align: right; font-weight: bold;">${m.sales}</td>
              <td style="text-align: right;">${m.final}</td>
            </tr>
          `).join('')}
        </table>

        <div style="border-bottom: 1px dashed #000; margin: 3mm 0;"></div>
        <div style="text-align: center; font-weight: bold; font-size: 11pt;">
          VENTAS TURNO: $${formatNum(Number(s.totalGross) || 0)}
        </div>
        <p style="text-align: center; font-size: 8pt; margin-top: 5mm; opacity: 0.6;">--- FIN DEL REPORTE ---</p>
      </div>
    `;
  };

  const handlePrintZ = () => {
    const html = getZReportHTML();
    if (!html || html.trim() === '') {
      notify("Reporte vacío o inválido", "error");
      return;
    }

    // Usar iframe dinámico para evitar bloqueos de ventanas emergentes
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    
    // Inyectar el HTML con estilos
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>REPORTE Z</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 4mm; background: white; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `;

    iframe.onload = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    };

    document.body.appendChild(iframe);
  };

  const handleFinalReset = () => {
    logout();
    window.location.reload();
  };

  // RENDER: REPORTE Z
  if (step === 'Z_REPORT' && lastShiftSummary) {
    return (
      <div className="h-full bg-slate-950 flex flex-col items-center justify-start p-6 animate-in slide-in-from-bottom duration-700 overflow-y-auto pt-16">
          <div className="bg-emerald-50 text-emerald-600 p-10 rounded-[3rem] w-full max-sm mb-10 text-center shadow-2xl shadow-emerald-500/20 shrink-0">
             <CheckCircle size={64} className="mx-auto mb-4" />
             <h2 className="text-2xl font-black uppercase tracking-tighter leading-tight text-emerald-800">Ciclo Contable<br/>Cerrado</h2>
             <p className="text-[10px] font-bold uppercase opacity-80 mt-2">Imprima su comprobante Z ahora</p>
          </div>

          <div className="bg-white max-w-[350px] w-full p-8 shadow-2xl rounded-sm mb-10 animate-in fade-in duration-1000 delay-300">
              <div dangerouslySetInnerHTML={{ __html: getZReportHTML() }} />
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 w-full max-w-[350px] pb-10">
              <button onClick={handlePrintZ} className="flex-1 bg-white text-slate-900 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-all"><Printer size={16}/> Imprimir Reporte</button>
              <button onClick={handleFinalReset} className="flex-1 bg-brand-500 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-brand-600 transition-all">Nueva Jornada</button>
          </div>
      </div>
    );
  }

  // RENDER: APERTURA
  if (step === 'IDLE') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 p-4 animate-in fade-in">
        <div className="bg-white p-12 rounded-[4rem] shadow-2xl max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-brand-600 shadow-inner">
            <Unlock size={40} />
          </div>
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Apertura de Caja</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10">Inicie su jornada, {currentUser?.name}</p>
          
          <div className="bg-slate-100 p-8 rounded-3xl mb-8 border-2 border-transparent focus-within:border-brand-500 transition-all">
             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fondo Inicial CUP</label>
             <input 
              type="number" 
              autoFocus
              className="w-full bg-transparent text-center text-4xl font-black text-slate-800 outline-none" 
              placeholder="0.00" 
              value={startCashCUP}
              onChange={e => setStartCashCUP(e.target.value)}
             />
          </div>

          <button onClick={handleOpenShift} className="w-full bg-slate-900 text-white font-black py-6 rounded-2xl shadow-xl hover:bg-brand-600 transition-all uppercase tracking-widest text-xs">
            Abrir Turno
          </button>
          {onOpen && <button onClick={onOpen} className="mt-4 text-slate-300 font-black uppercase text-[10px] tracking-widest">Volver</button>}
        </div>
      </div>
    );
  }

  // RENDER: PIN DE CIERRE
  if (step === 'PIN') {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-sm w-full text-center border border-gray-100 animate-in zoom-in">
          <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 text-red-500 shadow-inner"><Key size={40}/></div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2">Autorizar Cierre</h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase mb-10 tracking-widest">Introduzca su PIN para realizar el arqueo</p>
          <input 
            type="password" 
            autoFocus 
            className="w-full bg-gray-50 border-none p-6 rounded-3xl text-center text-5xl mb-10 font-black outline-none focus:ring-4 focus:ring-brand-500/20" 
            value={pinInput} 
            onChange={e => setPinInput(e.target.value)} 
            maxLength={4} 
            onKeyDown={e => e.key === 'Enter' && handleVerifyPIN()} 
          />
          <div className="flex gap-4">
            <button onClick={handleVerifyPIN} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl">Validar</button>
            <button onClick={() => onOpen?.()} className="flex-1 bg-gray-100 text-slate-400 font-black py-5 rounded-2xl uppercase text-[10px] tracking-[0.2em]">Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: ARQUEO
  if (step === 'ARQUEO') {
    const isBlind = authUserInfo?.role === Role.DEPENDENT;
    return (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[210] flex items-center justify-center p-0 md:p-4 animate-in fade-in">
        <div className="bg-white rounded-none md:rounded-[4rem] w-full max-w-2xl h-full md:h-auto overflow-hidden flex flex-col shadow-2xl animate-in zoom-in">
          <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Arqueo Final Z</h2>
              <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest mt-1">Conteo físico obligatorio</p>
            </div>
            <button onClick={() => setStep('PIN')} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6">
             {Object.entries(expectedMetrics).map(([key, expected]) => {
                 const actual = parseFloat(actualCounts[key] || '0');
                 const expVal = Number(expected) || 0;
                 const diff = actual - expVal;
                 return (
                   <div key={key} className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-100 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest">{(key || '').replace('CASH_','').replace('_',' ')}</span>
                        {!isBlind && <span className="font-bold text-xs text-brand-600">Sistema: ${formatNum(expVal)}</span>}
                      </div>
                      <div className="flex gap-4 items-center">
                        <input 
                          type="number" 
                          className="flex-1 bg-white border-2 border-gray-200 p-5 rounded-2xl font-black text-2xl text-right outline-none focus:border-brand-500" 
                          placeholder="0.00" 
                          value={actualCounts[key] || ''} 
                          onChange={e => setActualCounts({...actualCounts, [key]: e.target.value})} 
                        />
                        {!isBlind && (
                            <div className={`w-32 text-right flex flex-col ${Math.abs(diff) < 0.01 ? 'text-emerald-500' : 'text-red-500'}`}>
                               <span className="text-[8px] font-black uppercase tracking-widest">Diferencia</span>
                               <span className="font-black text-sm">${formatNum(diff)}</span>
                            </div>
                        )}
                      </div>
                   </div>
                 );
             })}
          </div>

          <div className="p-8 bg-white border-t border-gray-100">
             <button onClick={handleConfirmClosure} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-xl uppercase tracking-[0.2em] text-xs hover:bg-brand-600 transition-all">
                Finalizar Turno y Firmar Z
             </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
