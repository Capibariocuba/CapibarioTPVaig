
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Client, View, Role, PurchaseHistoryItem, ClientGroup, Coupon, Product, BogoOffer } from '../types';
import { 
  User, Phone, Search, Plus, Camera, CreditCard, History, IdCard, Trash2, 
  ArrowUpCircle, Settings, X, Gift, Ticket as TicketIcon, Tag, Lock, Crown, MessageCircle, AlertTriangle, Mail, Calendar, Sparkles, Receipt, Layers, Edit3, Save, Download, EyeOff, CheckCircle, Info, Zap
} from 'lucide-react';

const UpgradePrompt: React.FC<{ plan: string }> = ({ plan }) => (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 text-center animate-in zoom-in duration-300">
        <div className="bg-white/80 backdrop-blur-md p-12 rounded-[4rem] shadow-2xl border border-gray-100 max-w-md">
            <div className="bg-brand-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-brand-600">
                <Crown size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tighter uppercase">Módulo de Marketing</h3>
            <p className="text-slate-500 text-sm font-bold leading-relaxed mb-8 uppercase tracking-widest">Este panel está disponible exclusivamente para licencias <span className="text-brand-600">{plan}</span> o superiores.</p>
            <div className="space-y-3">
                <a 
                    href="https://wa.me/5350019541" 
                    target="_blank" 
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-5 rounded-3xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-100 uppercase tracking-widest text-[10px]"
                >
                    <MessageCircle size={18} /> Solicitar Upgrade
                </a>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Soporte Técnico: +53 50019541</p>
            </div>
        </div>
    </div>
);

// --- UTILIDAD DE GENERACIÓN DE IMAGEN DEL CUPÓN ---
const generateCouponImage = (coupon: Partial<Coupon>, businessName: string): Promise<string> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');

        // Área segura y márgenes
        const paddingLeft = 40;
        const paddingRight = 30;
        const separatorX = 435; // Desplazado de 450 para dar más espacio a la derecha
        const rightColumnX = 455; // Desplazado de 470 para dar más espacio a la derecha
        const maxRightWidth = 600 - rightColumnX - paddingRight;

        // Fondo con degradado
        const grd = ctx.createLinearGradient(0, 0, 600, 300);
        grd.addColorStop(0, "#0ea5e9");
        grd.addColorStop(1, "#0c4a6e");
        ctx.fillStyle = grd;
        ctx.roundRect(0, 0, 600, 300, 40);
        ctx.fill();

        // Círculos de "ticket" (Efecto troquelado)
        ctx.fillStyle = "#f1f5f9";
        ctx.beginPath(); ctx.arc(0, 150, 25, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(600, 150, 25, 0, Math.PI * 2); ctx.fill();

        // Línea punteada separadora
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.moveTo(separatorX, 0); ctx.lineTo(separatorX, 300); ctx.stroke();
        ctx.setLineDash([]);

        // Texto Negocio
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial";
        ctx.fillText(businessName.toUpperCase(), paddingLeft, 50, separatorX - paddingLeft - 20);

        // Valor Descuento
        ctx.font = "black 72px Arial";
        const valText = coupon.type === 'PERCENTAGE' ? `${coupon.value}% OFF` : `$${coupon.value} OFF`;
        ctx.fillText(valText, paddingLeft, 140, separatorX - paddingLeft - 20);

        // Nombre del Cupón
        ctx.font = "bold 20px Arial";
        ctx.fillText(coupon.name?.toUpperCase() || 'CUPÓN DE REGALO', paddingLeft, 180, separatorX - paddingLeft - 20);

        // Código de Cupón
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.roundRect(paddingLeft, 210, 200, 50, 15); ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "black 24px Courier New";
        ctx.fillText(coupon.code || '', paddingLeft + 20, 245, 160);

        // Columna Derecha: Fechas y Reglas
        ctx.font = "bold 10px Arial";
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillText(`VÁLIDO DESDE:`, rightColumnX, 50, maxRightWidth);
        ctx.fillText(`${new Date(coupon.startDate || '').toLocaleDateString()}`, rightColumnX, 65, maxRightWidth);
        
        ctx.fillText(`HASTA:`, rightColumnX, 85, maxRightWidth);
        ctx.fillText(`${new Date(coupon.endDate || '').toLocaleDateString()}`, rightColumnX, 100, maxRightWidth);
        
        ctx.font = "bold 9px Arial";
        const scope = coupon.productIds?.length ? 'PROD. SELECCIONADOS' : 'TODA LA COMPRA';
        ctx.fillText(`ALCANCE:`, rightColumnX, 130, maxRightWidth);
        ctx.fillText(scope, rightColumnX, 142, maxRightWidth);

        if (coupon.minInvoiceAmount) {
            ctx.fillText(`MÍNIMO COMPRA:`, rightColumnX, 165, maxRightWidth);
            ctx.fillText(`$${coupon.minInvoiceAmount}`, rightColumnX, 177, maxRightWidth);
        }
        
        const target = coupon.targetType === 'GENERAL' ? 'TODOS' : coupon.targetType === 'GROUP' ? 'GRUPO CLIENTES' : 'CLIENTE ESPECÍFICO';
        ctx.fillText(`SEGMENTO:`, rightColumnX, 205, maxRightWidth);
        ctx.fillText(target, rightColumnX, 217, maxRightWidth);

        resolve(canvas.toDataURL('image/png'));
    });
};

const GroupManagerModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { clientGroups, addClientGroup, updateClientGroup, deleteClientGroup } = useStore();
    const [newName, setNewName] = useState('');

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in">
            <div className="bg-white rounded-[3rem] w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in h-auto max-h-[80vh]">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                    <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3"><Layers size={24}/> Grupos de Clientes</h2>
                    <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={24}/></button>
                </div>
                <div className="p-8 border-b border-gray-100 bg-gray-50 flex gap-3">
                    <input className="flex-1 bg-white border-2 border-gray-200 p-4 rounded-2xl font-bold uppercase outline-none focus:border-brand-500" placeholder="Nuevo Grupo..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && (addClientGroup(newName), setNewName(''))} />
                    <button onClick={() => { if(newName.trim()) { addClientGroup(newName.trim()); setNewName(''); } }} className="bg-slate-900 text-white px-8 rounded-2xl font-black uppercase text-xs">Añadir</button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-3">
                    {clientGroups.map(group => (
                        <div key={group.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between group">
                            <input className="flex-1 bg-transparent font-black uppercase tracking-tighter outline-none focus:text-brand-600" value={group.name} onChange={e => updateClientGroup(group.id, e.target.value)} disabled={group.id === 'GENERAL'} />
                            {group.id !== 'GENERAL' && (
                                <button onClick={() => deleteClientGroup(group.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const MarketingTab: React.FC = () => {
    const { coupons, addCoupon, updateCoupon, deleteCoupon, bogoOffers, addBogoOffer, updateBogoOffer, deleteBogoOffer, products, clients, clientGroups, businessConfig, notify } = useStore();
    
    // --- ESTADOS CUPONES ---
    const [isCouponFormOpen, setIsCouponFormOpen] = useState(false);
    const [couponDraft, setCouponDraft] = useState<Partial<Coupon>>({
        type: 'PERCENTAGE',
        targetType: 'GENERAL',
        productIds: [],
        value: 0,
        startDate: new Date().toISOString().slice(0, 16),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16),
        usageLimit: 0,
        minInvoiceAmount: 0,
        maxInvoiceAmount: 0,
        isSuspended: false
    });

    // --- ESTADOS BOGO ---
    const [isBogoFormOpen, setIsBogoFormOpen] = useState(false);
    const [isSameProduct, setIsSameProduct] = useState(true);
    const [bogoDraft, setBogoDraft] = useState<Partial<BogoOffer>>({
        buyQty: 1,
        getQty: 1,
        rewardType: 'FREE',
        rewardValue: 0,
        status: 'ACTIVE',
        startAt: new Date().toISOString().slice(0, 16),
        endAt: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 16)
    });

    const handleSaveCoupon = async () => {
        if (!couponDraft.name?.trim()) { notify("El nombre es obligatorio", "error"); return; }
        if (!couponDraft.startDate || !couponDraft.endDate) { notify("Defina las fechas de vigencia", "error"); return; }
        if (new Date(couponDraft.endDate) <= new Date(couponDraft.startDate)) { notify("La fecha de fin debe ser posterior al inicio", "error"); return; }
        if ((couponDraft.value || 0) <= 0) { notify("El valor debe ser mayor a 0", "error"); return; }
        if (couponDraft.type === 'PERCENTAGE' && (couponDraft.value || 0) > 100) { notify("El porcentaje no puede exceder 100%", "error"); return; }
        if (couponDraft.targetType !== 'GENERAL' && !couponDraft.targetId) { notify("Seleccione el destinatario de la segmentación", "error"); return; }

        const code = couponDraft.code || (couponDraft.name.slice(0, 3).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase());
        const imageData = await generateCouponImage({ ...couponDraft, code }, businessConfig.name);

        const finalCoupon: Coupon = {
            id: couponDraft.id || crypto.randomUUID().toUpperCase(),
            code,
            name: couponDraft.name,
            description: couponDraft.description || `Descuento ${couponDraft.name}`,
            type: couponDraft.type as any,
            value: Number(couponDraft.value),
            startDate: couponDraft.startDate,
            endDate: couponDraft.endDate,
            usageLimit: Number(couponDraft.usageLimit) || 0,
            currentUsages: couponDraft.currentUsages || 0,
            targetType: couponDraft.targetType as any,
            targetId: couponDraft.targetId,
            minInvoiceAmount: Number(couponDraft.minInvoiceAmount) || 0,
            maxInvoiceAmount: Number(couponDraft.maxInvoiceAmount) || 0,
            productIds: couponDraft.productIds,
            isSuspended: couponDraft.isSuspended || false,
            imageData
        };

        if (couponDraft.id) updateCoupon(finalCoupon);
        else addCoupon(finalCoupon);

        setIsCouponFormOpen(false);
        setCouponDraft({ type: 'PERCENTAGE', targetType: 'GENERAL', productIds: [], value: 0 });
        notify("Cupón guardado con éxito", "success");
    };

    const handleSaveBogo = () => {
        if (!bogoDraft.name?.trim()) { notify("Nombre de oferta requerido", "error"); return; }
        if (!bogoDraft.buyProductId) { notify("Seleccione producto de compra", "error"); return; }
        if (!bogoDraft.getProductId && !isSameProduct) { notify("Seleccione producto de regalo", "error"); return; }
        if (new Date(bogoDraft.endAt!) <= new Date(bogoDraft.startAt!)) { notify("Rango temporal inválido", "error"); return; }
        if (bogoDraft.rewardType !== 'FREE' && (bogoDraft.rewardValue || 0) <= 0) { notify("Defina el valor del beneficio", "error"); return; }

        const finalGetProductId = isSameProduct ? bogoDraft.buyProductId : bogoDraft.getProductId;

        const finalBogo: BogoOffer = {
            id: bogoDraft.id || crypto.randomUUID().toUpperCase(),
            name: bogoDraft.name,
            startAt: bogoDraft.startAt!,
            endAt: bogoDraft.endAt!,
            status: bogoDraft.status || 'ACTIVE',
            buyProductId: bogoDraft.buyProductId!,
            buyQty: Number(bogoDraft.buyQty) || 1,
            getProductId: finalGetProductId!,
            getQty: Number(bogoDraft.getQty) || 1,
            rewardType: bogoDraft.rewardType as any,
            rewardValue: bogoDraft.rewardType === 'FREE' ? 0 : Number(bogoDraft.rewardValue),
            notes: bogoDraft.notes,
            createdAt: bogoDraft.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (bogoDraft.id) updateBogoOffer(finalBogo);
        else addBogoOffer(finalBogo);

        setIsBogoFormOpen(false);
        setBogoDraft({ buyQty: 1, getQty: 1, rewardType: 'FREE', rewardValue: 0 });
    };

    const handleExport = (c: Coupon) => {
        if (!c.imageData) return;
        const link = document.createElement('a');
        link.download = `CUPON-${c.code}.png`;
        link.href = c.imageData;
        link.click();
    };

    return (
        <div className="animate-in slide-in-from-bottom-6 duration-300 space-y-16">
            {/* SECCIÓN CUPONES */}
            <div className="space-y-8">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3"><TicketIcon className="text-brand-500" size={32}/> Cupones de Fidelidad</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Generación de códigos de descuento manuales</p>
                    </div>
                    <button onClick={() => setIsCouponFormOpen(true)} className="bg-slate-900 text-white px-8 py-4 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center gap-3 shadow-xl hover:bg-brand-600 transition-all">
                        <Plus size={20}/> Crear Cupón
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {coupons.map(c => {
                        const isExpired = new Date(c.endDate) < new Date();
                        const statusLabel = c.isSuspended ? 'Suspendido' : isExpired ? 'Expirado' : 'Activo';
                        const statusColor = c.isSuspended ? 'bg-amber-100 text-amber-600' : isExpired ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600';

                        return (
                            <div key={c.id} className="bg-white rounded-[3rem] p-6 shadow-sm border border-gray-100 flex flex-col group hover:shadow-2xl transition-all relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${statusColor}`}>{statusLabel}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setCouponDraft(c); setIsCouponFormOpen(true); }} className="p-2 bg-gray-50 text-slate-400 hover:text-brand-500 rounded-xl transition-all"><Edit3 size={16}/></button>
                                        <button onClick={() => { if(confirm('¿Eliminar cupón?')) deleteCoupon(c.id); }} className="p-2 bg-red-50 text-red-300 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>

                                <div className="aspect-[2/1] rounded-[2rem] overflow-hidden mb-6 bg-slate-900 shadow-inner relative">
                                    {c.imageData ? (
                                        <img src={c.imageData} className="w-full h-full object-contain" alt="Cupón" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                                            <Gift size={48}/>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                        <button onClick={() => handleExport(c)} className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-2xl transition-all hover:scale-105 active:scale-95"><Download size={14}/> Exportar</button>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-2">
                                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">{c.name}</h3>
                                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <div className="flex items-center gap-1"><TicketIcon size={12}/> {c.code}</div>
                                        <div className="flex items-center gap-1"><Calendar size={12}/> {new Date(c.endDate).toLocaleDateString()}</div>
                                    </div>
                                    <div className="pt-4 border-t border-dashed border-gray-100 flex justify-between items-center">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Usos: {c.currentUsages} / {c.usageLimit || '∞'}</div>
                                        <button onClick={() => updateCoupon({...c, isSuspended: !c.isSuspended})} className={`text-[9px] font-black uppercase tracking-widest ${c.isSuspended ? 'text-emerald-500' : 'text-amber-500'}`}>
                                            {c.isSuspended ? 'Reactivar' : 'Suspender'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SECCIÓN OFERTAS BOGO */}
            <div className="space-y-8">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3"><Zap className="text-amber-500" size={32}/> Ofertas BOGO</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configure dinámicas de "Compre X lleve Y" para su TPV</p>
                    </div>
                    <button onClick={() => { setIsSameProduct(true); setBogoDraft({ buyQty: 1, getQty: 1, rewardType: 'FREE', rewardValue: 0, startAt: new Date().toISOString().slice(0, 16), endAt: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 16) }); setIsBogoFormOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center gap-3 shadow-xl hover:bg-brand-600 transition-all">
                        <Plus size={20}/> Crear BOGO
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {bogoOffers.map(o => {
                        const buyProd = products.find(p => p.id === o.buyProductId);
                        const getProd = products.find(p => p.id === o.getProductId);
                        const isExpired = new Date(o.endAt) < new Date();
                        const statusLabel = o.status === 'SUSPENDED' ? 'Suspendido' : isExpired ? 'Expirado' : 'Activo';
                        const statusColor = o.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-600' : isExpired ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600';

                        return (
                            <div key={o.id} className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100 flex flex-col group hover:shadow-2xl transition-all relative">
                                <div className="flex justify-between items-start mb-6">
                                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${statusColor}`}>{statusLabel}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setBogoDraft(o); setIsSameProduct(o.buyProductId === o.getProductId); setIsBogoFormOpen(true); }} className="p-2 bg-gray-50 text-slate-400 hover:text-brand-500 rounded-xl transition-all"><Edit3 size={16}/></button>
                                        <button onClick={() => { if(confirm('¿Eliminar oferta?')) deleteBogoOffer(o.id); }} className="p-2 bg-red-50 text-red-300 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter line-clamp-1">{o.name}</h3>
                                    <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px]">IN</div>
                                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{o.buyQty}x {buyProd?.name || 'Producto eliminado'}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="bg-brand-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px]">OUT</div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{o.getQty}x {getProd?.name || 'Producto eliminado'}</p>
                                                <p className="text-[9px] font-black text-brand-600 uppercase mt-0.5">
                                                    {o.rewardType === 'FREE' ? '¡TOTALMENTE GRATIS!' : o.rewardType === 'FIXED_PRICE' ? `PRECIO FIJO: $${o.rewardValue}` : `${o.rewardValue}% DE DESCUENTO`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-dashed border-gray-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-1"><Calendar size={12}/> Fin: {new Date(o.endAt).toLocaleDateString()}</div>
                                    <button onClick={() => updateBogoOffer({...o, status: o.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'})} className={o.status === 'ACTIVE' ? 'text-amber-500' : 'text-emerald-500'}>
                                        {o.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {bogoOffers.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-200">
                            <Zap size={80} className="mx-auto mb-4 opacity-20" />
                            <p className="font-black uppercase tracking-widest text-xs">No hay ofertas BOGO activas</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL CUPÓN */}
            {isCouponFormOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
                    <div className="bg-white rounded-[4rem] w-full max-w-4xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in h-auto max-h-[90vh]">
                        <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3"><Gift size={24}/> Configurar Cupón</h2>
                                <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Defina las reglas y el diseño del cupón</p>
                            </div>
                            <button onClick={() => setIsCouponFormOpen(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={24}/></button>
                        </div>
                        <div className="p-8 space-y-8 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Nombre del Cupón *</label>
                                        <input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-brand-500" value={couponDraft.name || ''} onChange={e => setCouponDraft({...couponDraft, name: e.target.value})} placeholder="Ej: VERANO RELÁMPAGO" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Tipo</label>
                                            <select className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-xs uppercase outline-none focus:ring-2 focus:ring-brand-500" value={couponDraft.type} onChange={e => setCouponDraft({...couponDraft, type: e.target.value as any})}>
                                                <option value="PERCENTAGE">Porcentaje %</option>
                                                <option value="FIXED">Monto Fijo $</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Valor *</label>
                                            <input type="number" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none" value={couponDraft.value} onChange={e => setCouponDraft({...couponDraft, value: Number(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Inicio</label>
                                            <input type="datetime-local" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-[10px] outline-none" value={couponDraft.startDate} onChange={e => setCouponDraft({...couponDraft, startDate: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Fin</label>
                                            <input type="datetime-local" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-[10px] outline-none" value={couponDraft.endDate} onChange={e => setCouponDraft({...couponDraft, endDate: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Límite de Usos (0 = Ilimitado)</label>
                                        <input type="number" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none" value={couponDraft.usageLimit} onChange={e => setCouponDraft({...couponDraft, usageLimit: Number(e.target.value)})} />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Segmentación (Target)</label>
                                        <select className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-xs uppercase outline-none" value={couponDraft.targetType} onChange={e => setCouponDraft({...couponDraft, targetType: e.target.value as any, targetId: ''})}>
                                            <option value="GENERAL">Todos los clientes</option>
                                            <option value="GROUP">Grupo de clientes</option>
                                            <option value="CLIENT">Cliente específico</option>
                                        </select>
                                    </div>
                                    {couponDraft.targetType === 'GROUP' && (
                                        <div className="space-y-1 animate-in slide-in-from-top-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Seleccionar Grupo</label>
                                            <select className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-xs uppercase outline-none" value={couponDraft.targetId} onChange={e => setCouponDraft({...couponDraft, targetId: e.target.value})}>
                                                <option value="">Elegir grupo...</option>
                                                {clientGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {couponDraft.targetType === 'CLIENT' && (
                                        <div className="space-y-1 animate-in slide-in-from-top-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Seleccionar Cliente</label>
                                            <select className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-xs uppercase outline-none" value={couponDraft.targetId} onChange={e => setCouponDraft({...couponDraft, targetId: e.target.value})}>
                                                <option value="">Elegir cliente...</option>
                                                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone || 'N/A'})</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Productos Incluidos</label>
                                        <div className="bg-slate-50 rounded-3xl p-4 max-h-[150px] overflow-y-auto space-y-1">
                                            {products.map(p => {
                                                const isSelected = couponDraft.productIds?.includes(p.id);
                                                return (
                                                    <label key={p.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                                                        <input type="checkbox" checked={isSelected} onChange={() => {
                                                            const current = couponDraft.productIds || [];
                                                            const next = isSelected ? current.filter(id => id !== p.id) : [...current, p.id];
                                                            setCouponDraft({...couponDraft, productIds: next});
                                                        }} className="w-4 h-4 accent-brand-500" />
                                                        <span className="text-[10px] font-black uppercase text-slate-700 truncate">{p.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Min. Factura $</label>
                                            <input type="number" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none" value={couponDraft.minInvoiceAmount} onChange={e => setCouponDraft({...couponDraft, minInvoiceAmount: Number(e.target.value)})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Máx. Factura $</label>
                                            <input type="number" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none" value={couponDraft.maxInvoiceAmount} onChange={e => setCouponDraft({...couponDraft, maxInvoiceAmount: Number(e.target.value)})} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                                <button onClick={handleSaveCoupon} className="w-full md:w-auto bg-brand-500 text-slate-900 px-16 py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-xs hover:bg-brand-400 transition-all shadow-xl">Guardar Cupón</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL BOGO */}
            {isBogoFormOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in">
                    <div className="bg-white rounded-[4rem] w-full max-w-4xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in h-auto max-h-[90vh]">
                        <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3"><Zap size={24}/> Configurar Oferta BOGO</h2>
                                <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Dinámica: "Compra Producto X, recibe Producto Y"</p>
                            </div>
                            <button onClick={() => setIsBogoFormOpen(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={24}/></button>
                        </div>
                        <div className="p-8 space-y-8 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {/* COLUMNA IZQ: INFO Y COMPRA */}
                                <div className="space-y-8">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Nombre de la Promoción *</label>
                                        <input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none" value={bogoDraft.name || ''} onChange={e => setBogoDraft({...bogoDraft, name: e.target.value})} placeholder="Ej: MEGA LIQUIDACIÓN CAFETALERA" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Inicio</label>
                                            <input type="datetime-local" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-[10px] outline-none" value={bogoDraft.startAt} onChange={e => setBogoDraft({...bogoDraft, startAt: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Fin</label>
                                            <input type="datetime-local" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-[10px] outline-none" value={bogoDraft.endAt} onChange={e => setBogoDraft({...bogoDraft, endAt: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-gray-100 space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Regla de Compra</h4>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Producto a comprar</label>
                                                <select disabled={!!bogoDraft.id} className="w-full bg-white border-2 border-gray-100 p-4 rounded-2xl font-bold uppercase text-[10px] outline-none" value={bogoDraft.buyProductId} onChange={e => setBogoDraft({...bogoDraft, buyProductId: e.target.value})}>
                                                    <option value="">Seleccionar...</option>
                                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Cantidad necesaria</label>
                                                <input disabled={!!bogoDraft.id} type="number" className="w-full bg-white border-2 border-gray-100 p-4 rounded-2xl font-black text-slate-800 outline-none" value={bogoDraft.buyQty} onChange={e => setBogoDraft({...bogoDraft, buyQty: Number(e.target.value)})} min={1} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* COLUMNA DER: REGALO / BENEFICIO */}
                                <div className="space-y-8">
                                    <div className="bg-brand-50 p-6 rounded-[2.5rem] border border-brand-100 space-y-6">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-[10px] font-black text-brand-700 uppercase tracking-[0.2em] flex items-center gap-2"><Sparkles size={14}/> Regalo / Beneficio</h4>
                                            {!bogoDraft.id && (
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" className="hidden" checked={isSameProduct} onChange={e => { setIsSameProduct(e.target.checked); if(e.target.checked) setBogoDraft({...bogoDraft, getProductId: bogoDraft.buyProductId}); }} />
                                                    <div className={`w-10 h-5 rounded-full p-1 transition-all ${isSameProduct ? 'bg-brand-600' : 'bg-gray-300'}`}>
                                                        <div className={`bg-white w-3 h-3 rounded-full shadow transition-all ${isSameProduct ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                    </div>
                                                    <span className="text-[9px] font-black text-brand-600 uppercase">MISMO PROD.</span>
                                                </label>
                                            )}
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-brand-400 ml-1">Producto de beneficio</label>
                                                <select disabled={!!bogoDraft.id || isSameProduct} className="w-full bg-white border-2 border-brand-100 p-4 rounded-2xl font-bold uppercase text-[10px] outline-none" value={isSameProduct ? bogoDraft.buyProductId : bogoDraft.getProductId} onChange={e => setBogoDraft({...bogoDraft, getProductId: e.target.value})}>
                                                    <option value="">Seleccionar...</option>
                                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black uppercase text-brand-400 ml-1">Cantidad regalo</label>
                                                    <input disabled={!!bogoDraft.id} type="number" className="w-full bg-white border-2 border-brand-100 p-4 rounded-2xl font-black text-slate-800 outline-none" value={bogoDraft.getQty} onChange={e => setBogoDraft({...bogoDraft, getQty: Number(e.target.value)})} min={1} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black uppercase text-brand-400 ml-1">Tipo beneficio</label>
                                                    <select disabled={!!bogoDraft.id} className="w-full bg-white border-2 border-brand-100 p-4 rounded-2xl text-[9px] font-black uppercase outline-none" value={bogoDraft.rewardType} onChange={e => setBogoDraft({...bogoDraft, rewardType: e.target.value as any})}>
                                                        <option value="FREE">Gratis (100%)</option>
                                                        <option value="PERCENT_DISCOUNT">% Descuento</option>
                                                        <option value="FIXED_PRICE">Precio Fijo $</option>
                                                    </select>
                                                </div>
                                            </div>
                                            {bogoDraft.rewardType !== 'FREE' && (
                                                <div className="space-y-1 animate-in slide-in-from-top-2">
                                                    <label className="text-[9px] font-black uppercase text-brand-400 ml-1">Valor del beneficio ({bogoDraft.rewardType === 'FIXED_PRICE' ? '$' : '%'})</label>
                                                    <input disabled={!!bogoDraft.id} type="number" className="w-full bg-white border-2 border-brand-100 p-4 rounded-2xl font-black text-brand-600 outline-none" value={bogoDraft.rewardValue} onChange={e => setBogoDraft({...bogoDraft, rewardValue: Number(e.target.value)})} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-4 tracking-widest">Notas internas</label>
                                        <textarea className="w-full bg-slate-50 border-none p-5 rounded-3xl font-bold text-slate-700 outline-none min-h-[100px]" value={bogoDraft.notes || ''} onChange={e => setBogoDraft({...bogoDraft, notes: e.target.value})} placeholder="Detalles de la campaña..." />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-8 border-t border-gray-100">
                                <button onClick={handleSaveBogo} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-xl hover:bg-brand-600 transition-all uppercase tracking-[0.2em] text-xs">
                                    {bogoDraft.id ? 'Guardar Cambios Permitidos' : 'Activar Oferta BOGO'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const Clients: React.FC = () => {
  const { 
    clients, addClient, updateClient, deleteClient, 
    addClientCredit, deductClientCredit,
    checkModuleAccess, businessConfig, notify, clientGroups, coupons
  } = useStore();
  
  const isRestricted = !checkModuleAccess(View.CLIENTS);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<Partial<Client>>({});
  const [mainTab, setMainTab] = useState<'LIST' | 'MARKETING'>('LIST');
  const [creditAmount, setCreditAmount] = useState<string>('');

  const filteredClients = useMemo(() => clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone || '').includes(search) ||
    (c.ci || '').includes(search)
  ), [clients, search]);

  const activeClient = useMemo(() => 
    clients.find(c => c.id === editingClient.id) || editingClient as Client
  , [clients, editingClient.id, editingClient]);

  // Lógica de cupones aplicables al perfil activo
  const applicableCouponsForActiveClient = useMemo(() => {
    if (!activeClient.id) return [];
    return coupons.filter(c => {
        const isGeneral = c.targetType === 'GENERAL';
        const isTargetedGroup = c.targetType === 'GROUP' && c.targetId === activeClient.groupId;
        const isTargetedClient = c.targetType === 'CLIENT' && c.targetId === activeClient.id;
        return isGeneral || isTargetedGroup || isTargetedClient;
    });
  }, [coupons, activeClient.id, activeClient.groupId]);

  const handleCIChange = (ci: string) => {
    const numericCI = ci.replace(/\D/g, '');
    
    // Si tiene 11 dígitos, intentamos extraer la fecha
    if (numericCI.length === 11) {
      const yy = numericCI.substring(0, 2);
      const mm = numericCI.substring(2, 4);
      const dd = numericCI.substring(4, 6);
      
      const yearNum = parseInt(yy);
      const monthNum = parseInt(mm);
      const dayNum = parseInt(dd);
      
      // Aplicar regla de siglo: YY <= 40 -> 2000, YY > 40 -> 1900
      const year = (yearNum <= 40 ? 2000 : 1900) + yearNum;
      
      // Validar fecha básica
      const date = new Date(year, monthNum - 1, dayNum);
      const isValidDate = date.getFullYear() === year && 
                          date.getMonth() === monthNum - 1 && 
                          date.getDate() === dayNum;
      
      if (isValidDate) {
        const birthdayStr = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        setEditingClient(prev => ({ 
          ...prev, 
          ci: numericCI,
          birthday: birthdayStr
        }));
        return;
      } else {
        notify("Carnet de Identidad con fecha inválida", "error");
      }
    }
    
    setEditingClient(prev => ({ ...prev, ci: numericCI }));
  };

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    if (!input.startsWith('+53')) {
      const digits = input.replace(/\D/g, '');
      setEditingClient(prev => ({ ...prev, phone: '+53' + digits }));
    } else {
      const local = input.substring(3).replace(/\D/g, '');
      setEditingClient(prev => ({ ...prev, phone: '+53' + local }));
    }
  };

  const handleSave = () => {
    if (!editingClient.name?.trim()) { notify('Nombre obligatorio', 'error'); return; }
    const finalData = { ...editingClient, groupId: editingClient.groupId || 'GENERAL' };
    if (editingClient.id) updateClient(finalData as Client);
    else addClient(finalData as Client);
    setIsModalOpen(false);
  };

  const openEditModal = (client: Partial<Client>) => {
    setEditingClient({ ...client, phone: client.phone || '+53', groupId: client.groupId || 'GENERAL' });
    setIsModalOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 524288) { notify("Máx 512KB", "error"); return; }
      const reader = new FileReader();
      reader.onloadend = () => { setEditingClient(prev => ({ ...prev, photo: reader.result as string })); };
      reader.readAsDataURL(file);
    }
  };

  // Fix: Added missing credit handlers
  const handleAddCredit = () => {
    const amt = parseFloat(creditAmount);
    if (!amt || amt <= 0 || !activeClient.id) return;
    addClientCredit(activeClient.id, amt, "Recarga manual");
    setCreditAmount('');
  };

  const handleDeductCredit = () => {
    const amt = parseFloat(creditAmount);
    if (!amt || amt <= 0 || !activeClient.id) return;
    deductClientCredit(activeClient.id, amt, "Deducción manual");
    setCreditAmount('');
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 h-full overflow-y-auto relative animate-in fade-in duration-500">
      {isRestricted && <div className="absolute inset-0 z-40 backdrop-blur-md bg-white/40"></div>}
      {isRestricted && <UpgradePrompt plan="SAPPHIRE" />}

      <div className={`transition-all duration-500 ${isRestricted ? 'blur-sm pointer-events-none grayscale opacity-30 select-none' : ''}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 text-slate-900">
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Clientes y Marketing</h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Fidelización, Segmentación y CRM</p>
            </div>
            
            <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-gray-100 w-full md:w-auto">
                <button onClick={() => setMainTab('LIST')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mainTab === 'LIST' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Clientes</button>
                <button onClick={() => setMainTab('MARKETING')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mainTab === 'MARKETING' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Marketing</button>
            </div>
          </div>

          {mainTab === 'LIST' ? (
            <div className="animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border border-gray-100 flex-1 flex gap-4 items-center w-full">
                        <Search className="text-gray-300" size={24} />
                        <input className="flex-1 outline-none bg-transparent font-bold text-slate-700 placeholder:text-gray-300 text-sm" placeholder="Buscar por CI, nombre o móvil..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => setIsGroupManagerOpen(true)} className="flex-1 md:flex-none bg-white border border-gray-100 text-slate-600 px-6 py-4 rounded-3xl flex gap-2 items-center justify-center hover:bg-gray-50 transition-all font-black uppercase text-[10px] tracking-widest shadow-sm">
                            <Layers size={18}/> Grupos
                        </button>
                        <button onClick={() => { setEditingClient({ phone: '+53', groupId: 'GENERAL' }); setIsModalOpen(true); }} className="flex-[2] md:flex-none bg-slate-900 text-white px-10 py-5 rounded-3xl flex gap-3 items-center hover:bg-brand-600 shadow-xl transition-all font-black uppercase text-xs tracking-widest">
                            <Plus size={20} /> Nuevo Cliente
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredClients.map((client) => {
                        const groupName = clientGroups.find(g => g.id === client.groupId)?.name || 'General';
                        return (
                            <div key={client.id} className="bg-white rounded-[3rem] border border-gray-100 hover:shadow-2xl transition-all p-3 group relative flex flex-col items-center text-center">
                                <div className="p-6 w-full">
                                    <div className="w-24 h-24 rounded-[2rem] bg-gray-50 flex-shrink-0 overflow-hidden mb-5 mx-auto ring-4 ring-white shadow-xl">
                                        {client.photo ? <img src={client.photo} alt={client.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-200 bg-gray-50"><User size={48} /></div>}
                                    </div>
                                    <h3 className="font-black text-slate-800 text-lg mb-1 truncate w-full tracking-tighter uppercase">{client.name}</h3>
                                    <div className="text-[9px] font-black text-brand-500 uppercase tracking-widest mb-1">{groupName}</div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-center gap-2"><Phone size={12}/> {client.phone || 'SIN TELÉFONO'}</p>
                                    
                                    <div className="w-full py-4 px-5 rounded-[1.8rem] mb-6 bg-emerald-50">
                                        <div className="text-[10px] font-black uppercase tracking-tighter text-emerald-600">Saldo Crédito</div>
                                        <div className="font-black text-2xl text-emerald-700">${(client.creditBalance || 0).toFixed(2)}</div>
                                    </div>

                                    <button onClick={() => { setEditingClient(client); setIsProfileOpen(true); }} className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-colors shadow-lg">Ver Ficha</button>
                                </div>
                            </div>
                        );
                    })}
                    {filteredClients.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-xs">No se encontraron clientes</div>
                    )}
                </div>
            </div>
          ) : (
            <MarketingTab />
          )}
      </div>

      {/* MODAL GESTIÓN DE GRUPOS */}
      {isGroupManagerOpen && <GroupManagerModal onClose={() => setIsGroupManagerOpen(false)} />}

      {/* MODAL EDICIÓN/REGISTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[120] p-4 animate-in fade-in">
            <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in h-auto max-h-[90dvh]">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <h2 className="text-2xl font-black uppercase tracking-tighter">{editingClient.id ? 'Editar Cliente' : 'Registro de Cliente'}</h2>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={24}/></button>
                </div>
                <div className="p-8 space-y-8 overflow-y-auto">
                    <div className="flex flex-col items-center">
                        <div className="w-32 h-32 rounded-[2.5rem] bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden mb-4 relative group">
                            {editingClient.photo ? <img src={editingClient.photo} alt="Avatar" className="w-full h-full object-cover" /> : <User size={48} className="text-slate-200" />}
                            <label className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                                <Camera className="text-white" size={24} />
                                <input type="file" className="hidden" onChange={handlePhotoChange} />
                            </label>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto de Identificación</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Nombre Completo *</label>
                            <div className="relative">
                                <User className="absolute left-4 top-4 text-slate-300" size={18} />
                                <input className="w-full bg-slate-50 border-none p-4 pl-12 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={editingClient.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} placeholder="Ej: Juan Pérez" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Carnet de Identidad</label>
                            <div className="relative">
                                <IdCard className="absolute left-4 top-4 text-slate-300" size={18} />
                                <input className="w-full bg-slate-50 border-none p-4 pl-12 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={editingClient.ci || ''} onChange={e => handleCIChange(e.target.value)} placeholder="11 dígitos" maxLength={11} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Grupo de Cliente</label>
                            <div className="relative">
                                <Layers className="absolute left-4 top-4 text-slate-300" size={18} />
                                <select 
                                    className="w-full bg-slate-50 border-none p-4 pl-12 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
                                    value={editingClient.groupId || 'GENERAL'}
                                    onChange={e => setEditingClient({...editingClient, groupId: e.target.value})}
                                >
                                    {clientGroups.map(group => (
                                        <option key={group.id} value={group.id}>{group.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Teléfono Móvil</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-4 text-slate-300" size={18} />
                                <input className="w-full bg-slate-50 border-none p-4 pl-12 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={editingClient.phone || '+53'} onChange={handlePhoneInput} placeholder="+53" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Fecha de Nacimiento</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-4 text-slate-300" size={18} />
                                <input type="date" className="w-full bg-slate-50 border-none p-4 pl-12 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={editingClient.birthday || ''} onChange={e => setEditingClient({...editingClient, birthday: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Correo Electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-4 text-slate-300" size={18} />
                                <input className="w-full bg-slate-50 border-none p-4 pl-12 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-500" value={editingClient.email || ''} onChange={e => setEditingClient({...editingClient, email: e.target.value})} placeholder="usuario@ejemplo.com" />
                            </div>
                        </div>
                    </div>
                    
                    <button onClick={handleSave} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-xl hover:bg-brand-600 transition-all uppercase tracking-[0.2em] text-xs">
                        Consolidar Registro
                    </button>
                    {editingClient.id && (
                        <button onClick={() => { if(confirm('¿Eliminar definitivamente?')) deleteClient(editingClient.id!); setIsModalOpen(false); }} className="w-full text-red-500 font-black py-2 uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 mt-4"><Trash2 size={14}/> Eliminar Cliente</button>
                    )}
                </div>
            </div>
        </div>
      )}

      {isProfileOpen && editingClient.id && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[110] flex items-end md:items-center justify-center p-0 md:p-10 animate-in fade-in">
              <div className="bg-white md:rounded-[4rem] w-full max-w-6xl h-full md:h-[90vh] flex flex-col md:flex-row shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in">
                  <div className="w-full md:w-80 bg-slate-900 text-white p-8 flex flex-col items-center shrink-0">
                      <div className="relative mb-6">
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] md:rounded-[3rem] bg-white/10 overflow-hidden shadow-2xl border-4 border-slate-800">
                           {activeClient.photo ? <img src={activeClient.photo} className="w-full h-full object-cover" /> : <User size={64} className="m-auto mt-6 text-slate-700" />}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-brand-500 text-white p-2 md:p-3 rounded-xl md:rounded-2xl shadow-lg border-4 border-slate-900"><IdCard size={18}/></div>
                      </div>
                      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-center mb-1">{activeClient.name}</h2>
                      <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-6 md:mb-10">{activeClient.ci || 'SIN IDENTIFICACIÓN'}</p>

                      <div className="w-full space-y-4 hidden md:block">
                          <div className="p-5 bg-white/5 rounded-3xl border border-white/5">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Móvil</p>
                              <p className="font-bold text-sm">{activeClient.phone || 'N/A'}</p>
                          </div>
                          <div className="p-5 bg-white/5 rounded-3xl border border-white/5">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nacimiento</p>
                              <p className="font-bold text-sm">{activeClient.birthday || 'N/A'}</p>
                          </div>
                          <div className="p-5 bg-white/5 rounded-3xl border border-white/5">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Email</p>
                              <p className="font-bold text-xs truncate">{activeClient.email || 'N/A'}</p>
                          </div>
                          <div className="p-5 bg-white/5 rounded-3xl border border-white/5">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Grupo</p>
                              <p className="font-bold text-sm uppercase">{clientGroups.find(g => g.id === activeClient.groupId)?.name || 'General'}</p>
                          </div>
                      </div>

                      <div className="mt-auto pt-6 md:pt-10 w-full flex flex-col gap-3">
                        <button onClick={() => openEditModal(activeClient)} className="w-full bg-white/10 hover:bg-white text-white hover:text-slate-900 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Editar Perfil</button>
                        <button onClick={() => setIsProfileOpen(false)} className="w-full bg-slate-800 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cerrar</button>
                      </div>
                  </div>

                  <div className="flex-1 bg-gray-50 overflow-y-auto p-6 md:p-12">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
                          <div className="space-y-6">
                              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] shadow-sm border border-gray-100 relative overflow-hidden">
                                  <div className="absolute -top-10 -right-10 text-brand-500 opacity-10 rotate-12"><CreditCard size={200}/></div>
                                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><CreditCard size={14}/> Línea de Crédito</h3>
                                  <div className="text-center py-4 md:py-6">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Saldo en {businessConfig.primaryCurrency}</p>
                                      <h4 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">${(activeClient.creditBalance || 0).toFixed(2)}</h4>
                                  </div>
                                  <div className="border-t border-dashed border-gray-100 pt-6 md:pt-8 mt-4 space-y-4">
                                      <div className="flex gap-2 md:gap-3 items-center flex-nowrap">
                                          <input type="number" className="flex-1 min-w-0 bg-gray-50 border-none p-4 md:p-5 rounded-2xl font-black text-lg md:text-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.00" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} />
                                          <div className="flex gap-1 md:gap-2 shrink-0">
                                              <button onClick={handleAddCredit} className="bg-emerald-500 text-white p-4 md:p-5 rounded-2xl shadow-lg hover:bg-emerald-600 transition-all active:scale-95"><Plus size={24}/></button>
                                              <button onClick={handleDeductCredit} className="bg-red-50 text-white p-4 md:p-5 rounded-2xl shadow-lg hover:bg-red-600 transition-all active:scale-95"><Minus size={24}/></button>
                                          </div>
                                      </div>
                                  </div>
                              </div>

                              {/* PANEL DE CUPONES DEL CLIENTE */}
                              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] shadow-sm border border-gray-100 flex flex-col h-auto">
                                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Gift size={14}/> Cupones Disponibles</h3>
                                  <div className="space-y-3">
                                      {applicableCouponsForActiveClient.map(coupon => {
                                          const isExpired = new Date(coupon.endDate) < new Date();
                                          const usedByClient = activeClient.usageHistory?.[coupon.id] || 0;
                                          const remaining = Math.max(0, coupon.usageLimit > 0 ? coupon.usageLimit - usedByClient : Infinity);
                                          const isOutOfUses = coupon.usageLimit > 0 && remaining === 0;

                                          return (
                                              <div key={coupon.id} className={`p-4 rounded-2xl border transition-all ${coupon.isSuspended || isExpired || isOutOfUses ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-brand-100 shadow-sm'}`}>
                                                  <div className="flex justify-between items-start mb-2">
                                                      <div>
                                                          <h4 className="text-xs font-black text-slate-800 uppercase truncate">{coupon.name}</h4>
                                                          <p className="text-[9px] font-bold text-brand-500">{coupon.type === 'PERCENTAGE' ? `${coupon.value}% OFF` : `$${coupon.value} OFF`}</p>
                                                      </div>
                                                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${coupon.isSuspended ? 'bg-amber-100 text-amber-600' : isExpired ? 'bg-red-100 text-red-600' : isOutOfUses ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>
                                                          {coupon.isSuspended ? 'Suspendido' : isExpired ? 'Expirado' : isOutOfUses ? 'Agotado' : 'Activo'}
                                                      </span>
                                                  </div>
                                                  <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase border-t border-dashed border-gray-100 pt-2">
                                                      <span>Usos: {usedByClient} / {coupon.usageLimit > 0 ? coupon.usageLimit : '∞'}</span>
                                                      <span className={remaining <= 2 && remaining > 0 ? 'text-amber-500' : ''}>Quedan: {remaining === Infinity ? '∞' : remaining}</span>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                      {applicableCouponsForActiveClient.length === 0 && (
                                          <p className="text-[10px] text-gray-400 italic text-center py-4 uppercase font-bold">Sin cupones asignados</p>
                                      )}
                                  </div>
                              </div>
                          </div>
                          <div className="space-y-6">
                              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] shadow-sm border border-gray-100 flex flex-col h-auto max-h-[50vh] md:max-h-none">
                                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Receipt size={14}/> Historial de Compras</h3>
                                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                      {activeClient.purchaseHistory?.map((item: PurchaseHistoryItem) => (
                                          <div key={item.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between group hover:bg-white hover:border-brand-100 transition-all">
                                              <div>
                                                  <div className="text-xs font-black text-slate-800 uppercase tracking-tighter mb-1">VENTA {item.saleId.slice(-6)}</div>
                                                  <div className="text-[9px] font-bold text-slate-400 uppercase">{new Date(item.timestamp).toLocaleDateString()}</div>
                                              </div>
                                              <div className="text-right">
                                                  <div className="font-black text-slate-900">${item.total.toFixed(2)}</div>
                                                  <div className="text-[9px] font-black text-brand-500 uppercase">{item.currency}</div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const Minus: React.FC<{ size?: number }> = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);
