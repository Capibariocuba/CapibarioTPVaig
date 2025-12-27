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
  
  // Guardamos el conteo real por cada llave única (Metodo_Divisa)
  const [actualCounts, setActualCounts] = useState<Record<string, string>>({});
  const [startCash, setStartCash] = useState<Record<string, string>>({ [Currency.CUP]: '', [Currency.USD]: '', [Currency.EUR]: '' });

  // Totales financieros del turno activo
  const shiftMetrics = useMemo(() => {
    if (!activeShift) return null;
    const totals: Record<string, number> = {};
    const turnSales = sales.filter(s => s.shiftId === activeShift.id);

    // Inicializar con lo que hay en ledger de este turno + fondo inicial
    const systemCash = getCurrentCash();
    Object.entries(systemCash).forEach(([curr, val]) => {
      totals[`CASH_${curr}`] = val as number;
    });

    // Sumar el resto de métodos (Transferencias, etc.)
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
    return Object.entries(shiftMetrics).some(([key, expected]) => {
      const actual = parseFloat(actualCounts[key] || '0');
      return Math.abs(expected - actual) > 0.01;
    });
  }, [shiftMetrics, actualCounts]);

  const handleOpenShift = () => {
    const cashNumbers: Record<string, number> = {};
    currencies.forEach(c => {
      cashNumbers[c.code] = parseFloat(startCash[c.code]) || 0;
    });
    openShift(cashNumbers);
    if (onOpen) onOpen();
    else setView(View.POS);
  };

  const handleProcessFinalClosure = (authorizedBy: string) => {
    const finalActual: Record<string, number> = {};
    Object.entries(actualCounts).forEach(([k, v]) => finalActual[k] = parseFloat(v) || 0);
    
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
      handleProcessFinalClosure(user.name);
      setShowPinModal(false);
      setSuperiorPin('');
    } else {
      notify("PIN inválido o sin privilegios", "error");
      setSuperiorPin('');
    }
  };

  const handlePrintZReport = () => {
    const printArea = document.getElementById('pos-ticket-print');
    if (printArea && lastClosedShift) {
        printArea.innerHTML = getReportZHTML();
        window.print();
    }
  };

  const getReportZHTML = () => {
    if (!lastClosedShift) return '';
    const turnSales = sales.filter(s => s.shiftId === lastClosedShift.id);
    const totalGross = turnSales.reduce((acc, s) => acc + s.total, 0);

    return `
      <div style="font-family: 'Courier New', Courier, monospace; color: black; background: white; padding: 5mm; font-size: 9pt;">
        <div style="text-align: center; border-bottom: 1pt dashed #000; padding-bottom: 4mm; margin-bottom: 4mm;">
          <h2 style="margin: 0; font-size: 14pt;">${businessConfig.name.toUpperCase()}</h2>
          <p style="margin: 1mm 0;">REPORTE DE CIERRE Z</p>
          <p style="font-size: 8pt;">ID: ${lastClosedShift.id.slice(-8)}</p>
        </div>
        
        <div style="margin-bottom: 4mm;">
          <div style="display: flex; justify-content: space-between;"><span>APERTURA:</span><span>${new Date(lastClosedShift.openedAt).toLocaleString()}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>CIERRE:</span><span>${new Date(lastClosedShift.closedAt!).toLocaleString()}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>CAJERO:</span><span>${lastClosedShift.openedBy.toUpperCase()}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>AUDITOR:</span><span>${lastClosedShift.closedBy!.toUpperCase()}</span></div>
        </div>

        <div style="border-top: 1pt solid #000; padding-top: 2mm; margin-bottom: 4mm;">
          <h4 style="margin: 0 0 2mm 0; text-align: center;">RESUMEN DE CAJA</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <thead style="border-bottom: 0.5pt solid #000;">
              <tr><th style="text-align: left;">MÉTODO</th><th style="text-align: center;">SIS</th><th style="text-align: right;">REAL</th></tr>
            </thead>
            <tbody>
              ${Object.entries(shiftMetrics || {}).map(([key, expected]) => {
                const actual = lastClosedShift.actualCash?.[key] || 0;
                return `<tr><td>${key.replace('_',' ')}</td><td style="text-align: center;">$${expected.toFixed(2)}</td><td style="text-align: right;">$${actual.toFixed(2)}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="border-top: 1pt solid #000; padding-top: 2mm; margin-bottom: 4mm;">
          <h4 style="margin: 0 0 2mm 0; text-align: center;">PRODUCTOS VENDIDOS</h4>
          <table style="width: 100%; font-size: 8pt;">
            <thead><tr><th style="text-align: left;">ITEM</th><th style="text-align: center;">VND</th><th style="text-align: right;">STK</th></tr></thead>
            <tbody>
              ${inventoryMovements.map(([_, d]) => `<tr><td>${d.name.toUpperCase()}</td><td style="text-align: center;">${d.sold}</td><td style="text-align: right;">${d.stock}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div style="text-align: center; margin-top: 10mm; border-top: 1pt dashed #000; padding-top: 4mm;">
           <p style="margin: 0; font-weight: bold;">TOTAL VENTAS: $${totalGross.toFixed(2)}</p>
           <p style="margin: 4mm 0 0 0; opacity: 0.5;">www.capibario.com</p>
        </div>
      </div>
    `;
  };

  const handleDownloadZPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 250] });
    // Lógica similar al ticket de POS pero con datos de Arqueo
    doc.setFont('courier', 'bold');
    doc.text('REPORTE Z - ' + businessConfig.name, 40, 15, { align: 'center' });
    // ... simplificado por espacio, implementando estructura de datos
    doc.save(`ReporteZ_${lastClosedShift?.id.slice(-6)}.pdf`);
  };

  // FIX CRASH: Handler to reset state locally instead of window.location.reload()
  const handleResetToStart = () => {
    setShowZReport(false);
    setLastClosedShift(null);
    if (onOpen) onOpen();
  };

  if (!activeShift && !showZReport) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-100 p-4 animate-in fade-in">
        <div className="bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl max-w-lg w-full border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-brand-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-brand-600 shadow-inner"><Unlock size={32} /></div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-2">Apertura</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Inicie su jornada, {currentUser?.name}</p>
          </div>
          <div className="space-y-6">
            <div className="bg-slate-900 p-5 rounded-2xl border-b-4 border-brand-500 shadow-xl flex items-center justify-between">
               <span className="font-black text-brand-400 text-[10px] tracking-widest uppercase">FONDO CUP</span>
               <input type="number" className="bg-transparent text-right font-black text-2xl text-white outline-none w-32" placeholder="0.00" value={startCash['CUP']} onChange={e => setStartCash({...startCash, CUP: e.target.value})} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
               {currencies.filter(c => c.code !== 'CUP').map(c => (
                 <div key={c.code} className="bg-gray-50 p-4 rounded-xl flex items-center justify-between border border-gray-100">
                    <span className="font-black text-slate-400 text-[9px] uppercase">{c.code}</span>
                    <input type="number" className="bg-transparent text-right font-black text-xs outline-none w-16" placeholder="0.00" value={startCash[c.code]} onChange={e => setStartCash({...startCash, [c.code]: e.target.value})} />
                 </div>
               ))}
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
                {onOpen && <button onClick={onOpen} className="bg-white text-slate-400 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-gray-200">Volver a Ventas</button>}
                <button onClick={() => setShowClosureModal(true)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-red-600 transition-all flex items-center gap-2"><ArrowUp size={16}/> Cerrar Turno</button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2"><DollarSign size={14}/> Estado de Caja Esperado</h3>
                <div className="space-y-3">
                   {Object.entries(shiftMetrics || {}).map(([key, expected]) => (
                     <div key={key} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="font-black text-slate-400 text-[9px] uppercase tracking-tighter">{key.replace('_',' ')}</span>
                        <span className="font-black text-lg text-slate-800">${expected.toFixed(2)}</span>
                     </div>
                   ))}
                </div>
             </div>
             <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl flex flex-col justify-center">
                <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] mb-4">Información de Seguridad</p>
                <p className="text-sm font-bold text-slate-300 leading-relaxed mb-8">El sistema bloquea el cierre si existen diferencias contables. Asegúrese de realizar el conteo físico de billetes y validación de transferencias antes de proceder.</p>
                <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-3"><AlertTriangle className="text-amber-400" size={20}/><span className="text-[9px] font-black uppercase tracking-widest">Autorización de {currentUser?.role === Role.DEPENDENT ? 'ADMIN' : 'SISTEMA'} requerida</span></div>
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
                <div className="space-y-3">
                   {Object.entries(shiftMetrics || {}).map(([key, expected]) => {
                     const actual = parseFloat(actualCounts[key] || '0');
                     const diff = actual - expected;
                     return (
                       <div key={key} className="bg-gray-50 p-4 md:p-6 rounded-[2rem] border border-gray-100 flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-slate-400 text-[10px] uppercase tracking-tighter">{key.replace('_',' ')}</span>
                            <span className="font-bold text-xs text-brand-600">Sistema: ${expected.toFixed(2)}</span>
                          </div>
                          <div className="flex gap-3 items-center">
                            <div className="relative flex-1">
                               <Banknote className="absolute left-4 top-4 text-slate-300" size={18}/>
                               <input type="number" className="w-full bg-white border-2 border-gray-200 p-4 pl-12 rounded-2xl font-black text-lg text-right outline-none focus:border-brand-500" placeholder="0.00" value={actualCounts[key] || ''} onChange={e => setActualCounts({...actualCounts, [key]: e.target.value})} />
                            </div>
                            <div className={`w-24 text-right flex flex-col ${Math.abs(diff) < 0.01 ? 'text-emerald-500' : 'text-red-500'}`}>
                               <span className="text-[8px] font-black uppercase">Diferencia</span>
                               <span className="font-black text-xs">${diff.toFixed(2)}</span>
                            </div>
                          </div>
                       </div>
                     );
                   })}
                </div>

                <div className={`p-6 rounded-[2rem] border-2 flex items-center gap-4 transition-all ${hasDifference ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                   {hasDifference ? <AlertTriangle size={32}/> : <CheckCircle size={32}/>}
                   <div>
                      <h4 className="font-black uppercase text-xs tracking-widest">{hasDifference ? 'Diferencia Detectada' : 'Caja Cuadrada'}</h4>
                      <p className="text-[9px] font-bold uppercase opacity-70 leading-relaxed">{hasDifference ? 'No se permite cerrar si el conteo real no coincide con el esperado del sistema.' : 'El arqueo es exacto. Ya puede proceder a firmar el reporte de cierre.'}</p>
                   </div>
                </div>
              </div>
              <div className="p-6 md:p-8 bg-white border-t border-gray-100 shrink-0">
                <button 
                  disabled={hasDifference}
                  onClick={() => { if (currentUser?.role === Role.ADMIN || currentUser?.role === Role.ACCOUNTANT) handleProcessFinalClosure(currentUser.name); else setShowPinModal(true); }}
                  className={`w-full font-black py-6 rounded-[2rem] shadow-xl uppercase tracking-widest text-xs transition-all ${hasDifference ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-brand-600'}`}
                >
                  Confirmar y Firmar Reporte Z
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
             <p className="text-[10px] font-bold uppercase opacity-80 mt-1">Cierre contable procesado con éxito</p>
          </div>

          <div className="bg-white max-w-[400px] w-full p-8 shadow-2xl rounded-sm font-mono text-sm relative mb-10">
              <div className="absolute top-0 inset-x-0 h-2 bg-white flex justify-around -translate-y-1">
                  {[...Array(20)].map((_, i) => <div key={i} className="w-2 h-2 bg-slate-900 rounded-full"></div>)}
              </div>
              <div id="printable-z-report">
                <div className="text-center mb-6">
                    <h2 className="text-lg font-black uppercase tracking-tighter">{businessConfig.name}</h2>
                    <p className="text-[10px]">{businessConfig.address}</p>
                    <div className="border-t border-dashed border-gray-300 my-4"></div>
                    <h3 className="font-black text-lg underline">REPORTE FINAL Z</h3>
                    <p className="text-[10px] mt-1">SISTEMA CAPIBARIO TPV</p>
                </div>
                <div className="mb-4 space-y-1 text-[10px]">
                    <div className="flex justify-between"><span>APERTURA:</span><span>{new Date(lastClosedShift?.openedAt || '').toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>CIERRE:</span><span>{new Date(lastClosedShift?.closedAt || '').toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold"><span>CAJERO:</span><span>{lastClosedShift?.openedBy.toUpperCase()}</span></div>
                    <div className="flex justify-between font-bold"><span>AUDITOR:</span><span>{lastClosedShift?.closedBy?.toUpperCase()}</span></div>
                </div>
                <div className="border-t border-dashed border-gray-300 my-4"></div>
                <table className="w-full text-[10px] mb-4">
                    <thead><tr className="border-b border-gray-200"><th className="text-left py-1 uppercase">Arqueo Contable</th><th className="text-center">SIS</th><th className="text-right">REAL</th></tr></thead>
                    <tbody>
                        {Object.entries(shiftMetrics || {}).map(([key, expected]) => (
                            <tr key={key} className="border-b border-gray-50">
                                <td className="py-2">{key.replace('_',' ')}</td>
                                <td className="text-center">${expected.toFixed(2)}</td>
                                <td className="text-right font-bold">${(lastClosedShift?.actualCash?.[key] || 0).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="border-t border-dashed border-gray-300 my-4"></div>
                <h4 className="font-black mb-2 text-center uppercase text-xs">MOVIMIENTO DE STOCK</h4>
                <table className="w-full text-[9px] mb-4">
                    <thead><tr className="border-b border-gray-200"><th className="text-left py-1">ITEM</th><th className="text-center">VND</th><th className="text-right">ACT</th></tr></thead>
                    <tbody>
                        {inventoryMovements.map(([id, data]) => (
                            <tr key={id} className="border-b border-gray-50">
                                <td className="py-1 max-w-[120px] truncate">{data.name.toUpperCase()}</td>
                                <td className="text-center">{data.sold}</td>
                                <td className="text-right">{data.stock}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="text-center mt-10 space-y-4">
                    <p className="text-[9px] uppercase tracking-widest font-bold opacity-30">--- FIN DEL REPORTE Z ---</p>
                    <div className="flex gap-4 pt-6">
                        <div className="flex-1 border-t border-gray-300 pt-2 text-[8px]">FIRMA CAJERO</div>
                        <div className="flex-1 border-t border-gray-300 pt-2 text-[8px]">FIRMA AUDITOR</div>
                    </div>
                </div>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-2 bg-white flex justify-around translate-y-1">
                  {[...Array(20)].map((_, i) => <div key={i} className="w-2 h-2 bg-slate-900 rounded-full"></div>)}
              </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 w-full max-w-[400px]">
              <button onClick={handlePrintZReport} className="flex-1 bg-white text-slate-900 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2"><Printer size={16}/> Imprimir Z</button>
              <button onClick={handleDownloadZPDF} className="flex-1 bg-white text-slate-900 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2"><FileDown size={16}/> PDF</button>
          </div>
          <button onClick={handleResetToStart} className="mt-8 text-white/40 font-black uppercase text-[9px] tracking-widest hover:text-white transition-all underline">Volver al Inicio</button>
      </div>
    );
  }

  return null;
};
