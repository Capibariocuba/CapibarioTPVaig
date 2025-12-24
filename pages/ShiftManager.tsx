
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Currency, View, Role, Product, Sale, LedgerEntry } from '../types';
import { Lock, Unlock, EyeOff, DollarSign, Receipt, Printer, AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';

export const ShiftManager: React.FC = () => {
  const { activeShift, openShift, closeShift, getCurrentCash, setView, currentUser, login, sales, ledger, products, businessConfig } = useStore();
  const [pin, setPin] = useState('');
  const [showZReport, setShowZReport] = useState(false);
  
  const [startCash, setStartCash] = useState<Record<string, string>>({ [Currency.CUP]: '', [Currency.USD]: '', [Currency.EUR]: '', [Currency.MLC]: '' });

  const currentShiftSales = useMemo(() => sales.filter(s => s.shiftId === activeShift?.id), [sales, activeShift]);
  const currentShiftLedger = useMemo(() => ledger.filter(l => l.timestamp >= (activeShift?.openedAt || '')), [ledger, activeShift]);

  const financialTotals = useMemo(() => {
    const totals: Record<string, number> = {
        'EFECTIVO_CUP': 0, 'EFECTIVO_USD': 0, 'EFECTIVO_EUR': 0,
        'TRANSFERENCIA_CUP': 0, 'TRANSFERENCIA_USD': 0, 'TRANSFERENCIA_EUR': 0,
        'CREDITO_CLIENTE': 0, 'TOTAL_BRUTO': 0
    };

    currentShiftSales.forEach(sale => {
        totals.TOTAL_BRUTO += sale.total;
        sale.payments.forEach(pay => {
            const key = `${pay.method}_${pay.currency}`;
            if (pay.method === 'CREDIT') totals.CREDITO_CLIENTE += pay.amount;
            else if (totals[key] !== undefined) totals[key] += pay.amount;
        });
    });

    return totals;
  }, [currentShiftSales]);

  const inventoryMovements = useMemo(() => {
    const movements: Record<string, { name: string, sold: number, stock: number }> = {};
    
    products.forEach(p => {
        // Fixed type error by ensuring b.stock is correctly accessed on ProductVariant after updating the interface.
        const totalStock = p.variants?.length ? p.variants.reduce((a, b) => a + b.stock, 0) : (p.batches?.reduce((a, b) => a + b.quantity, 0) || 0);
        movements[p.id] = { name: p.name, sold: 0, stock: totalStock };
    });

    currentShiftSales.forEach(sale => {
        sale.items.forEach(item => {
            if (movements[item.id]) movements[item.id].sold += item.quantity;
        });
    });

    return movements;
  }, [currentShiftSales, products]);

  if (!currentUser) {
     return (
        <div className="h-full flex items-center justify-center bg-slate-900 p-4">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full border border-gray-100">
                <div className="bg-brand-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-600"><Lock size={40} /></div>
                <h2 className="text-2xl font-black mb-2 text-slate-800">Caja de Seguridad</h2>
                <p className="text-xs text-gray-400 font-bold uppercase mb-8">Introduzca su PIN Maestro</p>
                <input type="password" placeholder="PIN" className="bg-gray-50 border-none p-5 rounded-2xl text-center text-4xl mb-6 w-full font-black outline-none focus:ring-4 focus:ring-brand-500/20" value={pin} onChange={e => setPin(e.target.value)} maxLength={4} />
                <button onClick={() => login(pin)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-200">Acceder</button>
            </div>
        </div>
     )
  }

  const handleOpenShift = () => {
    const cashNumbers: Record<string, number> = { 
        [Currency.CUP]: parseFloat(startCash[Currency.CUP]) || 0, 
        [Currency.USD]: parseFloat(startCash[Currency.USD]) || 0, 
        [Currency.EUR]: parseFloat(startCash[Currency.EUR]) || 0, 
        [Currency.MLC]: parseFloat(startCash[Currency.MLC]) || 0 
    };
    openShift(cashNumbers);
    setView(View.POS);
  };

  const handleCloseShift = () => {
    if (!window.confirm("¿Está seguro de realizar el Cierre Z? Esta operación es irreversible.")) return;
    closeShift({ [Currency.CUP]: 0, [Currency.USD]: 0, [Currency.EUR]: 0, [Currency.MLC]: 0 });
    setShowZReport(true);
  };

  const canSeeExpected = currentUser.role === Role.ADMIN || currentUser.role === Role.ACCOUNTANT;

  if (activeShift && !showZReport) {
    const currentSystemCash = getCurrentCash();
    return (
      <div className="p-8 bg-gray-50 h-full flex flex-col items-center overflow-y-auto">
        <div className="max-w-4xl w-full">
          <div className="flex items-center justify-between mb-10 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Unlock className="text-emerald-500" size={28} />
                <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Caja Abierta</h1>
              </div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Responsable: <span className="text-slate-800">{activeShift.openedBy}</span></p>
            </div>
            <div className="text-right">
                <div className="text-xs font-bold text-slate-400">INICIO: {new Date(activeShift.openedAt).toLocaleTimeString()}</div>
                <div className="font-mono text-[10px] text-gray-300">SHIFT-ID: {activeShift.id.toUpperCase()}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden ${!canSeeExpected ? 'min-h-[300px]' : ''}`}>
              {!canSeeExpected && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-10 p-8 text-center">
                      <EyeOff size={48} className="text-gray-300 mb-4" />
                      <p className="font-black text-slate-800 uppercase tracking-widest text-xs">Cierre Ciego Activo</p>
                      <p className="text-[10px] text-gray-400 mt-2 font-bold leading-relaxed">Solo los administradores pueden ver los arqueos esperados antes del cierre final.</p>
                  </div>
              )}
              
              <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2"><ArrowDown size={14}/> Efectivo Esperado</h3>
              <div className="space-y-4">
                {Object.entries(currentSystemCash).map(([curr, amount]) => (
                  <div key={curr} className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="font-black text-slate-400 text-xs">{curr}</span>
                    <span className="font-black text-2xl text-slate-800 tracking-tighter">${amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2"><ArrowUp size={14}/> Finalizar Turno</h3>
              <p className="text-xs text-gray-400 mb-8 font-bold leading-relaxed italic">Al procesar el cierre, el sistema generará un reporte de auditoría contable (Cierre Z) y vaciará el arqueo activo para el próximo turno.</p>
              
              <div className="mt-auto space-y-4">
                  <div className="bg-red-50 p-6 rounded-2xl border border-red-100 mb-6">
                      <div className="flex items-center gap-3 text-red-600 mb-2">
                          <AlertTriangle size={20}/>
                          <span className="font-black text-xs uppercase tracking-widest">Advertencia Contable</span>
                      </div>
                      <p className="text-[10px] text-red-400 font-bold">Asegúrese de haber contado físicamente todo el efectivo y verificado las transferencias bancarias antes de cerrar.</p>
                  </div>
                  <button onClick={handleCloseShift} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-6 rounded-3xl shadow-2xl shadow-slate-200 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                    <Lock size={20} /> Ejecutar Cierre Z
                  </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showZReport) {
    return (
        <div className="p-8 bg-slate-800 h-full flex flex-col items-center overflow-y-auto">
            <div className="bg-white max-w-[400px] w-full p-8 shadow-2xl rounded-sm font-mono text-sm relative">
                <div className="absolute top-0 inset-x-0 h-2 bg-white flex justify-around -translate-y-1">
                    {[...Array(20)].map((_, i) => <div key={i} className="w-2 h-2 bg-slate-800 rounded-full"></div>)}
                </div>

                <div className="text-center mb-6">
                    <h2 className="text-lg font-black uppercase tracking-tighter">{businessConfig.name}</h2>
                    <p className="text-[10px]">{businessConfig.address}</p>
                    <p className="text-[10px]">CI/NIT: {businessConfig.taxId}</p>
                    <div className="border-t border-dashed border-gray-300 my-4"></div>
                    <h3 className="font-black text-lg underline">REPORTE CIERRE Z</h3>
                    <p className="text-[10px] mt-1">NÚMERO DE REPORTE: {Math.floor(Math.random()*10000)}</p>
                </div>

                <div className="mb-4 space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>FECHA APERTURA:</span><span>{new Date(activeShift?.openedAt || '').toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span>HORA APERTURA:</span><span>{new Date(activeShift?.openedAt || '').toLocaleTimeString()}</span></div>
                    <div className="flex justify-between"><span>FECHA CIERRE:</span><span>{new Date().toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span>HORA CIERRE:</span><span>{new Date().toLocaleTimeString()}</span></div>
                    <div className="flex justify-between"><span>CAJERO:</span><span>{activeShift?.openedBy.toUpperCase()}</span></div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-4"></div>
                <h4 className="font-black mb-2 text-center uppercase">RESUMEN DE INVENTARIO</h4>
                <table className="w-full text-[10px] mb-4">
                    <thead><tr className="border-b border-gray-200"><th className="text-left py-1">PRODUCTO</th><th className="text-center">INI</th><th className="text-center">VND</th><th className="text-right">FIN</th></tr></thead>
                    <tbody>
                        {/* Fix: Explicitly type data to resolve property 'name', 'sold', 'stock' on type 'unknown' error */}
                        {Object.entries(inventoryMovements).map(([id, data]: [string, any]) => (
                            <tr key={id} className="border-b border-gray-50">
                                <td className="py-1 max-w-[120px] truncate">{data.name.toUpperCase()}</td>
                                <td className="text-center">{data.sold + data.stock}</td>
                                <td className="text-center">{data.sold}</td>
                                <td className="text-right">{data.stock}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="border-t border-dashed border-gray-300 my-4"></div>
                <h4 className="font-black mb-2 text-center uppercase">DESGLOSE FINANCIERO</h4>
                <div className="space-y-1 text-[11px]">
                    <p className="font-black underline mb-1">EFECTIVO:</p>
                    <div className="flex justify-between pl-2"><span>- EN CUP:</span><span>${financialTotals.EFECTIVO_CUP.toFixed(2)}</span></div>
                    <div className="flex justify-between pl-2"><span>- EN USD:</span><span>${financialTotals.EFECTIVO_USD.toFixed(2)}</span></div>
                    <div className="flex justify-between pl-2"><span>- EN EUR:</span><span>${financialTotals.EFECTIVO_EUR.toFixed(2)}</span></div>
                    
                    <p className="font-black underline mb-1 mt-2">TRANSFERENCIAS:</p>
                    <div className="flex justify-between pl-2"><span>- EN CUP:</span><span>${financialTotals.TRANSFERENCIA_CUP.toFixed(2)}</span></div>
                    <div className="flex justify-between pl-2"><span>- EN USD:</span><span>${financialTotals.TRANSFERENCIA_USD.toFixed(2)}</span></div>
                    
                    <p className="font-black underline mb-1 mt-2">SISTEMA CRM:</p>
                    <div className="flex justify-between pl-2"><span>- CRÉDITO CLIENTE:</span><span>${financialTotals.CREDITO_CLIENTE.toFixed(2)}</span></div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-6"></div>
                <div className="flex justify-between font-black text-lg">
                    <span>TOTAL VENTAS:</span>
                    <span>${financialTotals.TOTAL_BRUTO.toFixed(2)}</span>
                </div>

                <div className="text-center mt-10 space-y-6">
                    <p className="text-[9px] uppercase tracking-widest font-bold">--- FIN DEL REPORTE ---</p>
                    <div className="border-t border-gray-300 w-32 mx-auto pt-2 text-[10px]">FIRMA CAJERO</div>
                    <button onClick={() => window.location.reload()} className="print:hidden w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-xs">Aceptar y Reiniciar</button>
                    <button onClick={() => window.print()} className="print:hidden w-full bg-gray-100 text-slate-800 py-3 rounded-xl font-black uppercase text-xs flex justify-center gap-2"><Printer size={16}/> Imprimir Reporte</button>
                </div>

                <div className="absolute bottom-0 inset-x-0 h-2 bg-white flex justify-around translate-y-1">
                    {[...Array(20)].map((_, i) => <div key={i} className="w-2 h-2 bg-slate-800 rounded-full"></div>)}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-lg w-full border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-brand-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-brand-600 shadow-xl shadow-brand-50/50">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Apertura Maestra</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Iniciando sesión como <span className="text-slate-800">{currentUser?.name}</span></p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Fondo de Caja Inicial</label>
            <div className="grid grid-cols-1 gap-3">
              {Object.keys(Currency).map(c => (
                <div key={c} className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100">
                   <span className="font-black text-slate-400 text-xs">{c}</span>
                   <input type="number" className="bg-transparent text-right font-black text-xl outline-none focus:text-brand-600 w-32" placeholder="0.00" value={startCash[c] || ''} onChange={e => setStartCash({...startCash, [c]: e.target.value})} />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleOpenShift} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-6 rounded-3xl shadow-2xl shadow-brand-100 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
            <Unlock size={20} /> Iniciar Turno de Trabajo
          </button>
        </div>
      </div>
    </div>
  );
};
