
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Warehouse, Product, Batch } from '../types';
import { Plus, MapPin, Lock, X, AlertTriangle, Edit3, Save, Package, Tag, Layers, Search } from 'lucide-react';

export const Inventory: React.FC = () => {
  const { 
    warehouses, addWarehouse, updateWarehouse, deleteWarehouse, isItemLocked, 
    categories, addCategory, products, addProduct, notify
  } = useStore();
  
  const [activeWarehouseId, setActiveWarehouseId] = useState<string>(warehouses[0]?.id || 'wh-default');
  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  
  const [newWh, setNewWh] = useState<Partial<Warehouse>>({ name: '', location: '' });
  const [newCat, setNewCat] = useState('');
  const [newProd, setNewProd] = useState({ name: '', cost: 0, price: 0, stock: 0, category: 'Catálogo', sku: '' });
  
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const activeWarehouse = useMemo(() => warehouses.find(w => w.id === activeWarehouseId) || warehouses[0], [activeWarehouseId, warehouses]);
  const activeWhIndex = useMemo(() => warehouses.findIndex(w => w.id === activeWarehouseId), [activeWarehouseId, warehouses]);
  const isWhLocked = isItemLocked('WAREHOUSES', activeWhIndex);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.batches?.some(b => b.warehouseId === activeWarehouseId));
  }, [products, activeWarehouseId]);

  const handleAddWarehouse = () => {
    if (!newWh.name) return;
    addWarehouse({ 
      ...newWh, 
      id: Math.random().toString(36).substr(2, 9) 
    } as Warehouse);
    setNewWh({ name: '', location: '' });
    setIsWhModalOpen(false);
  };

  const handleRenameWarehouse = () => {
    if (!renameValue.trim()) return;
    updateWarehouse({ ...activeWarehouse, name: renameValue });
    setIsRenaming(false);
    notify("Almacén renombrado", "success");
  };

  const handleAddCategory = () => {
    if (!newCat.trim()) return;
    addCategory(newCat.trim());
    setNewCat('');
    setIsCatModalOpen(false);
    notify("Categoría añadida", "success");
  };

  const handleAddProduct = () => {
    if (!newProd.name || newProd.cost <= 0) {
      notify("Nombre y costo son obligatorios", "error");
      return;
    }

    const productId = Math.random().toString(36).substr(2, 9).toUpperCase();
    const sku = newProd.sku || `PROD-${productId.slice(0, 4)}`;

    const productBatch: Batch = {
      id: `batch-${Math.random().toString(36).substr(2, 5)}`,
      quantity: newProd.stock,
      cost: newProd.cost,
      receivedDate: new Date().toISOString(),
      warehouseId: activeWarehouseId
    };

    const product: Product = {
      id: productId,
      name: newProd.name,
      cost: newProd.cost,
      price: newProd.price || newProd.cost * 1.3, // Margen por defecto si no hay precio
      sku: sku,
      category: newProd.category,
      minStockAlert: 5,
      batches: [productBatch]
    };

    addProduct(product);
    setIsProdModalOpen(false);
    setNewProd({ name: '', cost: 0, price: 0, stock: 0, category: 'Catálogo', sku: '' });
    notify("Producto registrado en este almacén", "success");
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Inventario</h1>
          <div className="flex gap-3 mt-1">
             <p className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">Multi Almacén</p>
             <p className="text-[10px] bg-brand-500 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">Control de Stock</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button onClick={() => setIsCatModalOpen(true)} className="flex-1 md:flex-none bg-white border border-gray-200 text-slate-600 px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest shadow-sm">
                <Layers size={16} /> Crear Categoría
            </button>
            <button onClick={() => setIsWhModalOpen(true)} className="flex-1 md:flex-none bg-slate-900 text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl hover:bg-brand-600 transition-all uppercase text-[10px] tracking-widest">
                <Plus size={16} /> Almacén
            </button>
        </div>
      </div>

      {/* WAREHOUSE TABS */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide border-b border-gray-100">
        {warehouses.map((w, idx) => {
          const locked = isItemLocked('WAREHOUSES', idx);
          const active = activeWarehouseId === w.id;
          return (
            <button
              key={w.id}
              onClick={() => setActiveWarehouseId(w.id)}
              className={`px-8 py-4 rounded-t-3xl font-black text-[11px] uppercase tracking-[0.1em] transition-all flex items-center gap-3 whitespace-nowrap relative ${
                active 
                  ? 'bg-white text-brand-600 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.1)] border-t-4 border-brand-500' 
                  : 'bg-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {locked && <Lock size={12} className="text-amber-500" />}
              {active ? <MapPin size={14} /> : null}
              {w.name}
            </button>
          );
        })}
      </div>

      {/* ACTIVE WAREHOUSE CONTENT */}
      <div className="bg-white rounded-[3rem] p-6 md:p-10 shadow-sm border border-gray-100 relative overflow-hidden min-h-[500px]">
        {isWhLocked && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-center p-8">
                <div className="bg-amber-500 text-white p-6 rounded-[2rem] mb-4 shadow-2xl animate-bounce"><Lock size={32}/></div>
                <h3 className="text-2xl font-black text-amber-600 uppercase tracking-tighter">Acceso Restringido</h3>
                <p className="text-xs font-bold text-amber-500 mt-2 max-w-xs uppercase">Este depósito supera el límite de su plan. Actualice a SAPPHIRE para habilitar múltiples almacenes.</p>
            </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
            <div className="flex flex-col gap-2">
                {isRenaming ? (
                    <div className="flex items-center gap-2">
                        <input 
                            autoFocus
                            className="text-2xl font-black tracking-tighter uppercase outline-none border-b-4 border-brand-500 bg-gray-50 px-2 py-1"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleRenameWarehouse()}
                        />
                        <button onClick={handleRenameWarehouse} className="p-2 bg-emerald-500 text-white rounded-xl"><Save size={20}/></button>
                        <button onClick={() => setIsRenaming(false)} className="p-2 bg-gray-200 text-slate-400 rounded-xl"><X size={20}/></button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">{activeWarehouse?.name}</h2>
                        <button onClick={() => { setRenameValue(activeWarehouse?.name || ''); setIsRenaming(true); }} className="text-slate-300 hover:text-brand-500 transition-colors"><Edit3 size={18}/></button>
                    </div>
                )}
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={12} /> {activeWarehouse?.location || 'Ubicación no definida'}
                </p>
            </div>

            <button 
                onClick={() => setIsProdModalOpen(true)}
                className="w-full md:w-auto bg-brand-500 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-100 hover:bg-brand-600 transition-all flex items-center justify-center gap-3"
            >
                <Package size={20} /> Crear Producto
            </button>
        </div>

        {/* PRODUCTS TABLE (PHASE 1) */}
        <div className="overflow-x-auto -mx-6 md:-mx-10">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-y border-gray-100">
                    <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                        <th className="px-10 py-5">Nombre / SKU</th>
                        <th className="px-6 py-5">Categoría</th>
                        <th className="px-6 py-5">Costo</th>
                        <th className="px-6 py-5">Precio</th>
                        <th className="px-6 py-5 text-right">Stock Activo</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {filteredProducts.map(p => (
                        <tr key={p.id} className="group hover:bg-gray-50/50 transition-colors">
                            <td className="px-10 py-6">
                                <div className="font-black text-slate-800 uppercase tracking-tighter text-sm">{p.name}</div>
                                <div className="text-[10px] font-bold text-slate-300 font-mono mt-0.5">{p.sku}</div>
                            </td>
                            <td className="px-6 py-6">
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-tighter">{p.category}</span>
                            </td>
                            <td className="px-6 py-6 font-bold text-slate-400 text-sm">${p.cost.toFixed(2)}</td>
                            <td className="px-6 py-6 font-black text-brand-600 text-sm">${p.price.toFixed(2)}</td>
                            <td className="px-6 py-6 text-right">
                                <span className={`text-lg font-black tracking-tighter ${p.batches?.find(b => b.warehouseId === activeWarehouseId)?.quantity === 0 ? 'text-red-300' : 'text-slate-800'}`}>
                                    {p.batches?.find(b => b.warehouseId === activeWarehouseId)?.quantity || 0}
                                </span>
                                <span className="text-[8px] font-black text-slate-300 uppercase ml-1">un.</span>
                            </td>
                        </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                        <tr>
                            <td colSpan={5} className="py-32 text-center">
                                <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200"><Package size={40}/></div>
                                <p className="font-black text-gray-300 uppercase tracking-[0.2em] text-xs">Sin productos en este almacén</p>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODAL: NUEVO ALMACÉN */}
      {isWhModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter uppercase">Nuevo Depósito</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Expanda su red de distribución</p>
            <div className="space-y-4">
              <input 
                className="w-full bg-slate-50 border-none p-6 rounded-3xl font-bold outline-none focus:ring-4 focus:ring-brand-500/20" 
                placeholder="Nombre (Bodega Central)" 
                value={newWh.name}
                onChange={e => setNewWh({...newWh, name: e.target.value})} 
              />
              <input 
                className="w-full bg-slate-50 border-none p-6 rounded-3xl font-bold outline-none focus:ring-4 focus:ring-brand-500/20" 
                placeholder="Ubicación Física" 
                value={newWh.location}
                onChange={e => setNewWh({...newWh, location: e.target.value})} 
              />
              <button onClick={handleAddWarehouse} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl mt-6 shadow-2xl hover:bg-brand-600 transition-all uppercase tracking-widest text-xs">Registrar Almacén</button>
              <button onClick={() => setIsWhModalOpen(false)} className="w-full text-slate-400 font-black py-4 uppercase tracking-widest text-[10px]">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA CATEGORÍA */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mb-6"><Layers size={32}/></div>
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter uppercase">Categoría</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Estructura global de catálogo</p>
            <div className="space-y-4">
              <input 
                autoFocus
                className="w-full bg-slate-50 border-none p-6 rounded-3xl font-bold outline-none focus:ring-4 focus:ring-brand-500/20 uppercase" 
                placeholder="Ej: ALIMENTOS" 
                value={newCat}
                onChange={e => setNewCat(e.target.value)} 
              />
              <button onClick={handleAddCategory} className="w-full bg-brand-600 text-white font-black py-6 rounded-3xl mt-6 shadow-2xl hover:bg-brand-700 transition-all uppercase tracking-widest text-xs">Guardar Categoría</button>
              <button onClick={() => setIsCatModalOpen(false)} className="w-full text-slate-400 font-black py-4 uppercase tracking-widest text-[10px]">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO PRODUCTO (BASIC PHASE 1) */}
      {isProdModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[4rem] p-10 md:p-14 w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-10">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Nuevo Producto</h2>
                    <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mt-1">Creación en: {activeWarehouse?.name}</p>
                </div>
                <button onClick={() => setIsProdModalOpen(false)} className="p-3 bg-gray-100 text-slate-400 rounded-2xl hover:bg-gray-200"><X size={24}/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nombre del Producto *</label>
                    <input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-bold outline-none focus:ring-4 focus:ring-brand-500/10" value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} placeholder="Ej: Café Serrano 250g" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Categoría</label>
                    <select className="w-full bg-slate-50 border-none p-5 rounded-3xl font-bold outline-none appearance-none uppercase" value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value})}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">SKU / Código (Opcional)</label>
                    <input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-bold outline-none uppercase" value={newProd.sku} onChange={e => setNewProd({...newProd, sku: e.target.value})} placeholder="AUTO" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Costo Unitario *</label>
                    <input type="number" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-xl outline-none" value={newProd.cost} onChange={e => setNewProd({...newProd, cost: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Precio Venta</label>
                    <input type="number" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-xl text-brand-600 outline-none" value={newProd.price} onChange={e => setNewProd({...newProd, price: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Stock Inicial en este almacén</label>
                    <input type="number" className="w-full bg-slate-900 border-none p-6 rounded-3xl font-black text-2xl text-white outline-none" value={newProd.stock} onChange={e => setNewProd({...newProd, stock: parseInt(e.target.value) || 0})} />
                </div>
            </div>

            <button onClick={handleAddProduct} className="w-full bg-brand-600 text-white font-black py-7 rounded-3xl mt-10 shadow-2xl hover:bg-brand-700 transition-all uppercase tracking-[0.2em] text-xs">Añadir al Inventario</button>
          </div>
        </div>
      )}
    </div>
  );
};
