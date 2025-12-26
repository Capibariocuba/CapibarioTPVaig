
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Currency, View, Role, Product, Sale, LedgerEntry } from '../types';
import { Lock, Unlock, EyeOff, DollarSign, Receipt, Printer, AlertTriangle, ArrowDown, ArrowUp, X, Key, CheckSquare, Banknote } from 'lucide-react';

export const ShiftManager: React.FC = () => {
  const { activeShift, openShift, closeShift, getCurrentCash, setView, currentUser, login, validatePin, sales, ledger, products, businessConfig, currencies, notify } = useStore();
  
  const [pin, setPin] = useState('');
  const [showZReport, setShowZReport] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [superiorPin, setSuperiorPin] = useState('');
  const [tempActualCash, setTempActualCash] = useState<Record<string, string>>({});
  
  const [startCash, setStartCash] = useState<Record<string, string>>({ [Currency.CUP]: '', [Currency.USD]: '', [Currency.EUR]: '' });

  const currentShiftSales = useMemo(() => sales.filter(s => s.shiftId === activeShift?.id), [sales, activeShift]);
  const currentShiftLedger = useMemo(() => ledger.filter(l => l.timestamp >= (activeShift?.openedAt || '')), [ledger, activeShift]);

  const financialTotals = useMemo(() => {
    const totals: Record<string, number> = {
        'CASH_CUP': 0, 'CASH_USD': 0, 'CASH_EUR': 0,
        'TRANSFER_CUP': 0, 'TRANSFER_USD': 0, 'TRANSFER_EUR': 0,
        'CREDIT_TOTAL': 0, 'TOTAL_GROSS': 0
    };

    currentShiftSales.forEach(sale => {
        totals.TOTAL_GROSS += sale.total;
        sale.payments.forEach(pay => {
            const key = `${pay.method}_${pay.currency}`;
            if (pay.method === 'CREDIT') totals.CREDIT_TOTAL += pay.amount;
            else if (totals[key] !== undefined) totals[key] += pay.amount;
        });
    });

    return totals;
  }, [currentShiftSales]);

  const inventoryMovements = useMemo(() => {
    const movements: Record<string, { name: string, sold: number, stock: number }> = {};
    
    products.forEach(p => {
        const totalStock = p.variants?.length ? p.variants.reduce((a, b) => a + (b.stock || 0), 0) : (p.stock || 0);
        movements[p.id] = { name: p.name, sold: 0, stock: totalStock };
    });

    currentShiftSales.forEach(sale => {
        sale.items.forEach(item => {
            if (movements[item.id]) movements[item.id].sold += item.quantity;
        });
    });

    return movements;
  }, [currentShiftSales, products]);

  const handleOpenShift = () => {
    const cashNumbers: Record<string, number> = {};
    currencies.forEach(c => {
      cashNumbers[c.code] = parseFloat(startCash[c.code]) || 0;
    });
    openShift(cashNumbers);
    setView(View.POS);
  };

  const handleInitClosure = () => {
    const systemCash = getCurrentCash();
    const initialActual: Record<string, string> = {};
    Object.keys(systemCash).forEach(k => initialActual[k] = '');
    setTempActualCash(initialActual);
    setShowClosureModal(true);
  };

  const handleProcessFinalClosure = async (authorizedBy: string) => {
    const finalActualCash: Record<string, number> = {};
    // Fix: cast v to string for parseFloat
    Object.entries(tempActualCash).forEach(([k, v]) => {
      finalActualCash[k] = parseFloat(v as string) || 0;
    });
    
    closeShift(finalActualCash, authorizedBy);
    setShowClosureModal(false);
    setShowZReport(true);
  };

  const handleVerifySuperior = async () => {
    const user = await validatePin(superiorPin);
    if (user && (user.role === Role.ADMIN || user.role === Role.ACCOUNTANT)) {
      handleProcessFinalClosure(user.name);
      setShowPinModal(false);
      setSuperiorPin('');
    } else {
      notify("PIN inválido o sin privilegios de cierre", "error");
      setSuperiorPin('');
    }
  };

  const executeClosureAction = () => {
    if (currentUser?.role === Role.ADMIN || currentUser?.role === Role.ACCOUNTANT) {
      handleProcessFinalClosure(currentUser.name);
    } else {
      setShowPinModal(true);
    }
  };

  if (!currentUser) return null; // El Sidebar maneja el login si no hay user

  if (activeShift && !showZReport) {
    const systemCash = getCurrentCash();
    const canSeeExpected = currentUser.role === Role.ADMIN || currentUser.role === Role.ACCOUNTANT;

    return (
      <div className="p-4 md:p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in duration-500">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-3xl shadow-inner"><Unlock size={32} /></div>
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Turno Activo</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Abierto por {activeShift.openedBy}</p>
              </div>
            </div>
            <div className="text-center md:text-right">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Iniciado a las {new Date(activeShift.openedAt).toLocaleTimeString()}</div>
                <div className="font-mono text-[9px] text-brand-500 bg-brand-50 px-3 py-1 rounded-full">{activeShift.id}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 relative overflow-hidden flex flex-col">
              {!canSeeExpected && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                  <EyeOff size={48} className="text-slate-300 mb-4" />
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Cierre Ciego</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Solo ADMIN/CONTADOR pueden ver el arqueo esperado del sistema.</p>
                </div>
              )}
              <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><ArrowDown size={14}/> Efectivo Esperado</h3>
              <div className="space-y-4 flex-1">
                {Object.entries(systemCash).map(([curr, amount]) => (
                  <div key={curr} className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="font-black text-slate-400 text-xs">{curr}</span>
                    {/* Fix: cast amount to number to allow toFixed */}
                    <span className="font-black text-2xl text-slate-800 tracking-tighter">${(amount as number).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><ArrowUp size={14}/> Finalizar Turno</h3>
              <div className="bg-slate-50 p-6 rounded-3xl border border-gray-100 mb-8 flex-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed">
                  Al cerrar el turno se consolidará la facturación, se generará el reporte Z inmutable y se reiniciará la caja para el siguiente operador.
                </p>
                <div className="mt-6 flex items-center gap-3 text-brand-600 bg-white p-4 rounded-2xl shadow-sm">
                  <AlertTriangle size={20}/>
                  <span className="text-[9px] font-black uppercase tracking-widest">Requiere conteo físico</span>
                </div>
              </div>
              <button 
                onClick={handleInitClosure}
                className="w-full bg-slate-900 hover:bg-brand-600 text-white font-black py-6 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs"
              >
                <CheckSquare size={20} /> Iniciar Arqueo Z
              </button>
            </div>
          </div>
        </div>

        {/* MODAL DE ARQUEO / CONTEO REAL */}
        {showClosureModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in">
            <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Arqueo de Cierre</h2>
                  <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Introduzca lo que hay físicamente en caja</p>
                </div>
                <button onClick={() => setShowClosureModal(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={20}/></button>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 gap-4">
                  {Object.keys(systemCash).map(curr => (
                    <div key={curr} className="flex flex-col md:flex-row items-center gap-4 bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <div className="flex-1">
                        <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Efectivo en {curr}</span>
                        {canSeeExpected && (
                          <p className="text-[9px] text-brand-500 font-bold uppercase">Esperado: ${systemCash[curr].toFixed(2)}</p>
                        )}
                      </div>
                      <div className="relative w-full md:w-48">
                        <Banknote className="absolute left-4 top-4 text-slate-300" size={18}/>
                        <input 
                          type="number" 
                          className="w-full bg-white border-2 border-gray-200 p-4 pl-12 rounded-2xl font-black text-xl text-right outline-none focus:border-brand-500"
                          placeholder="0.00"
                          value={tempActualCash[curr] || ''}
                          onChange={e => setTempActualCash({...tempActualCash, [curr]: e.target.value})}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                  <div className="flex gap-3 text-amber-600 mb-2">
                    <AlertTriangle size={20}/>
                    <h4 className="font-black uppercase text-xs tracking-tighter">Confirmación de Responsabilidad</h4>
                  </div>
                  <p className="text-[9px] text-amber-500 font-bold uppercase leading-relaxed">
                    Al confirmar estos montos, usted declara que la diferencia (sobrante o faltante) es la registrada físicamente al momento del cierre. Esta acción requiere autorización {currentUser.role === Role.DEPENDENT ? 'superior' : ''}.
                  </p>
                </div>
                <button 
                  onClick={executeClosureAction}
                  className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-xl uppercase tracking-widest text-xs hover:bg-emerald-600 transition-all"
                >
                  Cerrar Caja y Firmar Reporte Z
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PIN AUTORIZACIÓN SUPERIOR */}
        {showPinModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in zoom-in">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-sm w-full text-center border border-gray-100">
              <div className="bg-brand-50 w-20 h-20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 text-brand-600 shadow-inner"><Key size={32}/></div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Autorización</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">Introduzca PIN de Administrador o Contador para cerrar el turno</p>
              <input 
                type="password" 
                autoFocus 
                className="w-full bg-gray-50 border-none p-6 rounded-2xl text-center text-4xl mb-8 font-black outline-none focus:ring-4 focus:ring-brand-500/20" 
                value={superiorPin}
                onChange={e => setSuperiorPin(e.target.value)}
                maxLength={4}
                onKeyDown={e => e.key === 'Enter' && handleVerifySuperior()}
              />
              <div className="flex gap-3">
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
    // El reporte Z usará el último turno cerrado
    return (
        <div className="p-4 md:p-8 bg-slate-800 h-full flex flex-col items-center overflow-y-auto animate-in slide-in-from-bottom duration-500">
            <div className="bg-white max-w-[400px] w-full p-8 shadow-2xl rounded-sm font-mono text-sm relative">
                <div className="absolute top-0 inset-x-0 h-2 bg-white flex justify-around -translate-y-1">
                    {[...Array(20)].map((_, i) => <div key={i} className="w-2 h-2 bg-slate-800 rounded-full"></div>)}
                </div>

                <div className="text-center mb-6">
                    <h2 className="text-lg font-black uppercase tracking-tighter">{businessConfig.name}</h2>
                    <p className="text-[10px]">{businessConfig.address}</p>
                    <p className="text-[10px]">CI/NIT: {businessConfig.taxId}</p>
                    <div className="border-t border-dashed border-gray-300 my-4"></div>
                    <h3 className="font-black text-lg underline">REPORTE FINAL CIERRE Z</h3>
                    <p className="text-[10px] mt-1">SISTEMA CAPIBARIO TPV</p>
                </div>

                <div className="mb-4 space-y-1 text-[10px]">
                    <div className="flex justify-between"><span>FECHA APERTURA:</span><span>{new Date(activeShift?.openedAt || '').toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span>HORA APERTURA:</span><span>{new Date(activeShift?.openedAt || '').toLocaleTimeString()}</span></div>
                    <div className="flex justify-between"><span>FECHA CIERRE:</span><span>{new Date().toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span>HORA CIERRE:</span><span>{new Date().toLocaleTimeString()}</span></div>
                    <div className="flex justify-between font-bold"><span>CAJERO:</span><span>{activeShift?.openedBy.toUpperCase()}</span></div>
                    <div className="flex justify-between font-bold"><span>AUDITADO POR:</span><span>{activeShift?.closedBy?.toUpperCase() || 'SISTEMA'}</span></div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-4"></div>
                <h4 className="font-black mb-2 text-center uppercase text-xs">RESUMEN DE FACTURACIÓN</h4>
                <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>TRANS. PROCESADAS:</span><span>{currentShiftSales.length}</span></div>
                    <div className="flex justify-between font-black text-sm pt-2"><span>VENTA BRUTA TOTAL:</span><span>${financialTotals.TOTAL_GROSS.toFixed(2)}</span></div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-4"></div>
                <h4 className="font-black mb-2 text-center uppercase text-xs">ARQUEO DE CAJA (CASH)</h4>
                <table className="w-full text-[10px] mb-4">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left py-1">DIVISA</th>
                            <th className="text-center">SISTEMA</th>
                            <th className="text-center">REAL</th>
                            <th className="text-right">DIF</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(getCurrentCash()).map(([curr, expectedVal]) => {
                            // Fix: cast values to numbers for arithmetic
                            const expected = expectedVal as number;
                            const actual = (activeShift?.actualCash?.[curr] as number) || 0;
                            const diff = actual - expected;
                            return (
                                <tr key={curr} className="border-b border-gray-50">
                                    <td className="py-1">{curr}</td>
                                    <td className="text-center">${expected.toFixed(2)}</td>
                                    <td className="text-center">${actual.toFixed(2)}</td>
                                    <td className={`text-right font-bold ${diff < -0.01 ? 'text-red-600' : diff > 0.01 ? 'text-blue-600' : ''}`}>
                                        {/* Fix: use toFixed on number */}
                                        ${diff.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="border-t border-dashed border-gray-300 my-4"></div>
                <h4 className="font-black mb-2 text-center uppercase text-xs">MOVIMIENTOS DE INVENTARIO</h4>
                <table className="w-full text-[10px] mb-4">
                    <thead><tr className="border-b border-gray-200"><th className="text-left py-1">PRODUCTO</th><th className="text-center">INI</th><th className="text-center">VND</th><th className="text-right">ACT</th></tr></thead>
                    <tbody>
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

                <div className="text-center mt-10 space-y-6">
                    <p className="text-[9px] uppercase tracking-widest font-bold opacity-30">--- FIN DEL REPORTE Z ---</p>
                    <div className="flex gap-4 pt-10">
                        <div className="flex-1 border-t border-gray-300 pt-2 text-[8px]">FIRMA OPERADOR</div>
                        <div className="flex-1 border-t border-gray-300 pt-2 text-[8px]">FIRMA AUDITOR</div>
                    </div>
                    <button onClick={() => window.location.reload()} className="print:hidden w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Reiniciar Terminal</button>
                    <button onClick={() => window.print()} className="print:hidden w-full bg-gray-100 text-slate-800 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex justify-center gap-2"><Printer size={16}/> Imprimir Copia</button>
                </div>

                <div className="absolute bottom-0 inset-x-0 h-2 bg-white flex justify-around translate-y-1">
                    {[...Array(20)].map((_, i) => <div key={i} className="w-2 h-2 bg-slate-800 rounded-full"></div>)}
                </div>
            </div>
        </div>
    );
  }

  // PANTALLA DE APERTURA
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-100 p-4 animate-in fade-in duration-500">
      <div className="bg-white p-10 md:p-12 rounded-[4rem] shadow-2xl max-lg w-full border border-gray-100">
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-brand-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-brand-600 shadow-inner">
            <Unlock size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-2">Apertura de Turno</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bienvenido operador, {currentUser?.name}</p>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pl-2">
                <Banknote size={16} className="text-slate-400"/>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fondo Inicial (Efectivo)</label>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-slate-900 p-6 rounded-3xl flex items-center justify-between border-b-4 border-brand-500 shadow-xl">
                 <span className="font-black text-brand-400 text-xs tracking-widest uppercase">CUP</span>
                 <input 
                  type="number" 
                  className="bg-transparent text-right font-black text-3xl text-white outline-none placeholder:text-slate-700 w-32" 
                  placeholder="0.00" 
                  value={startCash['CUP'] || ''} 
                  onChange={e => setStartCash({...startCash, CUP: e.target.value})} 
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3 opacity-60">
                 {currencies.filter(c => c.code !== 'CUP').map(c => (
                   <div key={c.code} className="bg-gray-100 p-4 rounded-2xl flex items-center justify-between border border-gray-200">
                      <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest">{c.code}</span>
                      <input 
                        type="number" 
                        className="bg-transparent text-right font-black text-sm outline-none w-16" 
                        placeholder="0.00" 
                        value={startCash[c.code] || ''} 
                        onChange={e => setStartCash({...startCash, [c.code]: e.target.value})} 
                      />
                   </div>
                 ))}
              </div>
            </div>
          </div>

          <button 
            onClick={handleOpenShift} 
            className="w-full bg-brand-500 hover:bg-slate-900 text-white font-black py-7 rounded-[2rem] shadow-2xl shadow-brand-100 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.3em] text-xs group"
          >
            <Unlock size={20} className="group-hover:rotate-12 transition-transform"/> Iniciar Operaciones
          </button>
        </div>
      </div>
    </div>
  );
};
