
import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Package, AlertTriangle, Trash2 } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { sales, products, ledger } = useStore();

  const totalSales = sales.reduce((acc, sale) => acc + sale.total, 0);
  const totalOrders = sales.length;

  const productsWithStock = useMemo(() => {
    return products.map(p => ({
      ...p,
      stock: (p.stock || 0) + (p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0)
    }));
  }, [products]);

  const lowStockProducts = productsWithStock.filter(p => !p.isService && p.stock < p.minStockAlert).length;

  // Cálculo de Pérdida por merma no comercial desde el Ledger
  const totalWasteLoss = useMemo(() => {
    return ledger
      .filter(e => e.type === 'STOCK_WASTE')
      .reduce((acc, e) => acc + e.amount, 0);
  }, [ledger]);

  // Process data for charts
  const salesData = sales.map(sale => ({
    time: new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    amount: sale.total
  })).slice(-10); // Last 10 sales

  const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
        {sub && <p className={`text-xs mt-2 ${sub.includes('+') ? 'text-green-500' : 'text-gray-400'}`}>{sub}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="text-white" size={24} />
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 bg-gray-50 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Panel de Control</h1>
        <p className="text-gray-500">Resumen general del negocio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
        <StatCard 
          title="Ventas Totales (Día)" 
          value={`${totalSales.toLocaleString()} CUP`} 
          sub="+12% vs ayer"
          icon={DollarSign}
          color="bg-emerald-500"
        />
        <StatCard 
          title="Pérdida por merma no comercial" 
          value={`${totalWasteLoss.toLocaleString()} CUP`} 
          sub="Valor de inventario dado de baja"
          icon={Trash2}
          color="bg-red-500"
        />
        <StatCard 
          title="Transacciones" 
          value={totalOrders} 
          sub="Pedidos completados"
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard 
          title="Inventario Total" 
          value={products.length} 
          sub="Productos activos"
          icon={Package}
          color="bg-indigo-500"
        />
        <StatCard 
          title="Alertas Stock" 
          value={lowStockProducts} 
          sub="Productos por agotar"
          icon={AlertTriangle}
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
          <h3 className="font-bold text-gray-800 mb-4">Ventas en tiempo real</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line type="monotone" dataKey="amount" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
          <h3 className="font-bold text-gray-800 mb-4">Top Productos</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={productsWithStock.slice(0, 5)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="stock" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
