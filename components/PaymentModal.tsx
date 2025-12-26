
import React, { useState, useEffect, useMemo } from 'react';
import { PaymentMethodType, PaymentDetail, CurrencyConfig, BusinessConfig } from '../types';
import { X, Banknote, Plus, Trash2, ArrowRight, Wallet, CreditCard } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface PaymentModalProps {
  total: number;
  currencyCode: string;
  onClose: () => void;
  onConfirm: (payments: any[]) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ total, currencyCode, onClose, onConfirm }) => {
  const { currencies, businessConfig, rates } = useStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [amount, setAmount] = useState(total.toString());
  const [method, setMethod] = useState<PaymentMethodType>('CASH');

  const selectedCurrency = currencies.find(c => c.code === currencyCode);

  const allowedMethods = businessConfig.paymentMethods
    .filter(m => m.enabled && selectedCurrency?.allowedPaymentMethods.includes(m.id));

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const isCovered = totalPaid >= total - 0.009; // Precisión decimal

  const changeInCUP = useMemo(() => {
    if (totalPaid <= total) return 0;
    const overpay = totalPaid - total;
    // Tasa: Si total esta en USD y quiero CUP. overpay * rateUSD
    const rateOfCurrent = rates[currencyCode] || 1;
    return overpay * rateOfCurrent;
  }, [totalPaid, total, currencyCode, rates]);

  useEffect(() => {
    if (remaining > 0) setAmount(remaining.toFixed(2));
    else setAmount('0');
  }, [remaining]);

  const addPayment = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    setPayments([...payments, { method, amount: val, currency: currencyCode }]);
    setAmount('');
  };

  const handleFinish = () => {
    if (isCovered) onConfirm(payments);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] md:p-4">
      <div className="bg-white rounded-none md:rounded-[2.5rem] shadow-2xl w-full max-w-2xl h-full md:h-auto overflow-hidden flex flex-col">
        <div className="bg-slate-900 text-white p-6 md:p-8 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3"><Banknote size={24} className="md:w-8 md:h-8" /> Procesar Cobro</h2>
            <p className="text-[9px] md:text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">Divisa: {currencyCode} • Tasa: ${selectedCurrency?.rate}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="mb-6 md:mb-8 text-center bg-gray-50 p-4 md:p-6 rounded-2xl md:rounded-[2rem]">
                <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Monto de Venta</p>
                <div className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
                    {selectedCurrency?.symbol}{total.toFixed(2)}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-4 md:space-y-6">
                    <div>
                        <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 md:mb-4">Añadir Abono ({currencyCode})</label>
                        <input 
                          type="number" 
                          value={amount} 
                          onChange={e => setAmount(e.target.value)} 
                          className="w-full bg-slate-50 border-none p-4 md:p-5 rounded-2xl md:rounded-3xl font-black text-xl md:text-2xl outline-none mb-3 md:mb-4" 
                        />
                        <div className="grid grid-cols-2 gap-2">
                            {allowedMethods.map(m => (
                                <button key={m.id} onClick={() => setMethod(m.id)} className={`p-3 md:p-4 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest border-2 transition-all ${method === m.id ? 'bg-brand-50 border-brand-500 text-brand-600' : 'bg-gray-50 border-gray-50 text-gray-400'}`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={addPayment} disabled={remaining <= 0 && payments.length > 0} className="w-full bg-slate-900 text-white font-black py-4 md:py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-brand-600 transition-all disabled:opacity-50">
                        <Plus size={18} /> Registrar Pago
                    </button>
                </div>

                <div className="bg-gray-50 p-4 md:p-6 rounded-2xl md:rounded-[2rem] flex flex-col h-auto">
                    <h3 className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Resumen de Pagos</h3>
                    <div className="flex-1 space-y-2 mb-4 overflow-y-auto min-h-[120px] md:min-h-[150px]">
                        {payments.map((p, i) => (
                            <div key={i} className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 flex justify-between items-center animate-in slide-in-from-right">
                                <div>
                                    <div className="font-black text-sm md:text-base text-slate-800">{selectedCurrency?.symbol}{p.amount.toFixed(2)}</div>
                                    <div className="text-[8px] md:text-[9px] text-brand-500 font-black uppercase">{p.method}</div>
                                </div>
                                <button onClick={() => setPayments(payments.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        {payments.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-gray-300 py-8">
                             <CreditCard size={32} className="opacity-20 mb-2" />
                             <p className="text-[9px] font-black uppercase tracking-tighter">Sin abonos</p>
                          </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Sticky Footer en el Modal para móvil */}
        <div className="p-4 md:p-8 bg-white border-t border-slate-100 shrink-0">
            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-[9px] md:text-[10px] font-black text-slate-400 uppercase">
                  <span>Total Pagado:</span>
                  <span className="text-slate-800">{selectedCurrency?.symbol}{totalPaid.toFixed(2)}</span>
                </div>
                {changeInCUP > 0 && (
                  <div className="flex justify-between text-[9px] md:text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 p-2 rounded-xl">
                    <span>Vuelto (CUP):</span>
                    <span>₱{changeInCUP.toFixed(2)}</span>
                  </div>
                )}
            </div>
            <button onClick={handleFinish} disabled={!isCovered} className={`w-full py-5 rounded-2xl font-black uppercase text-xs transition-all ${isCovered ? 'bg-brand-600 text-white shadow-xl' : 'bg-gray-200 text-gray-400'}`}>
                Finalizar Venta
            </button>
        </div>
      </div>
    </div>
  );
};
