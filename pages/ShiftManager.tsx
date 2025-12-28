
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Currency, View, Role, Product, Sale, LedgerEntry, Shift } from '../types';
import { Lock, Unlock, EyeOff, DollarSign, Receipt, Printer, AlertTriangle, ArrowDown, ArrowUp, X, Key, CheckSquare, Banknote, FileDown, CheckCircle, Package } from 'lucide-react';
import { jsPDF } from 'jspdf';

export const ShiftManager: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { 
    activeShift, openShift, closeShift, getCurrentCash, setView, currentUser, validatePin, 
    sales, ledger, products, businessConfig, currencies, notify, logout 
  } = useStore();
  
  const [showZReport, setShowZReport] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [superiorPin, setSuperiorPin] = useState('');
  const [lastClosedShift, setLastClosedShift] = useState<Shift | null>(null);
  
  const [actualCounts, setActualCounts] = useState<Record<string, string>>({});
  const [startCash, setStartCash] = useState<Record<string, string>>({ [Currency.CUP]: '' });

  const handleOpenShift = () => {
    const cash: Record<string, number> = { CUP: parseFloat(startCash.CUP) || 0 };
    openShift(cash);
    if (onOpen) onOpen();
  };

  const formatNum = (num: number) => new Intl.NumberFormat('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

  const shiftMetrics = useMemo(() => {
    if (!activeShift) return null;
    const totals: Record<string, number> = {};
    const turnSales = sales.filter(s => s.shiftId === activeShift.id);
    const systemCash = getCurrentCash();
    
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

  // Prompt 2: Reporte Z con Movimiento de Inventario
  const inventoryMovements = useMemo(() => {
    const currentShift = activeShift || lastClosedShift;
    if (!currentShift || !currentShift.initialStock) return [];
    
    const turnSales = sales.filter(s => s.shiftId === currentShift.id);
    const moves: Record<string, { name: string, start: number, entries: string, salesCount: number, final: number }> = {};
    
    // Capturar productos y variantes involucrados
    products.forEach(p => {
        const startParent = currentShift.initialStock?.[p.id] || 0;
        const salesParent = turnSales.reduce((acc, s) => {
            const item = s.items.find(i => i.id === p.id && !i.selectedVariantId);
            return acc + (item?.quantity || 0);
        }, 0);
        
        if (startParent > 0 || salesParent > 0) {
            moves[p.id] = { 
                name: p.name, 
                start: startParent, 
                entries: '—', 
                salesCount: salesParent, 
                final: p.stock || 0 
            };
        }

        p.variants.forEach(v => {
            const vKey = `${p.id}-${v.id}`;
            const startV = currentShift.initialStock?.[vKey] || 0;
            const salesV = turnSales.reduce((acc, s) => {
                const item = s.items.find(i => i.selectedVariantId === v.id);
                return acc + (item?.quantity || 0);
            }, 0);

            if (startV > 0 || salesV > 0) {
                moves[vKey] = { 
                    name: `${p.name} (${v.name})`, 
                    start: startV, 
                    entries: '—', 
                    salesCount: salesV, 
                    final: v.stock || 0 
                };
            }
        });
    });

    return Object.values(moves);
  }, [sales, activeShift, lastClosedShift, products]);

  const handleVerifySuperior = async () => {
    const user = await validatePin(superiorPin);
    if (user) {
        // Proceder al modal de conteo real
        // Aquí guardamos el rol para saber si es ciego o transparente
        setShowPinModal(false);
        setSuperiorPin('');
        setShowClosureModal(true);
    } else {
        notify("PIN inválido", "error");
        setSuperiorPin('');
    }
  };

  const handleProcessFinalClosure = (authorizedBy: string) => {
    const finalActual: Record<string, number> = {};
    Object.entries(actualCounts).forEach(([k, v]: [string, any]) => finalActual[k] = parseFloat(v as string) || 0);
    
    // Validar diferencia cero
    const hasDiff = Object.entries(shiftMetrics || {}).some(([key, expected]) => {
        const actual = finalActual[key] || 0;
        return Math.abs((expected as number) - actual) > 0.01;
    });

    if (hasDiff) {
        notify("No se puede cerrar: Hay diferencias entre sistema y conteo real.", "error");
        return;
    }

    const closingShift = { 
      ...activeShift!, 
      closedAt: new Date().toISOString(), 
      closedBy: authorizedBy, 
      actualCash: finalActual 
    };
    
    setLastClosedShift(closingShift);
    closeShift(finalActual, authorizedBy);
    setShowClosureModal(false);
    setShowZReport(true);
  };

  const getReportZHTML = () => {
    if (!lastClosedShift) return '';
    const turnSales = sales.filter(s => s.shiftId === lastClosedShift.id);
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
            <th class="right">REAL</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(shiftMetrics || {}).map(([key, expected]: [string, any]) => {
            const actual = lastClosedShift.actualCash?.[key] || 0;
            return `<tr><td>${key.replace('_',' ')}</td><td class="right">$${formatNum(actual)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>

      <div class="dashed"></div>
      <h4 class="center bold" style="margin: 0;">MOVIMIENTOS INVENTARIO</h4>
      <table>
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th>ITEM</th>
            <th class="right">INI</th>
            <th class="right">VND</th>
            <th class="right">FIN</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryMovements.map(m => `
            <tr>
              <td>${m.name.toUpperCase().substring(0,15)}</td>
              <td class="right">${m.start}</td>
              <td class="right">${m.salesCount}</td>
              <td class="right">${m.final}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="dashed"></div>
      <div class="center bold" style="font-size: 11pt;">
        VENTAS TURNO: $${formatNum(totalGross)}
      </div>
    `;
  };

  const handlePrintZReport = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><style>@page { size: 80mm auto; margin: 0; } body { font-family: Courier; padding: 4mm; width: 72mm; } .center { text-align: center; } .right { text-align: right; } .bold { font-weight: bold; } .dashed { border-top: 1px dashed #000; margin: 3mm 0; } table { width: 100%; border-collapse: collapse; } th, td { padding: 1mm 0; font-size: 9pt; }</style></head><body>${getReportZHTML()}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleResetToStart = () => {
    setShowZReport(false);
    setLastClosedShift(null);
    setActualCounts({});
    setStartCash({ CUP: '' });
    // Al ser logout, StoreContext ya nos mandará a PIN Lock
  };

  if (!activeShift && !showZReport) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 p-4 animate-in fade-in">
        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-brand-600"><Unlock size={32} /></div>
            <h1 className="text-2xl font-black text-slate-900 uppercase">Apertura de Caja</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Inicie su turno, {currentUser?.name}</p>
          </div>
          <div className="space-y-6">
            <div className="bg-slate-100 p-6 rounded-2xl border-2 border-transparent focus-within:border-brand-500 transition-all">
               <span className="font-black text-slate-400 text-[10px] tracking-widest uppercase">Fondo Inicial (CUP)</span>
               <input 
                type="number" 
                className="w-full bg-transparent font-black text-3xl text-slate-800 outline-none mt-2" 
                placeholder="0.00" 
                value={startCash.CUP} 
                onChange={e => setStartCash({CUP: e.target.value})} 
                autoFocus 
               />
            </div>
            <button onClick={handleOpenShift} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-brand-600 transition-all uppercase tracking-widest text-xs">
               Iniciar Turno
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeShift && !showZReport) {
    // Check if we already have the valid user for closing
    return (
      <div className="p-4 md:p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-5">
                <div className="bg-emerald-50 text-emerald-600 p-4 rounded-3xl"><Unlock size={32} /></div>
                <div>
                   <h1 className="text-2xl font-black text-slate-800 uppercase">Turno Activo</h1>
                   <p className="text-[10px] text-slate-400 font-bold uppercase">Abierto por {activeShift.openedBy} • {new Date(activeShift.openedAt).toLocaleTimeString()}</p>
                </div>
             </div>
             <button onClick={() => setShowPinModal(true)} className="bg-red-500 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-red-600 transition-all flex items-center gap-2"><ArrowUp size={16}/> Finalizar Turno</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2"><DollarSign size={14}/> Fondo Actual</h3>
                <div className="space-y-3">
                   {Object.entries(shiftMetrics || {}).map(([key, expected]: [string, any]) => (
                     <div key={key} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="font-black text-slate-400 text-[9px] uppercase">{key.replace('_',' ')}</span>
                        <span className="font-black text-lg text-slate-800">${formatNum(expected as number)}</span>
                     </div>
                   ))}
                </div>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2"><Package size={14}/> Movimiento de Inventario</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {inventoryMovements.map((m, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-600 truncate flex-1 pr-2">{m.name}</span>
                            <div className="flex gap-4 text-center">
                                <div className="w-10">
                                    <p className="text-[8px] uppercase text-gray-400">INI</p>
                                    <p className="text-xs font-black">{m.start}</p>
                                </div>
                                <div className="w-10">
                                    <p className="text-[8px] uppercase text-gray-400">VND</p>
                                    <p className="text-xs font-black text-brand-600">{m.salesCount}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        </div>

        {/* MODAL PIN PARA CERRAR */}
        {showPinModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-sm w-full text-center">
              <div className="bg-brand-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-brand-600 shadow-inner"><Key size={32}/></div>
              <h2 className="text-xl font-black text-slate-800 uppercase">Validar Cierre</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase mb-8">Introduzca PIN de Operador o Admin</p>
              <input type="password" autoFocus className="w-full bg-gray-100 border-none p-5 rounded-2xl text-center text-4xl mb-6 font-black outline-none" value={superiorPin} onChange={e => setSuperiorPin(e.target.value)} maxLength={4} onKeyDown={e => e.key === 'Enter' && handleVerifySuperior()} />
              <div className="flex gap-2">
                <button onClick={handleVerifySuperior} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-xl">Confirmar</button>
                <button onClick={() => setShowPinModal(false)} className="flex-1 bg-gray-100 text-slate-400 font-black py-4 rounded-xl uppercase text-[10px] tracking-widest">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CONTEO REAL (MODO CIEGO VS CON ESPERADO) */}
        {showClosureModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[210] p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl animate-in zoom-in overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Arqueo de Turno</h2>
                  <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Conteo físico de valores</p>
                </div>
                <button onClick={() => setShowClosureModal(false)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                 {Object.entries(shiftMetrics || {}).map(([key, expected]: [string, any]) => {
                     const isDependent = currentUser?.role === Role.DEPENDENT;
                     const actual = parseFloat(actualCounts[key] || '0');
                     const diff = actual - (expected as number);
                     
                     return (
                       <div key={key} className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest">{key.replace('_',' ')}</span>
                            {!isDependent && <span className="font-bold text-xs text-brand-600">Sistema: ${formatNum(expected as number)}</span>}
                          </div>
                          <div className="flex gap-4 items-center">
                            <input 
                                type="number" 
                                className="flex-1 bg-white border-2 border-gray-200 p-5 rounded-2xl font-black text-xl text-right outline-none focus:border-brand-500" 
                                placeholder="0.00" 
                                value={actualCounts[key] || ''} 
                                onChange={e => setActualCounts({...actualCounts, [key]: e.target.value})} 
                            />
                            {!isDependent && (
                                <div className={`w-24 text-right flex flex-col ${Math.abs(diff) < 0.01 ? 'text-emerald-500' : 'text-red-500'}`}>
                                   <span className="text-[8px] font-black uppercase">Diferencia</span>
                                   <span className="font-black text-xs">${formatNum(diff)}</span>
                                </div>
                            )}
                          </div>
                       </div>
                     );
                 })}
              </div>
              <div className="p-8 bg-white border-t border-gray-100 shrink-0">
                <button onClick={() => handleProcessFinalClosure(currentUser?.name || 'Sistema')} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-xl uppercase tracking-widest text-xs hover:bg-brand-600 transition-all">
                  Cerrar y Firmar Turno
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showZReport) {
    return (
      <div className="p-4 md:p-8 bg-slate-950 h-full flex flex-col items-center overflow-y-auto animate-in slide-in-from-bottom duration-700">
          <div className="bg-emerald-500 text-white p-10 rounded-[3rem] w-full max-w-sm mb-10 text-center shadow-2xl">
             <CheckCircle size={64} className="mx-auto mb-4" />
             <h2 className="text-2xl font-black uppercase">Turno Finalizado</h2>
             <p className="text-[10px] font-bold uppercase opacity-80 mt-1">Reporte Z generado con éxito</p>
          </div>

          <div className="bg-white max-w-[350px] w-full p-8 shadow-2xl rounded-sm font-mono text-xs relative mb-10 overflow-hidden">
              <div id="printable-z-report-area">
                 {/* Reutilización del reporte visual */}
                 <div dangerouslySetInnerHTML={{ __html: getReportZHTML() }} />
              </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 w-full max-w-[350px]">
              <button onClick={handlePrintZReport} className="flex-1 bg-white text-slate-900 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2"><Printer size={16}/> Imprimir</button>
              <button onClick={handleResetToStart} className="flex-1 bg-brand-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Nuevo Ciclo</button>
          </div>
      </div>
    );
  }

  return null;
};
