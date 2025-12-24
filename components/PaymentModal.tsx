
import React, { useState, useEffect } from 'react';
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
  const { currencies, businessConfig } = useStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [amount, setAmount] = useState(total.toString());
  const [method, setMethod] = useState<PaymentMethodType>('CASH');

  const selectedCurrency = currencies.find(c => c.code === currencyCode);

  // Filtrar métodos de cobro permitidos para esta divisa y que estén habilitados globalmente
  const allowedMethods = businessConfig.paymentMethods
    .filter(m => m.enabled && selectedCurrency?.allowedPaymentMethods.includes(m.id));

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const isCovered = totalPaid >= total - 0.01;

  useEffect(() => {
    if (remaining > 0) setAmount(remaining.toFixed(2));
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="bg-slate-900 text-white p-8 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black flex items-center gap-3"><Banknote size={32} /> Procesar Pago</h2>
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">Divisa: {currencyCode} • Tasa: ${selectedCurrency?.rate}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl"><X size={24} /></button>
        </div>

        <div className="p-8">
            <div className="mb-8 text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total a Cobrar</p>
                <div className="text-5xl font-black text-slate-900 tracking-tighter">
                    {selectedCurrency?.symbol}{total.toFixed(2)}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Monto y Método</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-2xl outline-none mb-4" />
                        <div className="grid grid-cols-2 gap-2">
                            {allowedMethods.map(m => (
                                <button key={m.id} onClick={() => setMethod(m.id)} className={`p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${method === m.id ? 'bg-brand-50 border-brand-500 text-brand-600' : 'bg-gray-50 border-gray-50 text-gray-400'}`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={addPayment} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-brand-600 transition-all">
                        <Plus size={20} /> Añadir Pago
                    </button>
                </div>

                <div className="bg-gray-50 p-6 rounded-[2rem] flex flex-col">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Desglose</h3>
                    <div className="flex-1 space-y-2 mb-4 overflow-y-auto">
                        {payments.map((p, i) => (
                            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center animate-in slide-in-from-right">
                                <div>
                                    <div className="font-black text-slate-800">{selectedCurrency?.symbol}{p.amount.toFixed(2)}</div>
                                    <div className="text-[9px] text-brand-500 font-black uppercase">{p.method}</div>
                                </div>
                                <button onClick={() => setPayments(payments.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-500"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-slate-200 pt-4 space-y-1">
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase"><span>Restante:</span><span className={remaining > 0 ? 'text-red-500' : 'text-emerald-500'}>{selectedCurrency?.symbol}{remaining.toFixed(2)}</span></div>
                        <button onClick={handleFinish} disabled={!isCovered} className={`w-full mt-4 py-5 rounded-2xl font-black uppercase text-xs transition-all ${isCovered ? 'bg-brand-600 text-white shadow-xl' : 'bg-gray-200 text-gray-400'}`}>
                            Finalizar Venta
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
