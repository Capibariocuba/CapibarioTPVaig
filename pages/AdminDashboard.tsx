
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, DollarSign, Package, AlertTriangle, Trash2, Calendar, 
  User, Clock, ArrowUpRight, ArrowDownRight, Briefcase, Users, 
  RefreshCw, Info, ChevronRight, Inbox, Zap, ShieldCheck,
  // Added missing icons used in the UI
  Sparkles, Receipt, Crown
} from 'lucide-react';
import { Sale, Product, Role, Currency } from '../types';

export const AdminDashboard: React.FC = () => {
  const { sales, products, ledger, activeShift, users, clients, businessConfig, currencies } = useStore();

  // --- ESTADOS DE FILTRO ---
  const [dateRange, setDateRange] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | '90DAYS' | 'ALL'>('WEEK');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // --- LÓGICA DE TIEMPO ---
  const getFilterDates = useMemo(() => {
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (dateRange) {
      case 'TODAY': break;
      case 'YESTERDAY':
        start.setDate(now.getDate() - 1);
        now.setDate(now.getDate() - 1);
        now.setHours(23, 59, 59, 999);
        break;
      case 'WEEK':
        start.setDate(now.getDate() - 7);
        break;
      case 'MONTH':
        start.setMonth(now.getMonth() - 1);
        break;
      case '90DAYS':
        start.setDate(now.getDate() - 90);
        break;
      case 'ALL':
        start.setTime(0);
        break;
    }
    return { start, end: new Date() };
  }, [dateRange]);

  // --- FILTRADO DE DATOS (VENTAS) ---
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const saleDate = new Date(sale.timestamp);
      const matchDate = saleDate >= getFilterDates.start && saleDate <= getFilterDates.end;
      const matchOperator = selectedOperator === 'all' || sale.sellerName === selectedOperator;
      const matchShift = selectedShiftId === 'all' || sale.shiftId === selectedShiftId;
      return matchDate && matchOperator && matchShift;
    });
  }, [sales, getFilterDates, selectedOperator, selectedShiftId]);

  // --- CÁLCULOS DE INVENTARIO (Histórico Global) ---
  const inventoryStats = useMemo(() => {
    let totalItemsInStock = 0;
    let productsWithVariantsCount = 0;
    let totalInvestment = 0;
    let potentialProfit = 0;
    let lowStockCount = 0;
    let expiringCount = 0;
    const now = new Date();
    const expiringThreshold = new Date();
    expiringThreshold.setDate(now.getDate() + 30);

    products.forEach(p => {
      // Unidades totales (Base + Variantes)
      const stockBase = p.stock || 0;
      const stockVariants = p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0;
      const totalPStock = stockBase + stockVariants;
      
      totalItemsInStock += totalPStock;
      productsWithVariantsCount += 1 + (p.variants?.length || 0);

      // Inversión (Costo ponderado * Stock)
      totalInvestment += (stockBase * p.cost);
      p.variants?.forEach(v => {
        totalInvestment += (v.stock * v.cost);
      });

      // Ganancia Potencial: (Precio - Costo) * Stock
      potentialProfit += (stockBase * (p.price - p.cost));
      p.variants?.forEach(v => {
        potentialProfit += (v.stock * (v.price - v.cost));
      });

      // Alertas
      if (!p.isService && totalPStock < p.minStockAlert) lowStockCount++;
      if (p.expiryDate && new Date(p.expiryDate) <= expiringThreshold) expiringCount++;
    });

    return { totalItemsInStock, productsWithVariantsCount, totalInvestment, potentialProfit, lowStockCount, expiringCount };
  }, [products]);

  // --- CÁLCULOS DE VENTAS & GANANCIAS (Filtrado) ---
  const salesStats = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let transactions = filteredSales.length;

    filteredSales.forEach(s => {
      totalRevenue += s.total;
      // Estimación de costo basada en el costo actual del producto 
      // (En una implementación pro, el costo se captura en el momento de la venta)
      s.items.forEach(item => {
        const prod = products.find(p => p.id === item.id);
        if (prod) {
          const cost = item.selectedVariantId 
            ? (prod.variants.find(v => v.id === item.selectedVariantId)?.cost || prod.cost)
            : prod.cost;
          totalCost += (cost * item.quantity);
        }
      });
    });

    const profits = totalRevenue - totalCost;
    const avgTicket = transactions > 0 ? totalRevenue / transactions : 0;

    return { totalRevenue, totalCost, profits, transactions, avgTicket };
  }, [filteredSales, products]);

  // --- MERMAS (Filtrado) ---
  const wasteStats = useMemo(() => {
    return ledger
      .filter(e => {
        const eDate = new Date(e.timestamp);
        const matchDate = eDate >= getFilterDates.start && eDate <= getFilterDates.end;
        return e.type === 'STOCK_WASTE' && matchDate;
      })
      .reduce((acc, e) => acc + e.amount, 0);
  }, [ledger, getFilterDates]);

  // --- RANKINGS ---
  const topProducts = useMemo(() => {
    const map = new Map();
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const curr = map.get(item.name) || { name: item.name, qty: 0, revenue: 0 };
        curr.qty += item.quantity;
        curr.revenue += (item.quantity * item.finalPrice);
        map.set(item.name, curr);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filteredSales]);

  const topClients = useMemo(() => {
    const map = new Map();
    filteredSales.forEach(s => {
      if (s.clientId) {
        const client = clients.find(c => c.id === s.clientId);
        if (client) {
          const curr = map.get(client.name) || { name: client.name, total: 0, count: 0 };
          curr.total += s.total;
          curr.count += 1;
          map.set(client.name, curr);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredSales, clients]);

  const operatorRanking = useMemo(() => {
    const map = new Map();
    filteredSales.forEach(s => {
      const curr = map.get(s.sellerName) || { name: s.sellerName, total: 0, count: 0 };
      curr.total += s.total;
      curr.count += 1;
      map.set(s.sellerName, curr);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  // --- GRÁFICOS ---
  const dailyChartData = useMemo(() => {
    const days: Record<string, number> = {};
    filteredSales.forEach(s => {
      const d = new Date(s.timestamp).toLocaleDateString();
      days[d] = (days[d] || 0) + s.total;
    });
    return Object.entries(days).map(([date, total]) => ({ date, total })).slice(-7);
  }, [filteredSales]);

  // --- COMPONENTES AUXILIARES ---
  const StatCard = ({ title, value, sub, icon: Icon, color, trend }: any) => (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all group overflow-hidden relative">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:scale-110 transition-transform ${color}`} />
      <div className="flex items-center justify-between mb-4 relative">
        <div className={`p-3 rounded-2xl ${color} bg-opacity-10`}>
          <Icon className={color.replace('bg-', 'text-')} size={20} />
        </div>
        {trend && (
          <span className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trend > 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 tracking-tighter truncate">
          {typeof value === 'number' && !title.includes('Stock') && !title.includes('Ítems') ? `$${value.toLocaleString()}` : value}
        </h3>
        {sub && <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase italic">{sub}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-gray-50 h-full overflow-y-auto font-sans animate-in fade-in duration-500">
      
      {/* FILTROS HEADER */}
      <div className="bg-white p-4 md:p-6 rounded-[3rem] shadow-sm border border-gray-100 mb-8 sticky top-0 z-30 flex flex-col lg:flex-row gap-6 items-center justify-between backdrop-blur-md bg-opacity-90">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="p-3 bg-brand-500 rounded-2xl text-white shadow-lg"><TrendingUp size={24}/></div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Dashboard</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Capibario Intelligence v3.0</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-center lg:justify-end w-full lg:w-auto">
          <div className="flex bg-gray-100 p-1 rounded-2xl gap-1">
            {['TODAY', 'WEEK', 'MONTH', 'ALL'].map(r => (
              <button key={r} onClick={() => setDateRange(r as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${dateRange === r ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{r}</button>
            ))}
          </div>
          
          <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} className="bg-gray-100 border-none p-3 px-4 rounded-2xl font-black text-[9px] uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-500">
            <option value="all">TODOS LOS OPERADORES</option>
            {users.map(u => <option key={u.id} value={u.name}>{u.name.toUpperCase()}</option>)}
          </select>

          <button onClick={() => setLastUpdate(new Date())} className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-brand-600 transition-all shadow-lg active:scale-95"><RefreshCw size={18} className={autoRefresh ? 'animate-spin' : ''}/></button>
        </div>
      </div>

      {/* KPI HEADER - INFORMACIÓN FINANCIERA CRÍTICA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">
        <StatCard title="Dinero en Inversión" value={inventoryStats.totalInvestment} color="bg-brand-500" sub="Costo total del stock" icon={Inbox} />
        <StatCard title="Ganancia Neta (Rango)" value={salesStats.profits} color="bg-emerald-500" sub="Ingresos - Costos" icon={Zap} trend={12} />
        <StatCard title="Ventas Totales" value={salesStats.totalRevenue} color="bg-slate-900" sub={`En ${salesStats.transactions} trans.`} icon={DollarSign} />
        <StatCard title="Proyección Ganancia" value={inventoryStats.potentialProfit} color="bg-indigo-500" sub="Basado en stock actual" icon={Sparkles} />
        <StatCard title="Ticket Medio" value={salesStats.avgTicket} color="bg-amber-500" sub="Promedio por venta" icon={Receipt} />
        <StatCard title="Pérdida por Merma" value={wasteStats} color="bg-red-500" sub="No comercial" icon={Trash2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        {/* GRÁFICO PRINCIPAL */}
        <div className="lg:col-span-8 bg-white p-8 rounded-[4rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Ventas Históricas</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Rendimiento en el periodo seleccionado</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold'}} />
                <Area type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SALUD DE STOCK */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 p-8 rounded-[4rem] text-white shadow-xl relative overflow-hidden h-full">
            <Zap className="absolute -right-8 -bottom-8 w-40 h-40 text-white opacity-5" />
            <h3 className="text-xl font-black uppercase tracking-tighter mb-8">Estado de Almacén</h3>
            <div className="space-y-6 relative">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-500 rounded-2xl"><Inbox size={18}/></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">Productos</p><p className="font-black text-xl">{inventoryStats.productsWithVariantsCount}</p></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500 rounded-2xl"><Package size={18}/></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">Ítems Totales</p><p className="font-black text-xl">{inventoryStats.totalItemsInStock}</p></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500 rounded-2xl"><AlertTriangle size={18}/></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">Stock Bajo</p><p className="font-black text-xl text-red-400">{inventoryStats.lowStockCount}</p></div>
                </div>
              </div>
            </div>
            <div className="mt-10 p-4 bg-brand-500/10 rounded-3xl border border-brand-500/20">
              <p className="text-[8px] font-black uppercase text-brand-400 leading-tight">
                <Info size={10} className="inline mr-1" /> Estimación no oficial: puede variar por ofertas, mermas y cambios de precio.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN TURNOS Y OPERADORES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="bg-white p-8 rounded-[4rem] shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-3"><Users size={20} className="text-brand-500"/> Ranking Operadores</h3>
          <div className="space-y-4 flex-1">
            {operatorRanking.map((op, i) => (
              <div key={op.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-3xl border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">{i+1}</div>
                  <div><p className="text-[10px] font-black text-slate-800 uppercase">{op.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{op.count} VENTAS</p></div>
                </div>
                <p className="font-black text-sm text-slate-900">${op.total.toLocaleString()}</p>
              </div>
            ))}
            {operatorRanking.length === 0 && <p className="text-center text-slate-300 font-black uppercase text-[10px] py-10">Sin actividad</p>}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[4rem] shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-3"><Zap size={20} className="text-amber-500"/> Top Productos</h3>
          <div className="space-y-4 flex-1">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between p-4 bg-amber-50/30 rounded-3xl border border-amber-100">
                <div><p className="text-[10px] font-black text-slate-800 uppercase line-clamp-1">{p.name}</p><p className="text-[8px] font-bold text-amber-600 uppercase">{p.qty} UNIDADES</p></div>
                <p className="font-black text-sm text-slate-900">${p.revenue.toLocaleString()}</p>
              </div>
            ))}
             {topProducts.length === 0 && <p className="text-center text-slate-300 font-black uppercase text-[10px] py-10">Sin ventas</p>}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[4rem] shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-3"><Crown size={20} className="text-indigo-500"/> Top Clientes</h3>
          <div className="space-y-4 flex-1">
            {topClients.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between p-4 bg-indigo-50/30 rounded-3xl border border-indigo-100">
                <div><p className="text-[10px] font-black text-slate-800 uppercase">{c.name}</p><p className="text-[8px] font-bold text-indigo-600 uppercase">{c.count} VISITAS</p></div>
                <p className="font-black text-sm text-slate-900">${c.total.toLocaleString()}</p>
              </div>
            ))}
             {topClients.length === 0 && <p className="text-center text-slate-300 font-black uppercase text-[10px] py-10">Sin clientes registrados</p>}
          </div>
        </div>
      </div>

      {/* ESTADO DE TURNO ACTUAL */}
      <div className="bg-white p-8 rounded-[4rem] shadow-sm border border-gray-100 mb-10 overflow-hidden relative">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`p-6 rounded-[2.5rem] shadow-lg ${activeShift ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              <Clock size={32} className={activeShift ? 'animate-pulse' : ''}/>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Turno en curso</h3>
                <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${activeShift ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  {activeShift ? 'Turno Abierto' : 'No hay turno activo'}
                </span>
              </div>
              {activeShift && (
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Abierto por {activeShift.openedBy} el {new Date(activeShift.openedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
          
          {activeShift && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
               <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Ventas Turno</p><p className="text-xl font-black text-slate-900">${sales.filter(s => s.shiftId === activeShift.id).reduce((a, b) => a + b.total, 0).toLocaleString()}</p></div>
               <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Transacciones</p><p className="text-xl font-black text-slate-900">{sales.filter(s => s.shiftId === activeShift.id).length}</p></div>
               <div className="col-span-2"><button onClick={() => window.location.reload()} className="w-full h-full bg-slate-900 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-brand-600 transition-all">Ver Detalle de Turno</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
