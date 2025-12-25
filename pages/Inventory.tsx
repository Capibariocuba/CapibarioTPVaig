
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Warehouse, Product, ProductVariant, PricingRule, AuditLog, LicenseTier, Category } from '../types';
import { 
  Plus, MapPin, Lock, X, AlertTriangle, Edit3, Save, Package, Tag, Layers, Search, 
  Camera, Barcode, Trash2, History, ChevronRight, Calculator, Calendar, Info, ShieldAlert,
  ArrowRight, DollarSign, List, Sparkles, Zap, Crown, ChevronDown, ChevronUp, Check
} from 'lucide-react';

const COLORS = ['#0ea5e9', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#64748b', '#000000'];

// UTILIDAD DE GENERACIÓN DE IDS ÚNICOS E IRREPETIBLES (FASE B)
const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toUpperCase();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
};

export const Inventory: React.FC = () => {
  const { 
    warehouses, addWarehouse, updateWarehouse, deleteWarehouse, isItemLocked, 
    categories, addCategory, updateCategory, deleteCategory, products, addProduct, updateProduct, deleteProduct, notify,
    businessConfig, currentUser
  } = useStore();
  
  const tier = (businessConfig.license?.tier || 'GOLD') as LicenseTier;
  
  const [activeWarehouseId, setActiveWarehouseId] = useState<string>(warehouses[0]?.id || 'wh-default');
  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  
  const [newWh, setNewWh] = useState<Partial<Warehouse>>({ name: '', location: '' });
  const [newCatName, setNewCatName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // --- LÓGICA DE FICHA DE PRODUCTO ---
  const [prodTab, setProdTab] = useState<'DETAILS' | 'VARIANTS' | 'RULES' | 'LOG'>('DETAILS');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null);
  const [showScannerStub, setShowScannerStub] = useState(false);
  const [scannerValue, setScannerValue] = useState('');
  
  // Borrador de Regla de Precio (Flujo 2 pasos)
  const [ruleDraft, setRuleDraft] = useState<PricingRule | null>(null);

  const activeWarehouse = useMemo(() => warehouses.find(w => w.id === activeWarehouseId) || warehouses[0], [activeWarehouseId, warehouses]);
  const activeWhIndex = useMemo(() => warehouses.findIndex(w => w.id === activeWarehouseId), [activeWarehouseId, warehouses]);
  const isWhLocked = isItemLocked('WAREHOUSES', activeWhIndex);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.warehouseId === activeWarehouseId);
  }, [products, activeWarehouseId]);

  const computeTotalStock = (p: Product) => {
    const parentStock = p.stock || 0;
    const variantsStock = p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0;
    return parentStock + variantsStock;
  };

  const handleOpenNewProduct = () => {
    const newId = generateUniqueId();
    const initialProduct: Product = {
      id: newId,
      warehouseId: activeWarehouseId,
      name: '',
      sku: '',
      cost: 0,
      price: 0,
      stock: 0,
      categories: ['Catálogo'],
      variants: [],
      pricingRules: [],
      minStockAlert: 5,
      history: [{
        id: generateUniqueId(),
        timestamp: new Date().toISOString(),
        type: 'CREATED',
        userName: currentUser?.name || 'Sistema',
        details: 'Producto iniciado en borrador',
        entityType: 'PRODUCT',
        entityId: newId
      }]
    };
    setEditingProduct(initialProduct);
    setOriginalProduct(initialProduct);
    setProdTab('DETAILS');
    setRuleDraft(null);
    setIsProdModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    const clone = JSON.parse(JSON.stringify(p));
    setEditingProduct(clone);
    setOriginalProduct(clone);
    setProdTab('DETAILS');
    setRuleDraft(null);
    setIsProdModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'PARENT' | string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 307200) { notify("Máx 300KB", "error"); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'PARENT') {
          setEditingProduct(prev => prev ? ({ ...prev, image: reader.result as string }) : null);
        } else {
          setEditingProduct(prev => prev ? ({
            ...prev,
            variants: prev.variants?.map(v => v.id === target ? { ...v, image: reader.result as string } : v)
          }) : null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = () => {
    if (!editingProduct?.name || (editingProduct.cost || 0) <= 0) {
      notify("Nombre y costo (>0) obligatorios", "error");
      return;
    }

    // AUDITORÍA CONSOLIDADA: Agrupación de cambios por entidad
    const diffLogs: AuditLog[] = [];
    if (originalProduct && editingProduct) {
      const actorName = currentUser?.name || 'Sistema';
      const timestamp = new Date().toISOString();

      // 1. Consolidar cambios en Producto Base
      const productChanges: string[] = [];
      const productBefore: any = {};
      const productAfter: any = {};
      const basicFields: (keyof Product)[] = ['name', 'sku', 'cost', 'price', 'stock', 'expiryDate', 'categories'];

      basicFields.forEach(f => {
        const valBefore = originalProduct[f];
        const valAfter = editingProduct[f];
        
        // Comparación segura (incluyendo arrays como categories)
        if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
          productChanges.push(`${String(f).toUpperCase()}: ${valBefore || 'N/A'} -> ${valAfter || 'N/A'}`);
          productBefore[f] = valBefore;
          productAfter[f] = valAfter;
        }
      });

      if (productChanges.length > 0) {
        diffLogs.push({
          id: generateUniqueId(),
          timestamp,
          type: 'UPDATED',
          userName: actorName,
          details: `Campos actualizados: ${productChanges.join(', ')}`,
          entityType: 'PRODUCT',
          entityId: editingProduct.id,
          details_raw: { before: productBefore, after: productAfter }
        });
      }

      // 2. Consolidar cambios en Variantes
      editingProduct.variants.forEach(v => {
        const oldV = originalProduct.variants.find(ov => ov.id === v.id);
        if (oldV) {
          const vChanges: string[] = [];
          const vBefore: any = {};
          const vAfter: any = {};
          const vFields: (keyof ProductVariant)[] = ['name', 'sku', 'cost', 'price', 'stock'];

          vFields.forEach(vf => {
            if (v[vf] !== oldV[vf]) {
              vChanges.push(`${String(vf).toUpperCase()}: ${oldV[vf] || 'N/A'} -> ${v[vf] || 'N/A'}`);
              vBefore[vf] = oldV[vf];
              vAfter[vf] = v[vf];
            }
          });

          if (vChanges.length > 0) {
            diffLogs.push({
              id: generateUniqueId(),
              timestamp,
              type: 'VARIANT_UPDATED',
              userName: actorName,
              details: `Variante ${v.name} (ID: ${v.id.slice(-4)}) actualizada: ${vChanges.join(', ')}`,
              entityType: 'VARIANT',
              entityId: v.id,
              details_raw: { before: vBefore, after: vAfter }
            });
          }
        }
      });
    }

    const consolidatedProduct = {
      ...editingProduct,
      history: [...diffLogs, ...(editingProduct.history || [])]
    };

    const isNew = !products.some(p => p.id === consolidatedProduct.id);
    if (isNew) addProduct(consolidatedProduct);
    else updateProduct(consolidatedProduct);
    
    setIsProdModalOpen(false);
    setEditingProduct(null);
    setOriginalProduct(null);
    setRuleDraft(null);
    notify("Datos consolidados", "success");
  };

  // ADICIÓN DE VARIANTE: Log descriptivo
  const addVariant = () => {
    if (tier === 'GOLD') { notify("Actualice a SAPPHIRE para usar variantes", "error"); return; }
    if (!editingProduct) return;

    const newVId = 'VAR-' + generateUniqueId();
    const newVName = `Variante ${editingProduct.variants?.length ? editingProduct.variants.length + 1 : 1}`;
    const newV: ProductVariant = {
        id: newVId,
        name: newVName,
        cost: editingProduct.cost || 0,
        price: editingProduct.price || 0,
        stock: 0,
        sku: ''
    };
    
    const newLog: AuditLog = {
      id: generateUniqueId(),
      timestamp: new Date().toISOString(),
      type: 'VARIANT_ADDED',
      userName: currentUser?.name || 'Sistema',
      details: `Variante creada: ${newVName} (ID: ${newVId.slice(-4)}) con valores base del producto`,
      entityType: 'VARIANT',
      entityId: newVId,
      details_raw: { after: newV }
    };

    setEditingProduct(prev => prev ? ({
        ...prev,
        variants: [...(prev.variants || []), newV],
        history: [newLog, ...(prev.history || [])]
    }) : null);
  };

  // REGLAS DE PRECIO: NO SOLAPAMIENTO (Incluyendo Fechas)
  const checkRuleOverlap = (min: number, max: number, targetId: string, currentRules: PricingRule[], startDate?: string, endDate?: string) => {
    return currentRules
      .filter(r => r.targetId === targetId && r.isActive !== false)
      .some(r => {
        // 1. Intersección de Cantidades: Math.max(minA, minB) <= Math.min(maxA, maxB)
        const qtyOverlap = Math.max(min, r.minQuantity) <= Math.min(max, r.maxQuantity);
        if (!qtyOverlap) return false;

        // 2. Intersección Temporal
        // Si ninguna regla tiene fechas, el conflicto es total basado en cantidades.
        if (!startDate && !endDate && !r.startDate && !r.endDate) return true;

        // Si una regla es global (sin fechas) y la otra tiene ventana, hay solapamiento en esa ventana.
        if (!startDate && !endDate) return true;
        if (!r.startDate && !r.endDate) return true;

        // Si ambas tienen fechas, validar intersección de periodos
        const startA = startDate ? new Date(startDate).getTime() : 0;
        const endA = endDate ? new Date(endDate).getTime() : Infinity;
        const startB = r.startDate ? new Date(r.startDate).getTime() : 0;
        const endB = r.endDate ? new Date(r.endDate).getTime() : Infinity;

        const timeOverlap = Math.max(startA, startB) <= Math.min(endA, endB);
        return timeOverlap;
      });
  };

  // FLUJO 2 PASOS: Abrir borrador de regla
  const handleOpenRuleDraft = () => {
    if (!editingProduct) return;
    
    // Validar límites Gold
    const activeRules = (editingProduct.pricingRules || []).filter(r => r.isActive !== false);
    if (tier === 'GOLD' && activeRules.length >= 1) {
        notify("Plan GOLD limitado a 1 regla activa por producto", "error");
        return;
    }

    setRuleDraft({
      id: 'RULE-' + generateUniqueId(),
      targetId: 'PARENT',
      minQuantity: 1,
      maxQuantity: 10,
      newPrice: editingProduct.price,
      isActive: true
    });
  };

  // FLUJO 2 PASOS: Guardar borrador de regla
  const handleSaveRuleDraft = () => {
    if (!editingProduct || !ruleDraft) return;

    // Validaciones básicas
    if (ruleDraft.minQuantity < 1) { notify("Cantidad mínima debe ser >= 1", "error"); return; }
    if (ruleDraft.maxQuantity < ruleDraft.minQuantity) { notify("Máx debe ser >= Mín", "error"); return; }
    if (ruleDraft.newPrice <= 0) { notify("Precio debe ser mayor a 0", "error"); return; }

    // Validación de fechas
    if (ruleDraft.endDate && !ruleDraft.startDate) {
        notify("Si define fecha de fin, debe definir fecha de inicio", "error");
        return;
    }
    if (ruleDraft.startDate && ruleDraft.endDate) {
        if (new Date(ruleDraft.endDate) <= new Date(ruleDraft.startDate)) {
            notify("La fecha de fin debe ser posterior a la de inicio", "error");
            return;
        }
    }

    // Validación de solapamiento
    if (checkRuleOverlap(ruleDraft.minQuantity, ruleDraft.maxQuantity, ruleDraft.targetId, editingProduct.pricingRules, ruleDraft.startDate, ruleDraft.endDate)) {
        notify("Conflicto detectado: El rango de cantidad y tiempo se solapa con una regla activa.", "error");
        return;
    }

    const targetLabel = ruleDraft.targetId === 'PARENT' ? 'Producto Base' : (editingProduct.variants.find(v => v.id === ruleDraft.targetId)?.name || 'Variante');
    
    let dateRangeText = "";
    if (ruleDraft.startDate) {
        dateRangeText = ` desde ${new Date(ruleDraft.startDate).toLocaleString()}`;
        if (ruleDraft.endDate) dateRangeText += ` hasta ${new Date(ruleDraft.endDate).toLocaleString()}`;
    }

    const newLog: AuditLog = {
      id: generateUniqueId(),
      timestamp: new Date().toISOString(),
      type: 'RULE_ADDED',
      userName: currentUser?.name || 'Sistema',
      details: `Regla guardada (ID: ${ruleDraft.id.slice(-4)}) para ${targetLabel}: ${ruleDraft.minQuantity}-${ruleDraft.maxQuantity} uds a $${ruleDraft.newPrice.toFixed(2)}${dateRangeText}`,
      entityType: 'PRICE_RULE',
      entityId: ruleDraft.id,
      details_raw: { after: ruleDraft }
    };

    setEditingProduct(prev => prev ? ({
        ...prev,
        pricingRules: [...(prev.pricingRules || []), ruleDraft],
        history: [newLog, ...(prev.history || [])]
    }) : null);

    setRuleDraft(null);
    notify("Regla configurada correctamente", "success");
  };

  // DESACTIVACIÓN DE REGLA (SOFT DELETE + AUDITORÍA)
  const handleDeactivateRule = (ruleId: string) => {
    if (!editingProduct) return;
    const rule = editingProduct.pricingRules.find(r => r.id === ruleId);
    if (!rule) return;

    const targetLabel = rule.targetId === 'PARENT' ? 'Producto Base' : (editingProduct.variants.find(v => v.id === rule.targetId)?.name || 'Variante');
    
    const deactLog: AuditLog = {
      id: generateUniqueId(),
      timestamp: new Date().toISOString(),
      type: 'RULE_REMOVED',
      userName: currentUser?.name || 'Sistema',
      details: `Regla desactivada (ID: ${ruleId.slice(-4)}) para ${targetLabel}: Rango ${rule.minQuantity}-${rule.maxQuantity} a $${rule.newPrice.toFixed(2)}`,
      entityType: 'PRICE_RULE',
      entityId: ruleId,
      details_raw: { before: rule, after: { ...rule, isActive: false } }
    };

    setEditingProduct(prev => prev ? ({
        ...prev,
        pricingRules: prev.pricingRules.map(r => r.id === ruleId ? { ...r, isActive: false } : r),
        history: [deactLog, ...(prev.history || [])]
    }) : null);
    
    notify("Regla desactivada correctamente", "success");
  };

  // COMPONENTE GESTOR CATEGORÍAS (MODAL)
  const CategoryManagerModal = () => {
    const [expandedCat, setExpandedCat] = useState<string | null>(null);
    return (
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
        <div className="bg-white rounded-[3rem] w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in">
           <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3"><Layers size={24}/> Gestión de Categorías</h2>
              <button onClick={() => setIsCatManagerOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24}/></button>
           </div>
           
           <div className="p-8 border-b border-gray-100 bg-gray-50 flex gap-3">
              <input className="flex-1 bg-white border-2 border-gray-200 p-4 rounded-2xl font-bold uppercase outline-none focus:border-brand-500" placeholder="Nueva Categoría..." value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && (addCategory(newCatName), setNewCatName(''))} />
              <button onClick={() => { if(newCatName.trim()) { addCategory(newCatName.trim()); setNewCatName(''); } }} className="bg-slate-900 text-white px-8 rounded-2xl font-black uppercase text-xs">Añadir</button>
           </div>

           <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {categories.map(cat => {
                const linkedProducts = products.filter(p => p.categories.includes(cat.name));
                return (
                  <div key={cat.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                     <div className="p-5 flex items-center gap-4 group">
                        <div className="w-8 h-8 rounded-full flex-shrink-0 shadow-inner cursor-pointer relative" style={{ backgroundColor: cat.color }}>
                            <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={cat.color} onChange={e => updateCategory({ ...cat, color: e.target.value })} title="Cambiar color" />
                        </div>
                        <input className="flex-1 bg-transparent font-black uppercase tracking-tighter outline-none focus:text-brand-600 border-b-2 border-transparent focus:border-brand-100 transition-all" value={cat.name} onChange={e => updateCategory({ ...cat, name: e.target.value.toUpperCase() })} />
                        <div className="flex items-center gap-2">
                           <button onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)} className="p-2 text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[10px] font-black uppercase">
                              {linkedProducts.length} Ítems {expandedCat === cat.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                           </button>
                           {cat.name !== 'Catálogo' && (
                             <button onClick={() => { if(confirm(`¿Eliminar categoría "${cat.name}"?`)) deleteCategory(cat.id); }} className="p-2 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                           )}
                        </div>
                     </div>
                     {expandedCat === cat.id && (
                       <div className="bg-gray-50 p-5 border-t border-gray-100 animate-in slide-in-from-top-2">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-3 tracking-widest">Listado de productos asociados:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             {linkedProducts.map(p => (
                               <div key={p.id} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-slate-700 truncate mr-2">{p.name}</span>
                                  <span className={`text-[9px] font-black uppercase ${computeTotalStock(p) > 0 ? 'text-brand-500' : 'text-slate-300'}`}>Stock: {computeTotalStock(p)}</span>
                               </div>
                             ))}
                             {linkedProducts.length === 0 && <p className="text-[10px] text-gray-400 italic">No hay productos en esta categoría.</p>}
                          </div>
                       </div>
                     )}
                  </div>
                );
              })}
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Inventario</h1>
          <div className="flex gap-3 mt-1">
             <p className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">Multi Almacén</p>
             <p className="text-[10px] bg-brand-500 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">Control de Stock</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button onClick={() => setIsCatManagerOpen(true)} className="flex-1 md:flex-none bg-white border border-gray-200 text-slate-600 px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest shadow-sm">
                <Layers size={16} /> Gestionar Categorías
            </button>
            <button onClick={() => setIsWhModalOpen(true)} className="flex-1 md:flex-none bg-slate-900 text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl hover:bg-brand-600 transition-all uppercase text-[10px] tracking-widest">
                <Plus size={16} /> Almacén
            </button>
        </div>
      </div>

      {/* TABS DE ALMACENES */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide border-b border-gray-100">
        {warehouses.map((w, idx) => {
          const locked = isItemLocked('WAREHOUSES', idx);
          const active = activeWarehouseId === w.id;
          return (
            <button key={w.id} onClick={() => setActiveWarehouseId(w.id)} className={`px-8 py-4 rounded-t-3xl font-black text-[11px] uppercase tracking-[0.1em] transition-all flex items-center gap-3 whitespace-nowrap relative ${active ? 'bg-white text-brand-600 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.1)] border-t-4 border-brand-500' : 'bg-transparent text-slate-400 hover:text-slate-600'}`}>
              {locked && <Lock size={12} className="text-amber-500" />}
              {active ? <MapPin size={14} /> : null}
              {w.name}
            </button>
          );
        })}
      </div>

      {/* LISTADO DE PRODUCTOS */}
      <div className="bg-white rounded-[3rem] p-6 md:p-10 shadow-sm border border-gray-100 relative overflow-hidden min-h-[500px]">
        {isWhLocked && <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-center p-8"><div className="bg-amber-500 text-white p-6 rounded-[2rem] mb-4 shadow-2xl animate-bounce"><Lock size={32}/></div><h3 className="text-2xl font-black text-amber-600 uppercase tracking-tighter">Acceso Restringido</h3><p className="text-xs font-bold text-amber-500 mt-2 max-w-xs uppercase">Mejore a SAPPHIRE para habilitar múltiples almacenes.</p></div>}
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
            <div className="flex flex-col gap-2">
                {isRenaming ? (
                    <div className="flex items-center gap-2">
                        <input autoFocus className="text-2xl font-black tracking-tighter uppercase outline-none border-b-4 border-brand-500 bg-gray-50 px-2 py-1" value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && (updateWarehouse({...activeWarehouse, name: renameValue}), setIsRenaming(false))} />
                        <button onClick={() => { updateWarehouse({...activeWarehouse, name: renameValue}); setIsRenaming(false); }} className="p-2 bg-emerald-500 text-white rounded-xl"><Save size={20}/></button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">{activeWarehouse?.name}</h2>
                        <div className="flex gap-2">
                            <button onClick={() => { setRenameValue(activeWarehouse?.name || ''); setIsRenaming(true); }} className="text-slate-300 hover:text-brand-500 transition-colors" title="Renombrar"><Edit3 size={18}/></button>
                            {/* BOTÓN DE ELIMINAR ALMACÉN ACTIVO */}
                            {warehouses.length > 1 && (
                                <button onClick={() => { if(confirm(`¿Desea eliminar permanentemente el depósito "${activeWarehouse?.name}"?`)) { deleteWarehouse(activeWarehouseId); setActiveWarehouseId(warehouses.find(w => w.id !== activeWarehouseId)?.id || ''); } }} className="text-red-200 hover:text-red-500 transition-colors" title="Eliminar Almacén"><Trash2 size={18}/></button>
                            )}
                        </div>
                    </div>
                )}
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={12} /> {activeWarehouse?.location || 'General'}</p>
            </div>
            <button onClick={handleOpenNewProduct} className="w-full md:w-auto bg-brand-500 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-brand-600 transition-all flex items-center justify-center gap-3"><Package size={20} /> Crear Producto</button>
        </div>

        <div className="overflow-x-auto -mx-6 md:-mx-10">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-y border-gray-100">
                    <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                        <th className="px-10 py-5">Producto / SKU</th>
                        <th className="px-6 py-5">Categorías</th>
                        <th className="px-6 py-5">Venta</th>
                        <th className="px-6 py-5 text-right">Stock Total</th>
                        <th className="px-10 py-5 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {filteredProducts.map(p => {
                        const totalStock = computeTotalStock(p);
                        return (
                        <tr key={p.id} className="group hover:bg-gray-50/50 transition-colors">
                            <td className="px-10 py-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shadow-inner flex-shrink-0">{p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package className="w-full h-full p-2 text-gray-300" />}</div>
                                    <div>
                                        <div className="font-black text-slate-800 uppercase tracking-tighter text-sm">{p.name}</div>
                                        <div className="text-[10px] font-bold text-slate-300 font-mono">{p.sku || 'SIN SKU'}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-6">
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {p.categories?.map(cName => {
                                        const cObj = categories.find(c => c.name === cName);
                                        return <span key={cName} className="px-2 py-0.5 rounded text-[8px] font-black uppercase text-white shadow-sm" style={{ backgroundColor: cObj?.color || '#64748b' }}>{cName}</span>;
                                    })}
                                </div>
                            </td>
                            <td className="px-6 py-6 font-black text-brand-600 text-sm">${p.price.toFixed(2)}</td>
                            <td className={`px-6 py-6 text-right font-black text-lg tracking-tighter ${totalStock <= (p.minStockAlert || 5) ? 'text-red-500' : 'text-slate-800'}`}>{totalStock}</td>
                            <td className="px-10 py-6 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => handleOpenEditProduct(p)} className="p-3 text-slate-400 hover:text-brand-600 bg-gray-50 rounded-xl transition-all"><Edit3 size={18}/></button>
                                    <button onClick={() => { if(confirm('¿Eliminar producto?')) deleteProduct(p.id); }} className="p-3 text-red-300 hover:text-red-500 bg-red-50/50 rounded-xl transition-all"><Trash2 size={18}/></button>
                                </div>
                            </td>
                        </tr>
                    )})}
                    {filteredProducts.length === 0 && <tr><td colSpan={5} className="py-32 text-center text-gray-300 font-black uppercase text-xs">Sin existencias registradas</td></tr>}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODAL FICHA PRODUCTO */}
      {isProdModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-white/10 flex items-center justify-center text-brand-400 shadow-xl"><Package size={32}/></div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase">Ficha de Producto</h2>
                        <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest">ID: {editingProduct.id}</p>
                    </div>
                </div>
                <button onClick={() => setIsProdModalOpen(false)} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={28}/></button>
            </div>

            <div className="flex bg-slate-100 p-2 gap-2 flex-shrink-0">
                {[
                    { id: 'DETAILS', label: 'Detalles', icon: List },
                    { id: 'VARIANTS', label: 'Variantes', icon: Layers, locked: tier === 'GOLD' },
                    { id: 'RULES', label: 'Reglas de Precio', icon: DollarSign },
                    { id: 'LOG', label: 'Auditoría', icon: History }
                ].map(t => (
                    <button key={t.id} onClick={() => setProdTab(t.id as any)} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${prodTab === t.id ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                        <t.icon size={16}/> {t.label} {t.locked && <Lock size={12} className="text-amber-500" />}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-10 bg-gray-50/50">
                {prodTab === 'DETAILS' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-4 flex flex-col items-center">
                            <div className="w-full aspect-square bg-white rounded-[3rem] border-4 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group mb-6 shadow-inner">
                                {editingProduct.image ? <img src={editingProduct.image} className="w-full h-full object-cover" /> : <div className="text-center p-8"><Camera className="mx-auto text-gray-200 mb-2" size={48}/><p className="text-[10px] font-black uppercase text-gray-300">Añadir Foto</p></div>}
                                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera className="text-white" size={32}/><input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'PARENT')}/></label>
                            </div>
                            <div className="w-full bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Tag size={14}/> Categorías</h4>
                                <div className="flex flex-wrap gap-2">
                                    {categories.map(c => {
                                        const isSelected = editingProduct.categories?.includes(c.name);
                                        return (
                                            <button key={c.id} onClick={() => {
                                                    setEditingProduct(prev => {
                                                        if (!prev) return null;
                                                        const current = prev.categories || [];
                                                        const next = isSelected ? current.filter(cat => cat !== c.name) : [...current, c.name];
                                                        return { ...prev, categories: next.length > 0 ? next : ['Catálogo'] };
                                                    });
                                                }}
                                                className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${isSelected ? 'shadow-lg text-white' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-brand-200'}`}
                                                style={{ backgroundColor: isSelected ? c.color : undefined, borderColor: isSelected ? c.color : undefined }}
                                            >{c.name}</button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">Nombre del Producto *</label><input className="w-full bg-white border-2 border-gray-100 p-5 rounded-3xl font-black text-slate-800 text-lg outline-none focus:border-brand-500" value={editingProduct.name} onChange={e => setEditingProduct(prev => prev ? ({...prev, name: e.target.value}) : null)} placeholder="Ej: Café Serrano" /></div>
                                <div className="space-y-1 relative"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">SKU / Barcode</label><div className="relative"><input className="w-full bg-white border-2 border-gray-100 p-5 pr-14 rounded-3xl font-bold outline-none uppercase" value={editingProduct.sku} onChange={e => setEditingProduct(prev => prev ? ({...prev, sku: e.target.value}) : null)} placeholder="Escanear..." /><button onClick={() => setShowScannerStub(true)} className="absolute right-4 top-4 text-brand-500"><Barcode size={24}/></button></div></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">Vencimiento</label><div className="relative"><Calendar className="absolute left-5 top-5 text-gray-300" size={20}/><input type="date" className="w-full bg-white border-2 border-gray-100 p-5 pl-14 rounded-3xl font-bold outline-none" value={editingProduct.expiryDate} onChange={e => setEditingProduct(prev => prev ? ({...prev, expiryDate: e.target.value}) : null)} /></div></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">Costo Unitario *</label><div className="relative"><DollarSign className="absolute left-5 top-5 text-gray-300" size={20}/><input type="number" className="w-full bg-white border-2 border-gray-100 p-5 pl-14 rounded-3xl font-black text-xl" value={editingProduct.cost} onChange={e => setEditingProduct(prev => prev ? ({...prev, cost: parseFloat(e.target.value) || 0}) : null)} /></div></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">Precio Venta *</label><div className="relative"><DollarSign className="absolute left-5 top-5 text-brand-300" size={20}/><input type="number" className="w-full bg-white border-2 border-gray-100 p-5 pl-14 rounded-3xl font-black text-xl text-brand-600" value={editingProduct.price} onChange={e => setEditingProduct(prev => prev ? ({...prev, price: parseFloat(e.target.value) || 0}) : null)} /></div></div>
                                
                                <div className="md:col-span-2 bg-slate-900 p-6 rounded-[2.5rem] flex items-center justify-between border-b-4 border-brand-500 shadow-xl">
                                    <div>
                                        <p className="text-[9px] font-black text-brand-400 uppercase tracking-[0.2em] mb-1">Margen de Rentabilidad</p>
                                        <h5 className="text-white font-black text-2xl tracking-tighter">
                                            {editingProduct.cost > 0 
                                                ? `${(((editingProduct.price - editingProduct.cost) / editingProduct.cost) * 100).toFixed(1)}% de Ganancia`
                                                : 'Defina costo mayor a 0'}
                                        </h5>
                                    </div>
                                    <div className="p-4 bg-white/10 rounded-2xl text-brand-400 shadow-inner"><Calculator size={28}/></div>
                                </div>

                                <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">Stock en Almacén Activo *</label><div className="relative"><Package className="absolute left-6 top-6 text-gray-300" size={28}/><input type="number" className="w-full bg-gray-100 border-none p-7 pl-20 rounded-[2.5rem] font-black text-3xl text-slate-800 outline-none" value={editingProduct.stock} onChange={e => setEditingProduct(prev => prev ? ({...prev, stock: parseInt(e.target.value) || 0}) : null)} /></div></div>
                            </div>
                        </div>
                    </div>
                )}

                {prodTab === 'VARIANTS' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-8">
                            <div><h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Variantes</h3><p className="text-[10px] text-slate-400 font-bold uppercase">Gestione sub-productos vinculados</p></div>
                            <button onClick={addVariant} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-xl hover:bg-brand-600 transition-all"><Plus size={16}/> Nueva Variante</button>
                        </div>
                        {tier === 'GOLD' ? (
                          <div className="bg-amber-50 p-16 rounded-[4rem] text-center border-2 border-dashed border-amber-200"><Lock size={48} className="mx-auto text-amber-500 mb-6" /><h4 className="text-xl font-black text-amber-600 uppercase">Variantes Bloqueadas</h4><p className="text-[10px] text-amber-500 font-bold uppercase mt-2">Requiere Plan Sapphire+</p></div>
                        ) : (
                          <div className="space-y-4">
                            {editingProduct.variants?.map((v, i) => (
                              <div key={v.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 flex items-center gap-6 animate-in slide-in-from-left">
                                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex-shrink-0 overflow-hidden relative group">{v.image ? <img src={v.image} className="w-full h-full object-cover" /> : <Camera className="w-full h-full p-6 text-gray-200" />}<label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera size={18} className="text-white"/><input type="file" className="hidden" onChange={e => handleImageUpload(e, v.id)}/></label></div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                                  <input className="bg-gray-50 p-3 rounded-xl font-bold text-xs uppercase" placeholder="Nombre" value={v.name} onChange={e => setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.map((vr, idx) => idx === i ? {...vr, name: e.target.value} : vr)}) : null)} />
                                  <input className="bg-gray-50 p-3 rounded-xl font-bold text-xs" placeholder="SKU" value={v.sku} onChange={e => setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.map((vr, idx) => idx === i ? {...vr, sku: e.target.value} : vr)}) : null)} />
                                  <input type="number" className="bg-gray-50 p-3 rounded-xl font-black text-xs text-brand-600" value={v.price} onChange={e => setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.map((vr, idx) => idx === i ? {...vr, price: parseFloat(e.target.value) || 0} : vr)}) : null)} />
                                  <div className="flex gap-2"><input type="number" className="flex-1 bg-slate-900 p-3 rounded-xl font-black text-xs text-white" value={v.stock} onChange={e => setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.map((vr, idx) => idx === i ? {...vr, stock: parseInt(e.target.value) || 0} : vr)}) : null)} /><button onClick={() => { if(confirm('¿Eliminar variante?')) setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.filter((_, idx) => idx !== i)}) : null); }} className="p-3 text-red-400 bg-red-50 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18}/></button></div>
                                </div>
                              </div>
                            ))}
                            {editingProduct.variants?.length === 0 && (
                                <div className="p-20 text-center text-slate-300 font-black uppercase text-xs">Sin variantes registradas</div>
                            )}
                          </div>
                        )}
                    </div>
                )}

                {prodTab === 'RULES' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-8">
                            <div><h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Reglas de Precio</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Configuraciones inmutables</p></div>
                            {!ruleDraft && (
                              <button onClick={handleOpenRuleDraft} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-brand-600 transition-all shadow-xl"><Plus size={16}/> Añadir Regla</button>
                            )}
                        </div>

                        {/* Formulario de Borrador (Paso 1) */}
                        {ruleDraft && (
                          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-brand-500 shadow-xl animate-in zoom-in space-y-6 mb-10">
                              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                  <h4 className="text-[10px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-2"><Edit3 size={14}/> Borrador de Regla Nueva</h4>
                                  <button onClick={() => setRuleDraft(null)} className="text-gray-300 hover:text-red-500 transition-all"><X size={20}/></button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Aplicar a:</label>
                                      <select className="bg-gray-50 p-4 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-brand-500 border border-transparent" value={ruleDraft.targetId} onChange={e => setRuleDraft({...ruleDraft, targetId: e.target.value})}>
                                          <option value="PARENT">Producto Base</option>
                                          {editingProduct.variants?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                      </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Cant. Mínima</label>
                                      <input type="number" className="bg-gray-50 p-4 rounded-2xl font-black text-center outline-none focus:ring-2 focus:ring-brand-500" value={ruleDraft.minQuantity} onChange={e => setRuleDraft({...ruleDraft, minQuantity: parseInt(e.target.value) || 0})} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Cant. Máxima</label>
                                      <input type="number" className="bg-gray-50 p-4 rounded-2xl font-black text-center outline-none focus:ring-2 focus:ring-brand-500" value={ruleDraft.maxQuantity} onChange={e => setRuleDraft({...ruleDraft, maxQuantity: parseInt(e.target.value) || 0})} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Nuevo Precio Unitario</label>
                                      <input type="number" className="bg-brand-50 p-4 rounded-2xl font-black text-center text-brand-600 outline-none focus:ring-2 focus:ring-brand-500" value={ruleDraft.newPrice} onChange={e => setRuleDraft({...ruleDraft, newPrice: parseFloat(e.target.value) || 0})} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Vigencia Inicio</label>
                                      <input type="datetime-local" className="bg-gray-50 p-4 rounded-2xl font-black text-[10px] text-center outline-none" value={ruleDraft.startDate} onChange={e => setRuleDraft({...ruleDraft, startDate: e.target.value})} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Vigencia Fin (Opcional)</label>
                                      <input type="datetime-local" className="bg-gray-50 p-4 rounded-2xl font-black text-[10px] text-center outline-none" value={ruleDraft.endDate} onChange={e => setRuleDraft({...ruleDraft, endDate: e.target.value})} />
                                  </div>
                              </div>
                              <button onClick={handleSaveRuleDraft} className="w-full bg-brand-600 text-white font-black py-5 rounded-3xl flex items-center justify-center gap-3 uppercase text-xs tracking-widest shadow-xl hover:bg-brand-500 transition-all"><Check size={20}/> Guardar y Bloquear Regla</button>
                          </div>
                        )}

                        <div className="space-y-4">
                            {editingProduct.pricingRules?.filter(r => r.isActive !== false).map((r, i) => (
                                <div key={r.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-bottom">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Aplicar a:</label>
                                        <select 
                                          disabled={true}
                                          className="bg-gray-100 p-3 rounded-xl text-[10px] font-black uppercase outline-none cursor-not-allowed opacity-70 shadow-inner" 
                                          value={r.targetId} 
                                          onChange={() => {}}
                                        >
                                            <option value="PARENT">Producto Base</option>
                                            {editingProduct.variants?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 text-center">Cant. Mín</label>
                                            <input 
                                              readOnly={true}
                                              type="number" 
                                              className="bg-gray-100 p-3 rounded-xl font-black text-center cursor-not-allowed opacity-70 shadow-inner" 
                                              value={r.minQuantity} 
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 text-center">Cant. Máx</label>
                                            <input 
                                              readOnly={true}
                                              type="number" 
                                              className="bg-gray-100 p-3 rounded-xl font-black text-center cursor-not-allowed opacity-70 shadow-inner" 
                                              value={r.maxQuantity} 
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 text-center">Nuevo Precio</label>
                                            <input 
                                              readOnly={true}
                                              type="number" 
                                              className="bg-brand-50/50 p-3 rounded-xl font-black text-center text-brand-600 cursor-not-allowed opacity-70 shadow-inner" 
                                              value={r.newPrice} 
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 text-center">Vigencia</label>
                                            <div className="bg-gray-100 p-2.5 rounded-xl text-[8px] font-black uppercase text-slate-500 text-center flex flex-col justify-center leading-tight h-[42px]">
                                                {r.startDate ? (
                                                  <>
                                                    <span className="truncate">DESDE: {new Date(r.startDate).toLocaleDateString()}</span>
                                                    <span className="truncate">{r.endDate ? `HASTA: ${new Date(r.endDate).toLocaleDateString()}` : "INDEFINIDA"}</span>
                                                  </>
                                                ) : "GLOBAL"}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                      onClick={() => handleDeactivateRule(r.id)} 
                                      className="p-3 text-red-300 hover:text-red-500 transition-colors"
                                      title="Desactivar Regla"
                                    >
                                      <Trash2 size={20}/>
                                    </button>
                                </div>
                            ))}
                            {editingProduct.pricingRules?.filter(r => r.isActive !== false).length === 0 && !ruleDraft && (
                                <div className="p-20 text-center text-slate-300 font-black uppercase text-xs">Sin reglas activas</div>
                            )}
                        </div>
                    </div>
                )}

                {prodTab === 'LOG' && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-black text-slate-800 uppercase mb-6 tracking-tighter">Historial de Auditoría</h3>
                        {editingProduct.history?.map(log => (
                            <div key={log.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex items-start gap-4 shadow-sm">
                                <div className={`p-3 rounded-xl ${log.type === 'CREATED' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}><Info size={20}/></div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-black uppercase text-slate-400">{log.type}</span><span className="text-[9px] text-gray-400 font-bold">{new Date(log.timestamp).toLocaleString()}</span></div>
                                    <p className="text-xs font-bold text-slate-700">{log.details}</p>
                                    <div className="mt-2 text-[9px] font-black uppercase text-slate-400">Actor: <span className="text-slate-600">{log.userName}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-8 bg-white border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                <button onClick={() => { if(confirm('¿Desea eliminar permanentemente este producto y todas sus variantes/reglas?')) { deleteProduct(editingProduct.id!); setIsProdModalOpen(false); } }} className="w-full md:w-auto px-8 py-5 bg-red-50 text-red-500 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Eliminar Permanente</button>
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    <button onClick={() => setIsProdModalOpen(false)} className="w-full md:w-auto px-8 py-5 bg-gray-100 text-slate-400 rounded-[2rem] font-black text-[10px] uppercase tracking-widest">Cerrar</button>
                    <button onClick={handleSaveProduct} className="w-full md:w-auto px-14 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-brand-600 transition-all flex items-center justify-center gap-3">Consolidar Ficha <Save size={20}/></button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTOR CATEGORÍAS */}
      {isCatManagerOpen && <CategoryManagerModal />}

      {/* MODAL SCANNER STUB (MANTENIDO) */}
      {showScannerStub && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in zoom-in">
              <div className="bg-white p-12 rounded-[3.5rem] w-full max-sm text-center shadow-2xl">
                  <Barcode size={64} className="mx-auto text-brand-500 mb-6" />
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Simular Lectura</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-8">Teclee el código HID manualmente</p>
                  <input autoFocus className="w-full bg-gray-50 p-6 rounded-3xl font-black text-3xl text-center outline-none border-4 border-transparent focus:border-brand-500 uppercase" value={scannerValue} onChange={e => setScannerValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setEditingProduct(prev => prev ? ({...prev, sku: scannerValue}) : null), setShowScannerStub(false), setScannerValue(''))} />
                  <div className="flex gap-3 mt-6"><button onClick={() => { if(scannerValue.trim()) { setEditingProduct(prev => prev ? ({...prev, sku: scannerValue}) : null); setShowScannerStub(false); setScannerValue(''); } }} className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs">Capturar</button><button onClick={() => setShowScannerStub(false)} className="flex-1 bg-gray-100 text-slate-400 py-5 rounded-2xl font-black uppercase text-xs">X</button></div>
              </div>
          </div>
      )}

      {/* MODAL NUEVO ALMACÉN (MANTENIDO) */}
      {isWhModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] p-12 w-full max-md shadow-2xl animate-in zoom-in">
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter uppercase">Nuevo Depósito</h2>
            <div className="space-y-4">
              <input className="w-full bg-slate-50 border-none p-6 rounded-3xl font-bold outline-none" placeholder="Nombre" value={newWh.name} onChange={e => setNewWh({...newWh, name: e.target.value})} />
              <input className="w-full bg-slate-50 border-none p-6 rounded-3xl font-bold outline-none" placeholder="Ubicación" value={newWh.location} onChange={e => setNewWh({...newWh, location: e.target.value})} />
              <button onClick={() => { if(newWh.name) { addWarehouse({...newWh, id: generateUniqueId()} as Warehouse); setIsWhModalOpen(false); setNewWh({name:'', location:''}); } }} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl mt-6 uppercase tracking-widest text-xs">Registrar Almacén</button>
              <button onClick={() => setIsWhModalOpen(false)} className="w-full text-slate-400 font-black py-4 uppercase tracking-widest text-[10px]">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
