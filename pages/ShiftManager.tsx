import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Currency, View, Role, Product, Sale, LedgerEntry, Shift } from '../types';
import { Lock, Unlock, EyeOff, DollarSign, Receipt, Printer, AlertTriangle, ArrowDown, ArrowUp, X, Key, CheckSquare, Banknote, FileDown, CheckCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';

export const ShiftManager: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { activeShift, openShift, closeShift, getCurrentCash, setView, currentUser, validatePin, sales, ledger, products, businessConfig, currencies, notify } = useStore();
  
  const [showZReport, setShowZReport] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [superiorPin, setSuperiorPin] = useState('');
  const [lastClosedShift, setLastClosedShift] = useState<Shift | null>(null);
  
  const [actualCounts, setActualCounts] = useState<Record<string, string>>({});
  const [startCash, setStartCash] = useState<Record<string, string>>({ [Currency.CUP]: '', [Currency.USD]: '', [Currency.EUR]: '' });

  // --- FIX: Defined handleOpenShift to initialize shift with cash values ---
  const handleOpenShift = () => {
    const cash: Record<string, number> = {};
    // Fix: Explicitly type entries to avoid unknown types (Fixes line 23)
    Object.entries(startCash).forEach(([k, v]: [string, any]) => {
      const val = parseFloat(v as string);
      if (!isNaN(val) && val >= 0) cash[k] = val;
    });
    openShift(cash);
    if (onOpen) onOpen();
  };

  const formatNum = (num: number) => new Intl.NumberFormat('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

  const shiftMetrics = useMemo(() => {
    if (!activeShift) return null;
    const totals: Record<string, number> = {};
    const turnSales = sales.filter(s => s.shiftId === activeShift.id);
    const systemCash = getCurrentCash();
    // Fix: Explicitly type entries to avoid unknown types from getCurrentCash()
    Object.entries(systemCash).forEach(([curr, val]: [string, any]) => {
      totals[`CASH_${curr}`] = val as number;
    });
    turnSales.forEach(sale => {
      sale.payments.forEach(pay => {
        const key = `${pay.method}_${pay.currency}`;
        if (pay.method !== 'CASH') {
          totals[key] = (totals[key] || 0) + pay.amount;
        }
      });
    });
    return totals;
  }, [activeShift, sales, getCurrentCash]);

  const inventoryMovements = useMemo(() => {
    if (!activeShift) return [];
    const turnSales = sales.filter(s => s.shiftId === activeShift.id);
    const moves: Record<string, { name: string, sold: number, stock: number }> = {};
    products.forEach(p => {
        const totalStock = p.variants?.length ? p.variants.reduce((a, b) => a + (b.stock || 0), 0) : (p.stock || 0);
        moves[p.id] = { name: p.name, sold: 0, stock: totalStock };
    });
    turnSales.forEach(sale => {
        sale.items.forEach(item => {
            if (moves[item.id]) moves[item.id].sold += item.quantity;
        });
    });
    return Object.entries(moves).filter(([_, data]) => data.sold > 0 || data.stock < 10);
  }, [sales, activeShift, products]);

  const hasDifference = useMemo(() => {
    if (!shiftMetrics) return false;
    // Fix: Explicitly type entries to avoid unknown issues
    return Object.entries(shiftMetrics).some(([key, expected]: [string, any]) => {
      const actual = parseFloat(actualCounts[key] || '0');
      return Math.abs((expected as number) - actual) > 0.01;
    });
  }, [shiftMetrics, actualCounts]);

  const printRawHTML = (html: string) => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      notify("Habilite ventanas emergentes para imprimir", "error");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte Z</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 4mm; font-family: 'Courier New', Courier, monospace; font-size: 9pt; color: #000; width: 72mm; }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .dashed { border-top: 1px dashed #000; margin: 3mm 0; }
            table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
            th, td { text-align: left; vertical-align: top; padding: 1mm 0; }
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

  const getReportZHTML = () => {
    if (!lastClosedShift) return '';
    const turnSales = sales.filter(s => s.shiftId === lastClosedShift.id);
    // Fix: Explicitly type reduce parameters to avoid arithmetic errors (Fixes line 71)
    const totalGross = turnSales.reduce((acc: number, s: any) => acc + (s.total as number), 0);

    return `
      <div class="center">
        <h2 class="bold" style="font-size: 13pt; margin: 0;">${businessConfig.name.toUpperCase()}</h2>
        <p style="margin: 1mm 0;">REPORTE DE CIERRE Z</p>
        <p class="bold">ID: ${lastClosedShift.id.slice(-8)}</p>
      </div>
      
      <div class="dashed"></div>
      
      <div style="font-size: 8pt; line-height: 1.4;">
        APERTURA: ${new Date(lastClosedShift.openedAt).toLocaleString()}<br>
        CIERRE: ${new Date(lastClosedShift.closedAt!).toLocaleString()}<br>
        CAJERO: ${lastClosedShift.openedBy.toUpperCase()}<br>
        AUDITOR: ${lastClosedShift.closedBy!.toUpperCase()}
      </div>

      <div class="dashed"></div>
      <h4 class="center bold" style="margin: 0;">RESUMEN DE CAJA</h4>
      <table>
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th>MÉTODO</th>
            <th class="right">SIS</th>
            <th class="right">REAL</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(shiftMetrics || {}).map(([key, expected]: [string, any]) => {
            const actual = lastClosedShift.actualCash?.[key] || 0;
            return `<tr><td>${key.replace('_',' ')}</td><td class="right">$${formatNum(expected as number)}</td><td class="right" class="bold">$${formatNum(actual)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>

      <div class="dashed"></div>
      <h4 class="center bold" style="margin: 0;">MOVIMIENTOS STOCK</h4>
      <table>
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th>ITEM</th>
            <th class="right">VND</th>
            <th class="right">ACT</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryMovements.map(([_, d]: [string, any]) => `<tr><td>${d.name.toUpperCase().substring(0,18)}</td><td class="right">${d.sold}</td><td class="right">${d.stock}</td></tr>`).join('')}
        </tbody>
      </table>

      <div class="dashed"></div>
      <div class="center bold" style="font-size: 11pt;">
        TOTAL VENTAS: $${formatNum(totalGross)}
      </div>
      <p class="center" style="margin-top: 10mm; font-size: 8pt; opacity: 0.5;">--- FIN DEL REPORTE ---</p>
    `;
  };

  const handlePrintZReport = () => {
    const html = getReportZHTML();
    printRawHTML(html);
  };

  const handleProcessFinalClosure = (authorizedBy: string) => {
    const finalActual: Record<string, number> = {};
    // Fix: Explicitly type entries to avoid unknown types (Fixes line 141)
    Object.entries(actualCounts).forEach(([k, v]: [string, any]) => finalActual[k] = parseFloat(v as string) || 0);
    const closingShift = { ...activeShift!, closedAt: new Date().toISOString(), closedBy: authorizedBy, actualCash: finalActual };
    setLastClosedShift(closingShift);
    closeShift(finalActual, authorizedBy);
    setShowClosureModal(false);
    setShowZReport(true);
    notify("Turno cerrado con éxito", "success");
  };

  const handleVerifySuperior = async () => {
    const user = await validatePin(superiorPin);
    if (user && (user.role === Role.ADMIN || user.role === Role.ACCOUNTANT)) {
      // Fix: Cast user.name to string to ensure type safety (Fixes line 176)
      handleProcessFinalClosure(user.name as string);
      setShowPinModal(false);
      setSuperiorPin('');
    } else {
      notify("PIN inválido o sin privilegios", "error");
      setSuperiorPin('');
    }
  };

  const handleResetToStart = () => {
    setShowZReport(false);
    setLastClosedShift(null);
    setActualCounts({});
    setStartCash({ [Currency.CUP]: '', [Currency.USD]: '', [Currency.EUR]: '' });
    if (onOpen) onOpen();
  };

  if (!activeShift && !showZReport) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-100 p-4 animate-in fade-in">
        <div className="bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl max-w-lg w-full border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-brand-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-brand-600 shadow-inner"><Unlock size={32} /></div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">Apertura</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Inicie su jornada, {currentUser?.name}</p>
          </div>
          <div className="space-y-6">
            <div className="bg-slate-900 p-5 rounded-2xl border-b-4 border-brand-500 shadow-xl flex items-center justify-between">
               <span className="font-black text-brand-400 text-[10px] tracking-widest uppercase">FONDO CUP</span>
               <input type="number" className="bg-transparent text-right font-black text-2xl text-white outline-none w-32" placeholder="0.00" value={startCash['CUP']} onChange={e => setStartCash({...startCash, CUP: e.target.value})} autoFocus />
            </div>
            <button onClick={handleOpenShift} className="w-full bg-brand-500 hover:bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
              <Unlock size={18}/> Iniciar Turno
            </button>
            {onOpen && <button onClick={onOpen} className="w-full text-slate-400 font-black py-2 uppercase text-[10px] tracking-widest">Volver</button>}
          </div>
        </div>
      </div>
    );
  }

  if (activeShift && !showZReport) {
    return (
      <div className="p-4 md:p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-5">
                <div className="bg-emerald-50 text-emerald-600 p-4 rounded-3xl shadow-inner"><Unlock size={32} /></div>
                <div>
                   <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Turno en Curso</h1>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Abierto a las {new Date(activeShift.openedAt).toLocaleTimeString()}</p>
                </div>
             </div>
             <div className="flex gap-2">
                <button onClick={() => setShowClosureModal(true)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-red-600 transition-all flex items-center gap-2"><ArrowUp size={16}/> Cerrar Turno</button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2"><DollarSign size={14}/> Estado de Caja Esperado</h3>
                <div className="space-y-3">
                   {/* Fix: Explicitly type entries to avoid unknown issues (Fixes line 253) */}
                   {Object.entries(shiftMetrics || {}).map(([key, expected]: [string, any]) => (
                     <div key={key} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="font-black text-slate-400 text-[9px] uppercase tracking-tighter">{key.replace('_',' ')}</span>
                        <span className="font-black text-lg text-slate-800">${formatNum(expected as number)}</span>
                     </div>
                   ))}
                </div>
             </div>
             <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl flex flex-col justify-center">
                <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] mb-4">Información de Seguridad</p>
                <p className="text-sm font-bold text-slate-300 leading-relaxed mb-8">El sistema requiere autorización de administración para procesar el arqueo final. Asegúrese de que el conteo real coincida exactamente.</p>
                <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-3"><AlertTriangle className="text-amber-400" size={20}/><span className="text-[9px] font-black uppercase tracking-widest">Autorización requerida</span></div>
             </div>
          </div>
        </div>

        {showClosureModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[120] p-0 md:p-4 animate-in fade-in">
            <div className="bg-white rounded-none md:rounded-[3rem] w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in">
              <div className="p-6 md:p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter">Arqueo Z Obligatorio</h2>
                  <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Introduzca los montos físicos reales</p>
                </div>
                <button onClick={() => setShowClosureModal(false)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
                 {/* Fix: Explicitly type entries to avoid unknown issues (Fixes lines 279, 284) */}
                 {Object.entries(shiftMetrics || {}).map(([key, expected]: [string, any]) => {
                     const actual = parseFloat(actualCounts[key] || '0');
                     const diff = actual - (expected as number);
                     return (
                       <div key={key} className="bg-gray-50 p-4 md:p-6 rounded-[2rem] border border-gray-100 flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-slate-400 text-[10px] uppercase tracking-tighter">{key.replace('_',' ')}</span>
                            <span className="font-bold text-xs text-brand-600">Sistema: ${formatNum(expected as number)}</span>
                          </div>
                          <div className="flex gap-3 items-center">
                            <input type="number" className="flex-1 bg-white border-2 border-gray-200 p-4 rounded-2xl font-black text-lg text-right outline-none focus:border-brand-500" placeholder="0.00" value={actualCounts[key] || ''} onChange={e => setActualCounts({...actualCounts, [key]: e.target.value})} />
                            <div className={`w-24 text-right flex flex-col ${Math.abs(diff) < 0.01 ? 'text-emerald-500' : 'text-red-500'}`}>
                               <span className="text-[8px] font-black uppercase">Dif.</span>
                               <span className="font-black text-xs">${formatNum(diff as number)}</span>
                            </div>
                          </div>
                       </div>
                     );
                 })}
              </div>
              <div className="p-6 md:p-8 bg-white border-t border-gray-100 shrink-0">
                <button 
                  disabled={hasDifference}
                  onClick={() => { if (currentUser?.role === Role.ADMIN || currentUser?.role === Role.ACCOUNTANT) handleProcessFinalClosure(currentUser.name); else setShowPinModal(true); }}
                  className={`w-full font-black py-6 rounded-[2rem] shadow-xl uppercase tracking-widest text-xs transition-all ${hasDifference ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-brand-600'}`}
                >
                  Finalizar y Firmar Reporte Z
                </button>
              </div>
            </div>
          </div>
        )}

        {showPinModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
            <div className="bg-white p-8 rounded-[3rem] shadow-2xl max-sm w-full text-center border border-gray-100 animate-in zoom-in">
              <div className="bg-brand-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-600 shadow-inner"><Key size={32}/></div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Firma Superior</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase mb-8">Requiere PIN de Admin o Contador</p>
              <input type="password" autoFocus className="w-full bg-gray-50 border-none p-5 rounded-2xl text-center text-4xl mb-6 font-black outline-none focus:ring-4 focus:ring-brand-500/20" value={superiorPin} onChange={e => setSuperiorPin(e.target.value)} maxLength={4} onKeyDown={e => e.key === 'Enter' && handleVerifySuperior()} />
              <div className="flex gap-2">
                <button onClick={handleVerifySuperior} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-xl">Validar</button>
                <button onClick={() => { setShowPinModal(false); setSuperiorPin(''); }} className="flex-1 bg-gray-100 text-slate-400 font-black py-4 rounded-xl uppercase text-[10px] tracking-widest">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showZReport) {
    return (
      <div className="p-4 md:p-8 bg-slate-900 h-full flex flex-col items-center overflow-y-auto animate-in slide-in-from-bottom duration-700">
          <div className="bg-emerald-500 text-white p-8 rounded-[3rem] w-full max-w-sm mb-10 text-center shadow-2xl shadow-emerald-500/20 animate-in zoom-in">
             <CheckCircle size={64} className="mx-auto mb-4" />
             <h2 className="text-2xl font-black uppercase tracking-tighter">Turno Finalizado</h2>
             <p className="text-[10px] font-bold uppercase opacity-80 mt-1">Cierre contable procesado</p>
          </div>

          <div className="bg-white max-w-[350px] w-full p-8 shadow-2xl rounded-sm font-mono text-sm relative mb-10">
              <div id="printable-z-report-area">
                <div className="text-center mb-6">
                    <h2 style={{fontSize:'12pt', margin:0}}>${businessConfig.name.toUpperCase()}</h2>
                    <p style={{fontSize:'8pt'}}>${businessConfig.address}</p>
                    <div style={{borderBottom:'1px dashed #000', margin:'4mm 0'}}></div>
                    <h3 style={{fontSize:'10pt', textDecoration:'underline'}}>REPORTE FINAL Z</h3>
                </div>
                <div style={{fontSize:'8pt', lineHeight: 1.4}}>
                    APERTURA: ${new Date(lastClosedShift?.openedAt || '').toLocaleString()}<br/>
                    CIERRE: ${new Date(lastClosedShift?.closedAt || '').toLocaleString()}<br/>
                    CAJERO: ${lastClosedShift?.openedBy.toUpperCase()}<br/>
                    AUDITOR: ${lastClosedShift?.closedBy?.toUpperCase()}
                </div>
                <div style={{borderBottom:'1px dashed #000', margin:'4mm 0'}}></div>
                <table style={{width:'100%', fontSize:'8pt'}}>
                    <thead><tr><th style={{textAlign:'left'}}>ARQUEO</th><th style={{textAlign:'right'}}>SIS</th><th style={{textAlign:'right'}}>REAL</th></tr></thead>
                    <tbody>
                        {/* Fix: Explicitly type entries */}
                        {Object.entries(shiftMetrics || {}).map(([key, expected]: [string, any]) => (
                            <tr key={key}>
                                <td style={{padding:'1mm 0'}}>{key.replace('_',' ')}</td>
                                <td style={{textAlign:'right'}}>${formatNum(expected as number)}</td>
                                <td style={{textAlign:'right', fontWeight:'bold'}}>${formatNum(lastClosedShift?.actualCash?.[key] || 0)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{borderBottom:'1px dashed #000', margin:'4mm 0'}}></div>
                <div style={{textAlign:'center', padding:'4mm 0'}}>
                    {/* Fix: Explicitly type reduce parameters to avoid arithmetic and conversion errors (Fixes line 358) */}
                    <p style={{fontSize:'11pt', fontWeight:'bold', margin:0}}>TOTAL: ${formatNum(sales.filter(s => s.shiftId === lastClosedShift?.id).reduce((acc: number, s: any) => acc + (s.total as number), 0))}</p>
                </div>
              </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 w-full max-w-[350px]">
              <button onClick={handlePrintZReport} className="flex-1 bg-white text-slate-900 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2"><Printer size={16}/> Imprimir Z</button>
              <button onClick={handleResetToStart} className="flex-1 bg-brand-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Finalizar Sesión</button>
          </div>
      </div>
    );
  }

  return null;
};
