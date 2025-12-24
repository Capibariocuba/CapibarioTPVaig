
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Currency } from '../types';
import { ArrowRightLeft, DollarSign, Wallet, Save } from 'lucide-react';

export const Exchange: React.FC = () => {
  const { rates, getLedgerBalance, updateRate, executeLedgerTransaction, currentUser } = useStore();
  const [exchangeAmount, setExchangeAmount] = useState<string>('');
  const [fromCurrency, setFromCurrency] = useState<Currency>(Currency.USD);
  const [toCurrency, setToCurrency] = useState<Currency>(Currency.CUP);
  
  // Rate Editing
  const [newRateUSD, setNewRateUSD] = useState<string>((rates[Currency.USD] || 0).toString());
  const [newRateEUR, setNewRateEUR] = useState<string>((rates[Currency.EUR] || 0).toString());
  // Using 0 as fallback for eurTaxPercent since it's now optional in rates
  const [newTaxEUR, setNewTaxEUR] = useState<string>(rates.eurTaxPercent?.toString() || '0');

  const cashDrawer = {
      [Currency.CUP]: getLedgerBalance(Currency.CUP, 'CASH'),
      [Currency.USD]: getLedgerBalance(Currency.USD, 'CASH'),
      [Currency.EUR]: getLedgerBalance(Currency.EUR, 'CASH')
  };

  const handleExchange = () => {
    const amount = parseFloat(exchangeAmount);
    if (!amount || amount <= 0) return;

    let baseVal = 0;
    if (fromCurrency === Currency.CUP) baseVal = amount;
    else baseVal = amount * (rates[fromCurrency] || 1);

    if (fromCurrency === Currency.EUR && rates.eurTaxPercent) {
        baseVal = baseVal * (1 - rates.eurTaxPercent / 100);
    }

    let finalVal = 0;
    if (toCurrency === Currency.CUP) finalVal = baseVal;
    else finalVal = baseVal / (rates[toCurrency] || 1);

    const availableOut = cashDrawer[toCurrency as keyof typeof cashDrawer];
    if (availableOut < finalVal) {
        alert(`NO SE PUEDE CANJEAR: No tienes suficiente fondo en ${toCurrency}. Necesitas ${finalVal.toFixed(2)}, tienes ${availableOut.toFixed(2)}.`);
        return;
    }

    const txId = Math.random().toString(36).substr(2, 9);

    const inSuccess = executeLedgerTransaction({
        type: 'EXCHANGE',
        direction: 'IN',
        amount: amount,
        currency: fromCurrency,
        paymentMethod: 'CASH',
        userId: currentUser?.id,
        userName: currentUser?.name,
        description: `Canje Entrada ${fromCurrency}`,
        txId
    });

    if (inSuccess) {
        const outSuccess = executeLedgerTransaction({
            type: 'EXCHANGE',
            direction: 'OUT',
            amount: finalVal,
            currency: toCurrency,
            paymentMethod: 'CASH',
            userId: currentUser?.id,
            userName: currentUser?.name,
            description: `Canje Salida ${toCurrency}`,
            txId
        });
        if (outSuccess) {
            setExchangeAmount('');
            alert('Canje Exitoso');
        } else {
             executeLedgerTransaction({
                type: 'EXCHANGE',
                direction: 'OUT',
                amount: amount,
                currency: fromCurrency,
                paymentMethod: 'CASH',
                userId: currentUser?.id,
                userName: currentUser?.name,
                description: `REVERSION`,
                txId
             });
        }
    }
  };

  const handleRateUpdate = () => {
    updateRate(Currency.USD, parseFloat(newRateUSD));
    updateRate(Currency.EUR, parseFloat(newRateEUR), parseFloat(newTaxEUR));
    alert('Tasas Actualizadas');
  };

  return (
    <div className="p-6 md:p-8 bg-gray-50 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Caja y Divisas</h1>
        <p className="text-gray-500">Control de efectivo y tasas de cambio</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {Object.entries(cashDrawer).map(([curr, amount]) => (
          <div key={curr} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-brand-50 text-brand-600 rounded-lg">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Efectivo en {curr}</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {new Intl.NumberFormat('es-CU', { style: 'currency', currency: curr }).format(amount)}
              </h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <ArrowRightLeft className="text-brand-600" />
            Realizar Canje
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto a recibir</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={exchangeAmount}
                  onChange={(e) => setExchangeAmount(e.target.value)}
                  className="flex-1 border rounded-lg p-2 focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="0.00"
                />
                <select 
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value as Currency)}
                  className="border rounded-lg p-2 bg-gray-50 font-bold"
                >
                  {Object.keys(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRightLeft className="text-gray-400 rotate-90" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entregar en</label>
              <select 
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value as Currency)}
                className="w-full border rounded-lg p-2 bg-gray-50 font-bold"
              >
                {Object.keys(Currency).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
                {fromCurrency === Currency.EUR && rates.eurTaxPercent ? (
                    <div className="text-red-500 text-xs font-bold mb-2 text-center">
                        Impuesto EUR aplicado: {rates.eurTaxPercent}%
                    </div>
                ) : null}
                <button 
                onClick={handleExchange}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-lg transition-colors shadow-md"
                >
                Procesar Canje
                </button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <DollarSign className="text-emerald-600" />
            Configuración de Tasas
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tasa USD</label>
              <input type="number" value={newRateUSD} onChange={e => setNewRateUSD(e.target.value)} className="w-full border rounded p-2" />
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tasa EUR</label>
                    <input type="number" value={newRateEUR} onChange={e => setNewRateEUR(e.target.value)} className="w-full border rounded p-2" />
                </div>
                <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Impuesto %</label>
                    <input type="number" value={newTaxEUR} onChange={e => setNewTaxEUR(e.target.value)} className="w-full border rounded p-2" />
                </div>
            </div>
            
            <button 
                onClick={handleRateUpdate}
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-900 mt-2"
            >
                <Save size={16} /> Guardar Tasas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
