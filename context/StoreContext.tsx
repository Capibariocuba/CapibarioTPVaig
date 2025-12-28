
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  StoreContextType, View, CurrencyConfig, LedgerEntry, User, 
  BusinessConfig, Coupon, BogoOffer, Offer, Role, Product, Client, ClientGroup, Ticket, Sale, Warehouse, LicenseTier, POSStoreTerminal, Category, PaymentDetail, PurchaseHistoryItem, Shift, Refund, RefundItem
} from '../types';
import { MOCK_USERS, DEFAULT_BUSINESS_CONFIG, CATEGORIES as DEFAULT_CATEGORIES } from '../constants';
import { PermissionEngine } from '../security/PermissionEngine';
import { AlertCircle, CheckCircle } from 'lucide-react';

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toUpperCase();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
};

const hashPin = async (pin: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(pin + "capibario-tpv-salt"); 
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const DEFAULT_CURRENCIES: CurrencyConfig[] = [
  { code: 'CUP', symbol: '₱', rate: 1, allowedPaymentMethods: ['CASH', 'TRANSFER'], isBase: true },
  { code: 'USD', symbol: '$', rate: 330, allowedPaymentMethods: ['CASH', 'TRANSFER', 'CARD'] },
  { code: 'EUR', symbol: '€', rate: 340, allowedPaymentMethods: ['CASH', 'TRANSFER'] }
];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view, setView] = useState<View>(View.POS);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved && saved !== 'null' ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState<User[]>(() => JSON.parse(localStorage.getItem('users') || "[]"));
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig>(() => JSON.parse(localStorage.getItem('businessConfig') || JSON.stringify(DEFAULT_BUSINESS_CONFIG)));
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>(() => {
    const saved = localStorage.getItem('currencies');
    if (saved && saved !== '[]') return JSON.parse(saved);
    return DEFAULT_CURRENCIES;
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => {
    const saved = JSON.parse(localStorage.getItem('warehouses') || '[]');
    if (saved.length === 0) return [{ id: 'wh-default', name: 'Almacén por defecto', location: 'Principal' }];
    return saved;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('categories_v2');
    if (saved) return JSON.parse(saved);
    const oldStrings = JSON.parse(localStorage.getItem('categories') || '[]');
    const merged = Array.from(new Set(['Catálogo', ...DEFAULT_CATEGORIES.filter(c => c !== 'Todo'), ...oldStrings]));
    return merged.map(name => ({ id: generateUniqueId(), name, color: name === 'Catálogo' ? '#0ea5e9' : '#64748b' }));
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = JSON.parse(localStorage.getItem('products') || '[]');
    return saved.map((p: any) => ({
      ...p,
      id: p.id || generateUniqueId(),
      categories: p.categories || [p.category || 'Catálogo'],
      variants: (p.variants || []).map((v: any) => ({ ...v, id: v.id || ('VAR-' + generateUniqueId()) })),
      pricingRules: p.pricingRules || [],
      history: p.history || [],
      warehouseId: p.warehouseId || 'wh-default'
    }));
  });

  const [ledger, setLedger] = useState<LedgerEntry[]>(() => JSON.parse(localStorage.getItem('ledger') || '[]'));
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(localStorage.getItem('sales') || '[]'));
  
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>(() => {
    const saved = JSON.parse(localStorage.getItem('clientGroups') || '[]');
    if (saved.length === 0) {
      return [{ id: 'GENERAL', name: 'General', color: '#64748b', createdAt: new Date().toISOString() }];
    }
    return saved;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = JSON.parse(localStorage.getItem('clients') || '[]');
    return saved.map((c: any) => ({
      ...c,
      id: c.id || generateUniqueId(),
      groupId: c.groupId || 'GENERAL',
      creditBalance: Number(c.creditBalance ?? c.balance ?? 0),
      balance: Number(c.creditBalance ?? c.balance ?? 0),
      purchaseHistory: c.purchaseHistory || [],
      updatedAt: c.updatedAt || new Date().toISOString(),
      createdAt: c.createdAt || new Date().toISOString()
    }));
  });

  const [coupons, setCoupons] = useState<Coupon[]>(() => JSON.parse(localStorage.getItem('coupons') || '[]'));
  const [bogoOffers, setBogoOffers] = useState<BogoOffer[]>(() => JSON.parse(localStorage.getItem('bogoOffers') || '[]'));
  const [offers, setOffers] = useState<Offer[]>(() => JSON.parse(localStorage.getItem('offers') || '[]'));
  
  const [posCurrency, setPosCurrency] = useState('CUP');
  const [activeShift, setActiveShift] = useState<Shift | null>(() => {
    const saved = localStorage.getItem('activeShift');
    return saved ? JSON.parse(saved) : null;
  });
  const [cart, setCart] = useState<any[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [activePosTerminalId, setActivePosTerminalId] = useState<string | null>(() => {
    const saved = localStorage.getItem('activePosTerminalId');
    return saved || businessConfig.posTerminals?.[0]?.id || null;
  });

  const notify = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const getCurrentTier = useCallback((): LicenseTier => (businessConfig.license?.tier || 'GOLD') as LicenseTier, [businessConfig.license]);

  useEffect(() => {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('businessConfig', JSON.stringify(businessConfig));
    localStorage.setItem('currencies', JSON.stringify(currencies));
    localStorage.setItem('warehouses', JSON.stringify(warehouses));
    localStorage.setItem('categories_v2', JSON.stringify(categories));
    localStorage.setItem('products', JSON.stringify(products));
    localStorage.setItem('sales', JSON.stringify(sales));
    localStorage.setItem('ledger', JSON.stringify(ledger));
    localStorage.setItem('clients', JSON.stringify(clients));
    localStorage.setItem('clientGroups', JSON.stringify(clientGroups));
    localStorage.setItem('coupons', JSON.stringify(coupons));
    localStorage.setItem('bogoOffers', JSON.stringify(bogoOffers));
    localStorage.setItem('offers', JSON.stringify(offers));
    localStorage.setItem('activeShift', JSON.stringify(activeShift));
    if (activePosTerminalId) localStorage.setItem('activePosTerminalId', activePosTerminalId);
  }, [currentUser, users, businessConfig, currencies, warehouses, categories, products, sales, ledger, clients, clientGroups, coupons, bogoOffers, offers, activeShift, activePosTerminalId]);

  const convertCurrency = useCallback((amount: number, from: string, to: string) => {
    const fromRate = currencies.find(c => c.code === from)?.rate || 1;
    const toRate = currencies.find(c => c.code === to)?.rate || 1;
    const inBase = amount * fromRate;
    return inBase / toRate;
  }, [currencies]);

  const processSale = useCallback((saleData: any): Ticket | null => {
    const { items, total, payments, currency, note, appliedCouponId } = saleData;
    const activeTerminal = businessConfig.posTerminals?.find(t => t.id === activePosTerminalId);
    const warehouseId = activeTerminal?.warehouseId || 'wh-default';

    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      if (!product) continue;
      if (item.selectedVariantId) {
        const variant = product.variants.find(v => v.id === item.selectedVariantId);
        if (!variant || (variant.stock || 0) < item.quantity) {
          notify(`Stock insuficiente para variante de ${product.name}`, "error");
          return null;
        }
      } else {
        if ((product.stock || 0) < item.quantity) {
          notify(`Stock insuficiente para ${product.name}`, "error");
          return null;
        }
      }
    }

    const totalPaidInSaleCurrency = payments.reduce((acc: number, p: any) => acc + p.amount, 0);
    const overpay = totalPaidInSaleCurrency - total;
    const changeInCUP = overpay > 0.01 ? convertCurrency(overpay, currency, 'CUP') : 0;

    const updatedProducts = products.map(p => {
      const cartItem = items.find((i: any) => i.id === p.id);
      if (!cartItem) return p;
      const newP = { ...p };
      if (cartItem.selectedVariantId) {
        newP.variants = newP.variants.map(v => 
          v.id === cartItem.selectedVariantId ? { ...v, stock: (v.stock || 0) - cartItem.quantity } : v
        );
      } else {
        newP.stock = (newP.stock || 0) - cartItem.quantity;
      }
      newP.history = [{
        id: generateUniqueId(),
        timestamp: new Date().toISOString(),
        type: 'STOCK_ADJUST',
        userName: currentUser?.name || 'Sistema',
        details: `Venta: -${cartItem.quantity} unidades`
      }, ...(newP.history || [])];
      return newP;
    });
    setProducts(updatedProducts);

    let finalRemainingCredit: number | undefined = undefined;

    const newLedgerEntries: LedgerEntry[] = [];
    const txId = generateUniqueId();
    payments.forEach((p: PaymentDetail) => {
      newLedgerEntries.push({
        id: generateUniqueId(),
        timestamp: new Date().toISOString(),
        type: 'SALE',
        direction: 'IN',
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.method,
        userId: currentUser?.id || '',
        userName: currentUser?.name || '',
        description: `Venta ${txId.slice(-6)}`,
        txId
      });

      // Lógica de descuento de crédito
      if (p.method === 'CREDIT' && selectedClientId) {
        const rate = currencies.find(c => c.code === p.currency)?.rate || 1;
        const amountInCUP = p.currency === 'CUP' ? p.amount : p.amount * rate;
        
        // Buscamos el saldo actual para calcular el final
        const currentClient = clients.find(cl => cl.id === selectedClientId);
        if (currentClient) {
          finalRemainingCredit = Math.max(0, (currentClient.creditBalance || 0) - amountInCUP);
        }

        setClients(prev => prev.map(c => c.id === selectedClientId ? { 
          ...c, 
          creditBalance: Math.max(0, (c.creditBalance || 0) - amountInCUP),
          balance: Math.max(0, (c.creditBalance || 0) - amountInCUP),
          updatedAt: new Date().toISOString() 
        } : c));
      }
    });

    if (changeInCUP > 0) {
      newLedgerEntries.push({
        id: generateUniqueId(),
        timestamp: new Date().toISOString(),
        type: 'EXCHANGE',
        direction: 'OUT',
        amount: changeInCUP,
        currency: 'CUP',
        paymentMethod: 'CASH',
        userId: currentUser?.id || '',
        userName: currentUser?.name || '',
        description: `Cambio Venta ${txId.slice(-6)}`,
        txId
      });
    }
    setLedger(prev => [...prev, ...newLedgerEntries]);

    const finalTicket: Ticket = {
      id: txId,
      items,
      subtotal: saleData.subtotal,
      discount: saleData.discount,
      total,
      payments,
      currency,
      note,
      appliedCouponId,
      clientId: selectedClientId || undefined,
      sellerName: currentUser?.name || 'Sistema',
      clientRemainingCredit: finalRemainingCredit,
      timestamp: new Date().toISOString()
    };

    setSales(prev => [...prev, { ...finalTicket, shiftId: activeShift?.id || 'NO-SHIFT', date: new Date().toISOString() }]);
    
    // Vincular historial al cliente
    if (selectedClientId) {
      const historyItem: PurchaseHistoryItem = {
        id: generateUniqueId(),
        saleId: txId,
        timestamp: finalTicket.timestamp,
        total,
        currency,
        itemsCount: items.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0)
      };
      setClients(prev => prev.map(c => c.id === selectedClientId ? { ...c, purchaseHistory: [historyItem, ...(c.purchaseHistory || [])], updatedAt: new Date().toISOString() } : c));
    }
    
    notify("Venta procesada con éxito", "success");
    setSelectedClientId(null);
    return finalTicket;
  }, [products, businessConfig, activePosTerminalId, activeShift, currentUser, convertCurrency, notify, selectedClientId, currencies, clients]);

  const processRefund = useCallback((saleId: string, refundItems: RefundItem[], authUser: User): boolean => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return false;

    const totalRefundCUP = refundItems.reduce((acc, item) => acc + item.amountCUP, 0);
    const timestamp = new Date().toISOString();
    const refundId = generateUniqueId();

    // 1. Reversión de Stock
    const updatedProducts = products.map(p => {
      const itemsToRefund = refundItems.filter(ri => ri.cartId.startsWith(p.id));
      if (itemsToRefund.length === 0) return p;

      const newP = { ...p };
      itemsToRefund.forEach(ri => {
        const cartItemInSale = sale.items.find(si => si.cartId === ri.cartId);
        if (!cartItemInSale) return;

        if (cartItemInSale.selectedVariantId) {
          newP.variants = newP.variants.map(v => 
            v.id === cartItemInSale.selectedVariantId ? { ...v, stock: (v.stock || 0) + ri.qty } : v
          );
        } else {
          newP.stock = (newP.stock || 0) + ri.qty;
        }

        newP.history = [{
          id: generateUniqueId(),
          timestamp,
          type: 'REFUND_RESTOCK',
          userName: authUser.name,
          details: `Reembolso Ticket ${saleId.slice(-6)}: +${ri.qty} unidades`,
          entityType: cartItemInSale.selectedVariantId ? 'VARIANT' : 'PRODUCT',
          entityId: cartItemInSale.selectedVariantId || p.id
        }, ...(newP.history || [])];
      });
      return newP;
    });

    // 2. Salida Contable (Ledger)
    const newLedgerEntry: LedgerEntry = {
      id: generateUniqueId(),
      timestamp,
      type: 'REFUND',
      direction: 'OUT',
      amount: totalRefundCUP,
      currency: 'CUP',
      paymentMethod: 'CASH',
      userId: authUser.id,
      userName: authUser.name,
      description: `Reembolso Ticket ${saleId.slice(-6)}`,
      txId: refundId
    };

    // 3. Actualizar Saldo de Cliente si fue con Crédito
    if (sale.payments.some(p => p.method === 'CREDIT') && sale.clientId) {
        // En esta versión simplificada devolvemos a CUP por defecto o saldo si aplica
        // Para cumplir la regla "salida contable en CUP", lo registramos como salida de caja CUP.
    }

    // Actualizar estados
    setProducts(updatedProducts);
    setLedger(prev => [...prev, newLedgerEntry]);
    
    // Fix: Explicitly assign totalRefundCUP to totalCUP shorthand property which referred to an inexistent variable.
    const newRefund: Refund = {
        id: refundId,
        timestamp,
        shiftId: activeShift?.id || 'NO-SHIFT',
        authorizedBy: authUser.name,
        items: refundItems,
        totalCUP: totalRefundCUP,
        method: 'CUP'
    };

    setSales(prev => prev.map(s => s.id === saleId ? {
        ...s,
        refunds: [...(s.refunds || []), newRefund]
    } : s));

    notify(`Reembolso procesado: -$${totalRefundCUP.toFixed(2)} CUP`, "success");
    return true;
  }, [sales, products, activeShift, notify]);

  const login = async (pin: string): Promise<boolean> => {
    const hashed = await hashPin(pin);
    const u = users.find(u => u.pin === hashed);
    if (u) { setCurrentUser(u); return true; }
    notify("PIN Incorrecto", "error");
    return false;
  };

  const validatePin = async (pin: string): Promise<User | null> => {
    const hashed = await hashPin(pin);
    return users.find(u => u.pin === hashed) || null;
  };

  const logout = useCallback(() => {
    setCurrentUser(null);
    setView(View.POS);
    localStorage.removeItem('currentUser');
  }, []);

  const updateUserPin = useCallback(async (userId: string, newPin: string) => {
    if (!userId || newPin.length !== 4) return;
    
    const weakPins = ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'];
    if (weakPins.includes(newPin)) {
      notify("PIN demasiado débil", "error");
      return;
    }

    const hashed = await hashPin(newPin);
    
    // Validación de unicidad
    if (users.some(u => u.id !== userId && u.pin === hashed)) {
      notify("PIN ya está siendo utilizado por otro operador", "error");
      return;
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, pin: hashed } : u));
    notify("PIN actualizado correctamente", "success");
  }, [users, notify]);

  const addClientCredit = useCallback((clientId: string, amount: number, reason: string = "Recarga de crédito") => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, creditBalance: (c.creditBalance || 0) + amount, balance: (c.creditBalance || 0) + amount, updatedAt: new Date().toISOString() } : c));
    notify(`Crédito añadido: +$${amount.toFixed(2)}`, 'success');
  }, [notify]);

  const deductClientCredit = useCallback((clientId: string, amount: number, reason: string = "Deducción de crédito") => {
    const client = clients.find(c => c.id === clientId);
    if (!client || (client.creditBalance || 0) < amount) {
      notify('Saldo de crédito insuficiente', 'error');
      return false;
    }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, creditBalance: (c.creditBalance || 0) - amount, balance: (c.creditBalance || 0) - amount, updatedAt: new Date().toISOString() } : c));
    notify(`Crédito deducido: -$${amount.toFixed(2)}`, 'success');
    return true;
  }, [clients, notify]);

  const addClientGroup = useCallback((name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (clientGroups.some(g => g.name.toLowerCase() === trimmedName.toLowerCase())) {
      notify("Ya existe un grupo con ese nombre.", "error");
      return;
    }
    const newGroup: ClientGroup = {
      id: generateUniqueId(),
      name: trimmedName,
      color: '#64748b',
      createdAt: new Date().toISOString()
    };
    setClientGroups(prev => [...prev, newGroup]);
    notify("Grupo creado con éxito.", "success");
  }, [clientGroups, notify]);

  const updateClientGroup = useCallback((id: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName || id === 'GENERAL') return;
    if (clientGroups.some(g => g.id !== id && g.name.toLowerCase() === trimmedName.toLowerCase())) {
      notify("Ya existe otro grupo con ese nombre.", "error");
      return;
    }
    setClientGroups(prev => prev.map(g => g.id === id ? { ...g, name: trimmedName } : g));
    notify("Grupo actualizado.", "success");
  }, [clientGroups, notify]);

  const deleteClientGroup = useCallback((id: string) => {
    if (id === 'GENERAL') {
      notify("El grupo 'General' no puede ser eliminado.", "error");
      return;
    }
    if (clients.some(c => c.groupId === id)) {
      notify("No se puede eliminar: hay clientes en este grupo.", "error");
      return;
    }
    setClientGroups(prev => prev.filter(g => g.id !== id));
    notify("Grupo eliminado.", "success");
  }, [clients, notify]);

  return (
    <StoreContext.Provider value={{
      view, setView, currentUser, users, businessConfig, updateBusinessConfig: setBusinessConfig,
      currencies, warehouses, categories, ledger, products, sales, clients, coupons, bogoOffers, offers,
      activePosTerminalId, setActivePosTerminalId,
      addWarehouse: (w) => {
        if (!PermissionEngine.enforcePlanLimits('WAREHOUSES', warehouses.length, getCurrentTier())) {
          notify(`Límite de almacenes alcanzado para el plan ${getCurrentTier()}.`, 'error');
          return;
        }
        setWarehouses(prev => [...prev, w]);
      },
      updateWarehouse: (w) => setWarehouses(prev => prev.map(wh => wh.id === w.id ? w : wh)),
      deleteWarehouse: (id) => {
        if (warehouses.length <= 1) { notify("Debe existir al menos un almacén.", "error"); return; }
        setWarehouses(prev => prev.filter(w => w.id !== id));
        notify("Almacén eliminado", "success");
      },
      addCategory: (name, color = '#64748b') => {
        if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
          notify("La categoría ya existe", "error");
          return;
        }
        setCategories(prev => [...prev, { id: generateUniqueId(), name, color }]);
        notify("Categoría creada", "success");
      },
      updateCategory: (cat) => setCategories(prev => prev.map(c => c.id === cat.id ? cat : c)),
      deleteCategory: (id) => {
        const cat = categories.find(c => c.id === id);
        if (!cat || cat.name === 'Catálogo') return;
        setCategories(prev => prev.filter(c => c.id !== id));
        notify("Categoría eliminada", "success");
      },
      addUser: async (u) => {
        const hashed = await hashPin(u.pin);
        setUsers(prev => [...prev, { ...u, pin: hashed }]);
      },
      updateUserPin,
      deleteUser: (id) => setUsers(prev => prev.filter(u => u.id !== id)),
      login,
      validatePin,
      logout,
      checkModuleAccess: (mid) => PermissionEngine.validateModuleAccess(mid as View, getCurrentTier(), businessConfig.security),
      isLicenseValid: businessConfig.licenseStatus === 'ACTIVE',
      applyLicenseKey: async (key: string) => {
        let tier: LicenseTier | null = null;
        if (key.includes('GOLD')) tier = 'GOLD';
        else if (key.includes('SAPPHIRE')) tier = 'SAPPHIRE';
        else if (key.includes('PLATINUM')) tier = 'PLATINUM';
        if (!tier) return false;
        setBusinessConfig(prev => ({
          ...prev, licenseStatus: 'ACTIVE',
          license: { tier: tier!, status: 'ACTIVE', key, expiryDate: new Date(Date.now() + 86400000 * 365).toISOString() } as any
        }));
        notify(`Plan ${tier} Activado`, "success");
        return true;
      },
      notification, clearNotification: () => setNotification(null),
      notify,
      addProduct: (p) => setProducts(prev => [...prev, p]),
      updateProduct: (p) => setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod)),
      deleteProduct: (id) => setProducts(prev => prev.filter(p => p.id !== id)),
      cart, clearCart: () => setCart([]), addToCart: (p) => setCart(prev => [...prev, p]),
      removeFromCart: (id) => setCart(prev => prev.filter(i => i.cartId !== id)),
      updateQuantity: (cartId, delta) => {
        setCart(prev => prev.map(item => 
          item.cartId === cartId 
            ? { ...item, quantity: Math.max(1, (Number(item.quantity) || 0) + delta) } 
            : item
        ));
      },
      processSale,
      processRefund,
      posCurrency, setPosCurrency, activeShift, 
      openShift: (cash: Record<string, number>) => {
        const snapshot: Record<string, number> = {};
        products.forEach(p => {
          snapshot[p.id] = (p.stock || 0);
          p.variants.forEach(v => {
            snapshot[`${p.id}-${v.id}`] = (v.stock || 0);
          });
        });
        setActiveShift({ 
          id: generateUniqueId(), 
          openedAt: new Date().toISOString(), 
          openedBy: currentUser?.name || 'Sistema', 
          startCash: cash,
          initialStock: snapshot
        });
      },
      closeShift: (cash: Record<string, number>, closedBy: string) => {
        setActiveShift(null);
        localStorage.removeItem('activeShift');
      },
      addCurrency: (c) => setCurrencies(prev => [...prev, c]),
      updateCurrency: (c) => setCurrencies(prev => prev.map(curr => curr.code === c.code ? c : curr)),
      deleteCurrency: (code) => setCurrencies(prev => prev.filter(c => c.code !== code)),
      isItemLocked: (key, idx) => PermissionEngine.isItemSoftLocked(key, idx, getCurrentTier()),
      rates: currencies.reduce((acc, c) => ({ ...acc, [c.code]: c.rate }), {}),
      getCurrentCash: () => {
        const cash: any = { CUP: 0, USD: 0, EUR: 0 };
        ledger.filter(l => l.timestamp >= (activeShift?.openedAt || '') && l.paymentMethod === 'CASH').forEach(l => {
          if (l.direction === 'IN') cash[l.currency] = (cash[l.currency] || 0) + l.amount;
          else cash[l.currency] = (cash[l.currency] || 0) - l.amount;
        });
        if (activeShift?.startCash) {
          Object.entries(activeShift.startCash).forEach(([k, v]) => cash[k] = (cash[k] || 0) + (Number(v) || 0));
        }
        return cash;
      },
      addClient: (c) => setClients(prev => [...prev, { ...c, id: c.id || generateUniqueId(), purchaseHistory: [], creditBalance: 0, balance: 0, groupId: c.groupId || 'GENERAL', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]),
      updateClient: (c) => setClients(prev => prev.map(client => client.id === c.id ? { ...c, updatedAt: new Date().toISOString() } : client)),
      deleteClient: (id) => setClients(prev => prev.filter(c => c.id !== id)),
      addClientCredit,
      deductClientCredit,
      clientGroups,
      addClientGroup,
      updateClientGroup,
      deleteClientGroup,
      addCoupon: (c) => setCoupons(prev => [...prev, c]),
      updateCoupon: (c) => setCoupons(prev => prev.map(item => item.id === c.id ? c : item)),
      deleteCoupon: (id) => setCoupons(prev => prev.filter(c => c.id !== id)),
      addBogoOffer: (o) => {
        const overlap = bogoOffers.some(existing => 
          existing.status === 'ACTIVE' &&
          existing.buyProductId === o.buyProductId &&
          existing.getProductId === o.getProductId &&
          existing.rewardType === o.rewardType &&
          Math.max(new Date(o.startAt).getTime(), new Date(existing.startAt).getTime()) <= 
          Math.min(new Date(o.endAt).getTime(), new Date(existing.endAt).getTime())
        );
        if (overlap) {
          notify("Existe una oferta activa idéntica en este rango temporal.", "error");
          return;
        }
        setBogoOffers(prev => [...prev, o]);
      },
      updateBogoOffer: (o) => setBogoOffers(prev => prev.map(item => item.id === o.id ? o : item)),
      deleteBogoOffer: (id) => setBogoOffers(prev => prev.filter(o => o.id !== id)),
      selectedClientId,
      setSelectedClientId
    } as any}>
      {children}
      {notification && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-top">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 ${notification.type === 'error' ? 'bg-white border-red-500 text-red-600' : 'bg-white border-emerald-500 text-emerald-600'}`}>
            {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-bold text-xs uppercase tracking-widest">{notification.message}</span>
          </div>
        </div>
      )}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
