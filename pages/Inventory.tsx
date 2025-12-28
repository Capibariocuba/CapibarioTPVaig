import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Warehouse, Product, ProductVariant, PricingRule, AuditLog, LicenseTier, Category } from '../types';
import { 
  Plus, MapPin, Lock, X, AlertTriangle, Edit3, Save, Package, Tag, Layers, Search, 
  Camera, Barcode, Trash2, History, ChevronRight, Calculator, Calendar, Info, ShieldAlert,
  ArrowRight, DollarSign, List, Sparkles, Zap, Crown, ChevronDown, ChevronUp, Check, EyeOff, Eye, Square, CheckSquare,
  Truck, ArrowUpRight
} from 'lucide-react';

const COLORS = ['#0ea5e9', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#64748b', '#000000'];

// UTILIDAD DE GENERACIÓN DE IDS ÚNICOS E IRREPETIBLES (FASE B)
const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toUpperCase();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
};

// UTILIDAD DE COLOR PARA VARIANTES
const generateVariantColor = () => {
  const variantColors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
  return variantColors[Math.floor(Math.random() * variantColors.length)];
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
  
  // --- LÓGICA DE ENTRADA DE STOCK (NUEVO) ---
  const [isStockEntryModalOpen, setIsStockEntryModalOpen] = useState(false);
  const [stockEntryTarget, setStockEntryTarget] = useState<'PARENT' | string | null>(null);
  const [stockEntryData, setStockEntryData] = useState({ qty: 1, unitCost: 0, supplier: '', note: '' });

  // Borrador de Regla de Precio (Flujo 2 pasos)
  const [ruleDraft, setRuleDraft] = useState<PricingRule | null>(null);

  // Selección Masiva y Filtros
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);

  const activeWarehouse = useMemo(() => warehouses.find(w => w.id === activeWarehouseId) || warehouses[0], [activeWarehouseId, warehouses]);
  const activeWhIndex = useMemo(() => warehouses.findIndex(w => w.id === activeWarehouseId), [activeWarehouseId, warehouses]);
  const isWhLocked = isItemLocked('WAREHOUSES', activeWhIndex);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.warehouseId === activeWarehouseId && (showHidden || !p.hidden));
  }, [products, activeWarehouseId, showHidden]);

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
    // MIGRACIÓN DE COLOR EN VARIANTES AL ABRIR
    const clone: Product = JSON.parse(JSON.stringify(p));
    if (clone.variants) {
      clone.variants = clone.variants.map(v => ({
        ...v,
        color: v.color || generateVariantColor()
      }));
    }
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

  // --- HANDLER DE ENTRADA DE STOCK (NUEVO) ---
  const handleOpenStockEntry = (target: 'PARENT' | string, currentCost: number) => {
    setStockEntryTarget(target);
    setStockEntryData({ qty: 1, unitCost: currentCost, supplier: '', note: '' });
    setIsStockEntryModalOpen(true);
  };

  const handleConfirmStockEntry = () => {
    const { qty, unitCost, supplier, note } = stockEntryData;
    if (qty <= 0 || unitCost <= 0) {
      notify("Cantidad y costo deben ser mayores a 0", "error");
      return;
    }

    const actorName = currentUser?.name || 'Sistema';
    const timestamp = new Date().toISOString();

    setEditingProduct(prev => {
        if (!prev) return null;
        
        let updatedStock = prev.stock;
        let updatedVariants = prev.variants || [];
        let entityType: 'PRODUCT' | 'VARIANT' = 'PRODUCT';
        let entityId = prev.id;
        let targetLabel = 'Producto Base';

        if (stockEntryTarget === 'PARENT') {
            updatedStock += qty;
        } else {
            const vIndex = updatedVariants.findIndex(v => v.id === stockEntryTarget);
            if (vIndex !== -1) {
                entityType = 'VARIANT';
                entityId = updatedVariants[vIndex].id;
                targetLabel = `Variante: ${updatedVariants[vIndex].name}`;
                const newV = { ...updatedVariants[vIndex], stock: (updatedVariants[vIndex].stock || 0) + qty };
                updatedVariants = [...updatedVariants];
                updatedVariants[vIndex] = newV;
            }
        }

        const logEntry: AuditLog = {
            id: generateUniqueId(),
            timestamp,
            type: 'STOCK_ADJUST',
            userName: actorName,
            details: `Entrada de stock (${targetLabel}): +${qty} uds @ $${unitCost.toFixed(2)}. Prov: ${supplier || 'N/A'}. Nota: ${note || 'N/A'}`,
            entityType,
            entityId,
            details_raw: {
                after: {
                    target: stockEntryTarget === 'PARENT' ? 'PRODUCT' : 'VARIANT',
                    targetId: entityId,
                    parentProductId: prev.id,
                    qty,
                    unitCost,
                    supplier: supplier || null,
                    note: note || null,
                    warehouseId: prev.warehouseId
                }
            }
        };

        return {
            ...prev,
            stock: updatedStock,
            variants: updatedVariants,
            history: [logEntry, ...(prev.history || [])]
        };
    });

    setIsStockEntryModalOpen(false);
    notify("Entrada registrada. Pulse 'Consolidar' para finalizar.", "success");
  };

  const handleSaveProduct = () => {
    if (!editingProduct?.name || (editingProduct.cost || 0) < 0) {
      notify("Nombre y costo (>=0) obligatorios", "error");
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

  // ACCIONES MASIVAS - FIX REAL
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`¿Eliminar definitivamente ${selectedIds.length} productos seleccionados?`)) return;
    
    // Ejecutar borrado individual en bucle aprovechando el prev state del context
    selectedIds.forEach(id => {
      deleteProduct(id);
    });
    
    setSelectedIds([]);
    notify(`${selectedIds.length} productos eliminados`, "success");
  };

  const handleBulkHide = () => {
    selectedIds.forEach(id => {
      const p = products.find(prod => prod.id === id);
      if (p) updateProduct({...p, hidden: !p.hidden});
    });
    setSelectedIds([]);
    notify("Estatus de visibilidad actualizado", "success");
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) setSelectedIds([]);
    else setSelectedIds(filteredProducts.map(p => p.id));
  };

  const toggleProductSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // ADICIÓN DE VARIANTE: Log descriptivo, HERENCIA DE COSTO y COLOR AUTO
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
        sku: '',
        color: generateVariantColor() // ASIGNACIÓN AUTOMÁTICA DE COLOR
    };
    
    const newLog: AuditLog = {
      id: generateUniqueId(),
      timestamp: new Date().toISOString(),
      type: 'VARIANT_ADDED',
      userName: currentUser?.name || 'Sistema',
      details: `Variante creada: ${newVName} (ID: ${newVId.slice(-4)}) con color asignado`,
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
        const qtyOverlap = Math.max(min, r.minQuantity) <= Math.min(max, r.maxQuantity);
        if (!qtyOverlap) return false;
        if (!startDate && !endDate && !r.startDate && !r.endDate) return true;
        if (!startDate && !endDate) return true;
        if (!r.startDate && !r.endDate) return true;
        const startA = startDate ? new Date(startDate).getTime() : 0;
        const endA = endDate ? new Date(endDate).getTime() : Infinity;
        const startB = r.startDate ? new Date(r.startDate).getTime() : 0;
        const endB = r.endDate ? new Date(r.endDate).getTime() : Infinity;
        const timeOverlap = Math.max(startA, startB) <= Math.min(endA, endB);
        return timeOverlap;
      });
  };

  const handleOpenRuleDraft = () => {
    if (!editingProduct) return;
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

  const handleSaveRuleDraft = () => {
    if (!editingProduct || !ruleDraft) return;
    if (ruleDraft.minQuantity < 1) { notify("Cantidad mínima debe ser >= 1", "error"); return; }
    if (ruleDraft.maxQuantity < ruleDraft.minQuantity) { notify("Máx debe ser >= Mín", "error"); return; }
    if (ruleDraft.newPrice <= 0) { notify("Precio debe ser mayor a 0", "error"); return; }
    if (ruleDraft.endDate && !ruleDraft.startDate) { notify("Defina fecha de inicio si tiene fecha de fin", "error"); return; }
    if (ruleDraft.startDate && ruleDraft.endDate && new Date(ruleDraft.endDate) <= new Date(ruleDraft.startDate)) {
        notify("La fecha de fin debe ser posterior a la de inicio", "error"); return;
    }
    if (checkRuleOverlap(ruleDraft.minQuantity, ruleDraft.maxQuantity, ruleDraft.targetId, editingProduct.pricingRules, ruleDraft.startDate, ruleDraft.endDate)) {
        notify("Conflicto: El rango de cantidad y tiempo se solapa con una regla activa.", "error"); return;
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
    notify("Regla configurada", "success");
  };

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
    notify("Regla desactivada", "success");
  };

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
                        {/* FIX COLOR PICKER: stopPropagation evita que se cierre el modal al clicar el selector nativo */}
                        <div className="w-8 h-8 rounded-full flex-shrink-0 shadow-inner cursor-pointer relative" style={{ backgroundColor: cat.color }} onClick={(e) => e.stopPropagation()}>
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
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          filter: invert(0.5);
          cursor: pointer;
          opacity: 1;
          display: block;
        }
      `}</style>
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
                <Layers size={16} /> Categorías
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
            <button key={w.id} onClick={() => { setActiveWarehouseId(w.id); setSelectedIds([]); }} className={`px-8 py-4 rounded-t-3xl font-black text-[11px] uppercase tracking-[0.1em] transition-all flex items-center gap-3 whitespace-nowrap relative ${active ? 'bg-white text-brand-600 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.1)] border-t-4 border-brand-500' : 'bg-transparent text-slate-400 hover:text-slate-600'}`}>
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
                            <button onClick={() => setShowHidden(!showHidden)} className={`p-2 transition-all rounded-lg ${showHidden ? 'bg-slate-900 text-white shadow-md' : 'text-slate-300 hover:text-brand-500'}`} title={showHidden ? 'Ocultar inactivos' : 'Ver inactivos'}>
                              {showHidden ? <Eye size={18}/> : <EyeOff size={18}/>}
                            </button>
                        </div>
                    </div>
                )}
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={12} /> {activeWarehouse?.location || 'General'}</p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
                {selectedIds.length > 0 && (
                  <div className="flex gap-2 animate-in zoom-in">
                      <button onClick={handleBulkHide} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
                        <EyeOff size={16}/> Ocultar
                      </button>
                      <button onClick={handleBulkDelete} className="bg-red-50 text-red-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2">
                        <Trash2 size={16}/> Eliminar
                      </button>
                  </div>
                )}
                <button onClick={handleOpenNewProduct} className="flex-1 md:flex-none bg-brand-500 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-brand-600 transition-all flex items-center justify-center gap-3"><Package size={20} /> Crear</button>
            </div>
        </div>

        <div className="overflow-x-auto -mx-6 md:-mx-10">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-y border-gray-100">
                    <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                        <th className="px-6 py-5 text-center w-14">
                           <button onClick={toggleSelectAll} className="text-slate-300 hover:text-brand-500 transition-colors">
                              {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={18}/> : <Square size={18}/>}
                           </button>
                        </th>
                        <th className="px-4 py-5">Producto / SKU</th>
                        <th className="px-6 py-5">Categorías</th>
                        <th className="px-6 py-5">Venta</th>
                        <th className="px-6 py-5 text-right">Stock Total</th>
                        <th className="px-10 py-5 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {filteredProducts.map(p => {
                        const totalStock = computeTotalStock(p);
                        const isSelected = selectedIds.includes(p.id);
                        return (
                        <tr key={p.id} className={`group transition-colors ${isSelected ? 'bg-brand-50/50' : 'hover:bg-gray-50/50'} ${p.hidden ? 'opacity-50 grayscale italic' : ''}`}>
                            <td className="px-6 py-6 text-center">
                                <button onClick={() => toggleProductSelect(p.id)} className={`transition-colors ${isSelected ? 'text-brand-600' : 'text-slate-200 group-hover:text-slate-400'}`}>
                                   {isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}
                                </button>
                            </td>
                            <td className="px-4 py-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shadow-inner flex-shrink-0 relative">
                                      {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package className="w-full h-full p-2 text-gray-300" />}
                                      {p.hidden && <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white"><EyeOff size={14}/></div>}
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-800 uppercase tracking-tighter text-sm flex items-center gap-2">
                                          {p.name}
                                          {p.hidden && <span className="text-[8px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase">Oculto</span>}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-300 font-mono">{p.sku || 'SIN SKU'}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-6">
                                <div className="flex flex-wrap gap-1">
                                    {p.categories?.map(cName => {
                                        const cObj = categories.find(c => c.name === cName);
                                        return <span key={cName} className="px-2 py-0.5 rounded text-[8px] font-black uppercase text-white shadow-sm" style={{ backgroundColor: cObj?.color || '#64748b' }}>{cName}</span>;
                                    })}
                                </div>
                            </td>
                            <td className="px-6 py-6 font-black text-brand-600 text-sm">${p.price.toFixed(2)}</td>
                            <td className={`px-6 py-6 text-right font-black text-lg tracking-tighter ${totalStock <= (p.minStockAlert || 5) ? 'text-red-500' : 'text-slate-800'}`}>{totalStock}</td>
                            <td className="px-10 py-6 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenEditProduct(p)} className="p-3 text-slate-400 hover:text-brand-600 bg-gray-50 rounded-xl transition-all"><Edit3 size={18}/></button>
                                    <button onClick={() => { if(confirm('¿Eliminar producto?')) deleteProduct(p.id); }} className="p-3 text-red-300 hover:text-red-500 bg-red-50/50 rounded-xl transition-all"><Trash2 size={18}/></button>
                                </div>
                            </td>
                        </tr>
                    )})}
                    {filteredProducts.length === 0 && <tr><td colSpan={6} className="py-32 text-center text-gray-300 font-black uppercase text-xs">Sin registros que mostrar</td></tr>}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODAL FICHA PRODUCTO */}
      {isProdModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[100] p-0 md:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-none md:rounded-[4rem] w-full max-w-5xl h-full md:h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in">
            <div className="p-4 md:p-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3 md:gap-5">
                    <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] bg-white/10 flex items-center justify-center text-brand-400 shadow-xl"><Package size={24}/></div>
                    <div>
                        <h2 className="text-xl md:text-3xl font-black tracking-tighter uppercase leading-none">Ficha de Producto</h2>
                        <p className="text-[8px] md:text-[10px] font-black text-brand-400 uppercase tracking-widest mt-1">ID: {editingProduct.id.slice(-8)}</p>
                    </div>
                </div>
                <button onClick={() => setIsProdModalOpen(false)} className="p-3 md:p-4 bg-white/10 hover:bg-white/20 rounded-xl md:rounded-2xl transition-all"><X size={20}/></button>
            </div>

            <div className="flex bg-slate-100 p-1 md:p-2 gap-1 md:gap-2 flex-shrink-0">
                {[
                    { id: 'DETAILS', label: 'Info', icon: List },
                    { id: 'VARIANTS', label: 'Variantes', icon: Layers, locked: tier === 'GOLD' },
                    { id: 'RULES', label: 'Precios', icon: DollarSign },
                    { id: 'LOG', label: 'Log', icon: History }
                ].map(t => (
                    <button key={t.id} onClick={() => setProdTab(t.id as any)} className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-3 py-2 md:py-4 rounded-xl md:rounded-2xl font-black text-[8px] md:text-[10px] uppercase tracking-widest transition-all ${prodTab === t.id ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                        <t.icon size={14}/> <span>{t.label}</span> {t.locked && <Lock size={10} className="text-amber-500" />}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50/50">
                {prodTab === 'DETAILS' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-4 flex flex-col items-center">
                            <div className="w-full aspect-square bg-white rounded-[3rem] border-4 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group mb-6 shadow-inner">
                                {editingProduct.image ? <img src={editingProduct.image} className="w-full h-full object-cover" /> : <div className="text-center p-8"><Camera className="mx-auto text-gray-200 mb-2" size={48}/><p className="text-[10px] font-black uppercase text-gray-300">Foto</p></div>}
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
                                <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">Nombre *</label><input className="w-full bg-white border-2 border-gray-100 p-5 rounded-3xl font-black text-slate-800 text-lg outline-none focus:border-brand-500" value={editingProduct.name} onChange={e => setEditingProduct(prev => prev ? ({...prev, name: e.target.value}) : null)} placeholder="Ej: Café Serrano" /></div>
                                <div className="space-y-1 relative"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">SKU / Barcode</label><div className="relative"><input className="w-full bg-white border-2 border-gray-100 p-5 pr-14 rounded-3xl font-bold outline-none uppercase" value={editingProduct.sku} onChange={e => setEditingProduct(prev => prev ? ({...prev, sku: e.target.value}) : null)} placeholder="Escanear..." /><button onClick={() => setShowScannerStub(true)} className="absolute right-4 top-4 text-brand-500"><Barcode size={24}/></button></div></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">Vencimiento</label><div className="relative"><Calendar className="absolute left-5 top-5 text-gray-300" size={20}/><input type="date" className="w-full bg-white border-2 border-gray-100 p-5 pl-14 rounded-3xl font-bold outline-none" value={editingProduct.expiryDate} onChange={e => setEditingProduct(prev => prev ? ({...prev, expiryDate: e.target.value}) : null)} /></div></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">Costo *</label><div className="relative"><DollarSign className="absolute left-5 top-5 text-gray-300" size={20}/><input type="number" className="w-full bg-white border-2 border-gray-100 p-5 pl-14 rounded-3xl font-black text-xl" value={editingProduct.cost} onChange={e => setEditingProduct(prev => prev ? ({...prev, cost: parseFloat(e.target.value) || 0}) : null)} /></div></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-4">Venta *</label><div className="relative"><DollarSign className="absolute left-5 top-5 text-brand-300" size={20}/><input type="number" className="w-full bg-white border-2 border-gray-100 p-5 pl-14 rounded-3xl font-black text-xl text-brand-600" value={editingProduct.price} onChange={e => setEditingProduct(prev => prev ? ({...prev, price: parseFloat(e.target.value) || 0}) : null)} /></div></div>
                                
                                <div className="md:col-span-2 bg-slate-900 p-6 rounded-[2.5rem] flex items-center justify-between border-b-4 border-brand-500 shadow-xl">
                                    <div>
                                        <p className="text-[9px] font-black text-brand-400 uppercase tracking-[0.2em] mb-1">Rentabilidad</p>
                                        <h5 className="text-white font-black text-2xl tracking-tighter">
                                            {editingProduct.cost > 0 
                                                ? `${(((editingProduct.price - editingProduct.cost) / editingProduct.cost) * 100).toFixed(1)}% Ganancia`
                                                : 'Defina costo'}
                                        </h5>
                                    </div>
                                    <div className="p-4 bg-white/10 rounded-2xl text-brand-400 shadow-inner"><Calculator size={28}/></div>
                                </div>

                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4">Stock en Almacén Activo *</label>
                                    <div className="flex gap-3 items-center">
                                        <div className="relative flex-1">
                                            <Package className="absolute left-6 top-6 text-gray-300" size={28}/>
                                            <input type="number" className="w-full bg-gray-100 border-none p-7 pl-20 rounded-[2.5rem] font-black text-3xl text-slate-800 outline-none" value={editingProduct.stock} onChange={e => setEditingProduct(prev => prev ? ({...prev, stock: parseInt(e.target.value) || 0}) : null)} />
                                        </div>
                                        <button 
                                            onClick={() => handleOpenStockEntry('PARENT', editingProduct.cost)} 
                                            className="bg-brand-500 text-white p-6 rounded-[2rem] shadow-lg hover:bg-brand-600 transition-all flex flex-col items-center justify-center gap-1"
                                            title="Entrada Formal de Stock"
                                        >
                                            <ArrowUpRight size={24} />
                                            <span className="text-[8px] font-black uppercase">Entrada</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {prodTab === 'VARIANTS' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-8">
                            <div><h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Variantes</h3><p className="text-[10px] text-slate-400 font-bold uppercase">Sub-productos con costo/precio propio</p></div>
                            <button onClick={addVariant} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-xl hover:bg-brand-600 transition-all"><Plus size={16}/> Añadir</button>
                        </div>
                        {tier === 'GOLD' ? (
                          <div className="bg-amber-50 p-16 rounded-[4rem] text-center border-2 border-dashed border-amber-200"><Lock size={48} className="mx-auto text-amber-500 mb-6" /><h4 className="text-xl font-black text-amber-600 uppercase">Variantes Bloqueadas</h4><p className="text-[10px] text-amber-500 font-bold uppercase mt-2">Requiere Plan Sapphire+</p></div>
                        ) : (
                          <div className="space-y-4">
                            {editingProduct.variants?.map((v, i) => (
                              <div key={v.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 flex flex-col md:flex-row items-center gap-4 md:gap-6 animate-in slide-in-from-left">
                                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex-shrink-0 overflow-hidden relative group">
                                  {v.image ? <img src={v.image} className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ backgroundColor: v.color || '#eee' }}></div>}
                                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera size={18} className="text-white"/><input type="file" className="hidden" onChange={e => handleImageUpload(e, v.id)}/></label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 flex-1 w-full">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase px-1">Nombre</label>
                                    <input className="bg-gray-50 p-3 rounded-xl font-bold text-xs uppercase" placeholder="Nombre" value={v.name} onChange={e => setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.map((vr, idx) => idx === i ? {...vr, name: e.target.value} : vr)}) : null)} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase px-1">SKU</label>
                                    <input className="bg-gray-50 p-3 rounded-xl font-bold text-xs" placeholder="SKU" value={v.sku} onChange={e => setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.map((vr, idx) => idx === i ? {...vr, sku: e.target.value} : vr)}) : null)} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase px-1">Costo</label>
                                    <input type="number" className="bg-gray-50 p-3 rounded-xl font-black text-xs text-slate-600" value={v.cost} onChange={e => setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.map((vr, idx) => idx === i ? {...vr, cost: parseFloat(e.target.value) || 0} : vr)}) : null)} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-brand-400 uppercase px-1">Venta</label>
                                    <input type="number" className="bg-brand-50/50 p-3 rounded-xl font-black text-xs text-brand-600" value={v.price} onChange={e => setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.map((vr, idx) => idx === i ? {...vr, price: parseFloat(e.target.value) || 0} : vr)}) : null)} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase px-1">Stock</label>
                                    <div className="flex gap-1">
                                      <input type="number" className="flex-1 min-w-0 bg-slate-900 p-3 rounded-xl font-black text-xs text-white" value={v.stock} onChange={e => setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.map((vr, idx) => idx === i ? {...vr, stock: parseInt(e.target.value) || 0} : vr)}) : null)} />
                                      <button 
                                        onClick={() => handleOpenStockEntry(v.id, v.cost)} 
                                        className="bg-brand-500 text-white p-2.5 rounded-xl hover:bg-brand-600 transition-all"
                                        title="Entrada Formal de Stock"
                                      >
                                        <ArrowUpRight size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-end pb-1">
                                      <button onClick={() => { if(confirm('¿Eliminar variante?')) setEditingProduct(prev => prev ? ({...prev, variants: prev.variants.filter((_, idx) => idx !== i)}) : null); }} className="w-full p-3 text-red-400 bg-red-50 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 text-[8px] font-black uppercase">
                                          <Trash2 size={16}/> Borrar
                                      </button>
                                  </div>
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
                            <div><h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Reglas de Precio</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Escalado por volumen (Temporales)</p></div>
                            {!ruleDraft && (
                              <button onClick={handleOpenRuleDraft} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-brand-600 transition-all shadow-xl"><Plus size={16}/> Nueva</button>
                            )}
                        </div>

                        {ruleDraft && (
                          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-brand-500 shadow-xl animate-in zoom-in space-y-6 mb-10">
                              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                  <h4 className="text-[10px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-2"><Edit3 size={14}/> Borrador</h4>
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
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Mín</label>
                                      <input type="number" className="bg-gray-50 p-4 rounded-2xl font-black text-center outline-none focus:ring-2 focus:ring-brand-500" value={ruleDraft.minQuantity} onChange={e => setRuleDraft({...ruleDraft, minQuantity: parseInt(e.target.value) || 0})} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Máx</label>
                                      <input type="number" className="bg-gray-50 p-4 rounded-2xl font-black text-center outline-none focus:ring-2 focus:ring-brand-500" value={ruleDraft.maxQuantity} onChange={e => setRuleDraft({...ruleDraft, maxQuantity: parseInt(e.target.value) || 0})} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Precio Unitario</label>
                                      <input type="number" className="bg-brand-50 p-4 rounded-2xl font-black text-center text-brand-600 outline-none focus:ring-2 focus:ring-brand-500" value={ruleDraft.newPrice} onChange={e => setRuleDraft({...ruleDraft, newPrice: parseFloat(e.target.value) || 0})} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Inicio</label>
                                      <input type="datetime-local" className="bg-gray-50 p-4 rounded-2xl font-black text-[10px] text-center outline-none" value={ruleDraft.startDate} onChange={e => setRuleDraft({...ruleDraft, startDate: e.target.value})} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black uppercase text-slate-400 text-center">Fin</label>
                                      <input type="datetime-local" className="bg-gray-50 p-4 rounded-2xl font-black text-[10px] text-center outline-none" value={ruleDraft.endDate} onChange={e => setRuleDraft({...ruleDraft, endDate: e.target.value})} />
                                  </div>
                              </div>
                              <button onClick={handleSaveRuleDraft} className="w-full bg-brand-600 text-white font-black py-5 rounded-3xl flex items-center justify-center gap-3 uppercase text-xs tracking-widest shadow-xl hover:bg-brand-500 transition-all"><Check size={20}/> Bloquear Regla</button>
                          </div>
                        )}

                        <div className="space-y-4">
                            {editingProduct.pricingRules?.filter(r => r.isActive !== false).map((r, i) => (
                                <div key={r.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-bottom">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Aplicar a:</label>
                                        <select disabled className="bg-gray-100 p-3 rounded-xl text-[10px] font-black uppercase outline-none opacity-70 shadow-inner" value={r.targetId}>
                                            <option value="PARENT">Base</option>
                                            {editingProduct.variants?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 text-center">Mín</label>
                                            <input readOnly className="bg-gray-100 p-3 rounded-xl font-black text-center opacity-70 shadow-inner" value={r.minQuantity} />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 text-center">Máx</label>
                                            <input readOnly className="bg-gray-100 p-3 rounded-xl font-black text-center opacity-70 shadow-inner" value={r.maxQuantity} />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 text-center">Precio</label>
                                            <input readOnly className="bg-brand-50/50 p-3 rounded-xl font-black text-center text-brand-600 opacity-70 shadow-inner" value={r.newPrice} />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 text-center">Vigencia</label>
                                            <div className="bg-gray-100 p-2.5 rounded-xl text-[8px] font-black uppercase text-slate-500 text-center flex flex-col justify-center leading-tight h-[42px]">
                                                {r.startDate ? (
                                                  <>
                                                    <span className="truncate">{new Date(r.startDate).toLocaleDateString()}</span>
                                                    <span className="truncate">{r.endDate ? new Date(r.endDate).toLocaleDateString() : "INF"}</span>
                                                  </>
                                                ) : "GLOBAL"}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeactivateRule(r.id)} className="p-3 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {prodTab === 'LOG' && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-black text-slate-800 uppercase mb-6 tracking-tighter">Historial de Auditoría</h3>
                        {editingProduct.history?.map(log => (
                            <div key={log.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex items-start gap-4 shadow-sm">
                                <div className={`p-3 rounded-xl ${log.type === 'CREATED' ? 'bg-emerald-50 text-emerald-600' : log.type === 'STOCK_ADJUST' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {log.type === 'STOCK_ADJUST' ? <Truck size={20}/> : <Info size={20}/>}
                                </div>
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

            <div className="p-4 md:p-8 bg-white border-t border-gray-100 flex flex-row justify-between items-center gap-2 flex-shrink-0">
                {/* BOTÓN ELIMINAR FICHA: Fix para asegurar cierre y borrado real */}
                <button onClick={() => { if(confirm('¿Eliminar producto definitivamente?')) { deleteProduct(editingProduct.id); setIsProdModalOpen(false); setEditingProduct(null); notify("Producto eliminado con éxito", "success"); } }} className="flex-1 md:flex-none px-4 md:px-8 py-3 md:py-5 bg-red-50 text-red-500 rounded-[2rem] font-black text-[8px] md:text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Eliminar</button>
                <div className="flex flex-row gap-2 flex-1 md:flex-none justify-end">
                    <button onClick={() => setIsProdModalOpen(false)} className="flex-1 md:flex-none px-4 md:px-8 py-3 md:py-5 bg-gray-100 text-slate-400 rounded-[2rem] font-black text-[8px] md:text-[10px] uppercase tracking-widest">Cerrar</button>
                    <button onClick={handleSaveProduct} className="flex-1 md:flex-none px-6 md:px-14 py-3 md:py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[8px] md:text-[10px] uppercase tracking-widest md:tracking-[0.2em] shadow-2xl hover:bg-brand-600 transition-all flex items-center justify-center gap-2">Consolidar <Save size={16}/></button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ENTRADA DE STOCK (NUEVO) */}
      {isStockEntryModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[250] p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-lg shadow-2xl animate-in zoom-in space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                  <Truck className="text-brand-500" size={24}/> Reaprovisionamiento
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {stockEntryTarget === 'PARENT' ? editingProduct.name : `Variante: ${editingProduct.variants.find(v => v.id === stockEntryTarget)?.name}`}
                </p>
              </div>
              <button onClick={() => setIsStockEntryModalOpen(false)} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all"><X size={20}/></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase pl-2">Cantidad *</label>
                <input 
                  type="number" 
                  autoFocus
                  className="w-full bg-gray-50 border-2 border-transparent p-4 rounded-2xl font-black text-xl text-slate-800 outline-none focus:border-brand-500" 
                  value={stockEntryData.qty} 
                  onChange={e => setStockEntryData({...stockEntryData, qty: parseInt(e.target.value) || 0})}
                  min={1}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase pl-2">Costo Unit. *</label>
                <input 
                  type="number" 
                  className="w-full bg-gray-50 border-2 border-transparent p-4 rounded-2xl font-black text-xl text-brand-600 outline-none focus:border-brand-500" 
                  value={stockEntryData.unitCost} 
                  onChange={e => setStockEntryData({...stockEntryData, unitCost: parseFloat(e.target.value) || 0})}
                  min={0.01}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase pl-2">Proveedor</label>
                <input 
                  className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold text-slate-700 outline-none" 
                  placeholder="Ej: Distribuidora Central" 
                  value={stockEntryData.supplier} 
                  onChange={e => setStockEntryData({...stockEntryData, supplier: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase pl-2">Notas / Motivo</label>
                <textarea 
                  className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold text-slate-700 outline-none h-24 resize-none" 
                  placeholder="Observaciones de la entrada..." 
                  value={stockEntryData.note} 
                  onChange={e => setStockEntryData({...stockEntryData, note: e.target.value})}
                />
              </div>
            </div>

            <button 
              onClick={handleConfirmStockEntry} 
              className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-xl hover:bg-brand-600 transition-all uppercase tracking-widest text-xs"
            >
              Registrar Entrada de Stock
            </button>
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
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Lectura Manual</h3>
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
              <button onClick={() => { if(newWh.name) { addWarehouse({...newWh, id: generateUniqueId()} as Warehouse); setIsWhModalOpen(false); setNewWh({name:'', location:''}); } }} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl mt-6 uppercase tracking-widest text-xs">Registrar</button>
              <button onClick={() => setIsWhModalOpen(false)} className="w-full text-slate-400 font-black py-4 uppercase tracking-widest text-[10px]">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};