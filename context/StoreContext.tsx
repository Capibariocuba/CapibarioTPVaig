
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  StoreContextType, View, CurrencyConfig, LedgerEntry, User, 
  BusinessConfig, Coupon, BogoOffer, Offer, Role, Product, Client, ClientGroup, Ticket, Sale, Warehouse, LicenseTier, POSStoreTerminal, Category, PaymentDetail, PurchaseHistoryItem, Shift, Refund, RefundItem,
  Employee, EmployeePaymentEvent, SalaryType, PayFrequency, PendingOrder, PaymentMethodConfig
} from '../types';
import { MOCK_USERS, DEFAULT_BUSINESS_CONFIG, CATEGORIES as DEFAULT_CATEGORIES, MASTER_KEYS } from '../constants';
import { PermissionEngine } from '../security/PermissionEngine';
import { ROLE_VIEWS, PLAN_CAPABILITIES } from '../security/Definitions';
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
  { code: 'CUP', symbol: '$', rate: 1, allowedPaymentMethods: ['CASH', 'TRANSFER'], isBase: true },
  { code: 'USD', symbol: '$', rate: 330, allowedPaymentMethods: ['CASH', 'TRANSFER', 'CARD'] },
  { code: 'EUR', symbol: '€', rate: 340, allowedPaymentMethods: ['CASH', 'TRANSFER'] }
];

// Canal de comunicación para llamado de pedidos
const catalogChannel = new BroadcastChannel('capibario_catalog_calls');

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

  const rates = useMemo(() => 
    currencies.reduce((acc, c) => ({ ...acc, [c.code]: c.rate }), {} as Record<string, number>)
  , [currencies]);

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

  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    const saved = localStorage.getItem('coupons');
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.map((c: any) => ({
      ...c,
      currentUsages: Number(c.currentUsages || 0)
    }));
  });
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

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('employees');
    return saved ? JSON.parse(saved) : [];
  });

  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(() => {
    const saved = localStorage.getItem('pendingOrders');
    return saved ? JSON.parse(saved) : [];
  });

  const notify = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const getCurrentTier = useCallback((): LicenseTier => (businessConfig.license?.tier || 'GOLD') as LicenseTier, [businessConfig.license]);

  // Migración y normalización de seguridad
  useEffect(() => {
    if (currentUser) {
      const rolesValues = Object.values(Role);
      if (!rolesValues.includes(currentUser.role)) {
        console.warn("Detectado rol inválido o antiguo, normalizando a VENDEDOR");
        setCurrentUser({ ...currentUser, role: Role.DEPENDENT });
      }
    }
  }, [currentUser]);

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
    localStorage.setItem('employees', JSON.stringify(employees));
    localStorage.setItem('pendingOrders', JSON.stringify(pendingOrders));
    if (activePosTerminalId) localStorage.setItem('activePosTerminalId', activePosTerminalId);
  }, [currentUser, users, businessConfig, currencies, warehouses, categories, products, sales, ledger, clients, clientGroups, coupons, bogoOffers, offers, activeShift, activePosTerminalId, employees, pendingOrders]);

  const convertCurrency = useCallback((amount: number, from: string, to: string) => {
    const fromRate = currencies.find(c => c.code === from)?.rate || 1;
    const toRate = currencies.find(c => c.code === to)?.rate || 1;
    const inBase = amount * fromRate;
    return inBase / toRate;
  }, [currencies]);

  const getCurrentCash = useCallback(() => {
    const cash: any = { CUP: 0, USD: 0, EUR: 0 };
    ledger.filter(l => l.timestamp >= (activeShift?.openedAt || '') && l.paymentMethod === 'CASH' && l.affectsCash !== false).forEach(l => {
      if (l.direction === 'IN') cash[l.currency] = (cash[l.currency] || 0) + l.amount;
      else cash[l.currency] = (cash[l.currency] || 0) - l.amount;
    });
    if (activeShift?.startCash) {
      Object.entries(activeShift.startCash).forEach(([k, v]) => cash[k] = (cash[k] || 0) + (Number(v) || 0));
    }
    return cash;
  }, [ledger, activeShift]);

  const executeLedgerTransaction = useCallback((entry: Partial<LedgerEntry>) => {
    const pm = entry.paymentMethod || 'CASH';
    const newEntry: LedgerEntry = {
      id: generateUniqueId(),
      timestamp: new Date().toISOString(),
      type: entry.type || 'OTHER',
      direction: entry.direction || 'IN',
      amount: entry.amount || 0,
      currency: entry.currency || 'CUP',
      userId: currentUser?.id || '',
      userName: currentUser?.name || 'Sistema',
      description: entry.description || '',
      paymentMethod: pm,
      affectsCash: entry.affectsCash ?? (pm !== 'NONE'),
      txId: entry.txId
    };
    setLedger(prev => [...prev, newEntry]);
    return true;
  }, [currentUser]);

  const processSale = useCallback((saleData: any): Ticket | null => {
    try {
      const { items, total, payments, currency, note, appliedCouponId, couponDiscount, bogoDiscount, bogoAppsCount } = saleData;
      
      // 1. Validaciones Críticas
      if (!items || items.length === 0) { notify("Carrito vacío", "error"); return null; }
      if (!activeShift) { notify("No hay un turno abierto", "error"); return null; }
      if (!currentUser) { notify("Sesión no válida", "error"); return null; }

      const saleTimestamp = new Date().toISOString();
      const txId = generateUniqueId();
      const seq = businessConfig.ticketSequence || 1;
      const ticketNumber = seq < 1000000 ? seq.toString().padStart(6, '0') : seq.toString();

      // 2. Preparación de Cambios de Estado (Atomicidad Manual)
      const nextProducts = products.map(p => {
        const productItemsInCart = items.filter((i: any) => i.id === p.id);
        if (productItemsInCart.length === 0) return p;

        const newP = { ...p };
        let totalSoldForThisProduct = 0;

        productItemsInCart.forEach((cartItem: any) => {
          totalSoldForThisProduct += Number(cartItem.quantity || 0);
          if (cartItem.selectedVariantId) {
            newP.variants = newP.variants.map(v => 
              v.id === cartItem.selectedVariantId 
                ? { ...v, stock: (Number(v.stock) || 0) - Number(cartItem.quantity) } 
                : v
            );
          } else {
            newP.stock = (Number(newP.stock) || 0) - Number(cartItem.quantity);
          }
        });

        newP.history = [{
          id: generateUniqueId(),
          timestamp: saleTimestamp,
          type: 'STOCK_ADJUST',
          userName: currentUser.name,
          details: `Venta: -${totalSoldForThisProduct} unidades (Ticket ${ticketNumber})`
        }, ...(newP.history || [])];

        return newP;
      });

      const newLedgerEntries: LedgerEntry[] = [];
      let finalRemainingCredit: number | undefined = undefined;
      let nextClients = [...clients];

      payments.forEach((p: PaymentDetail) => {
        newLedgerEntries.push({
          id: generateUniqueId(),
          timestamp: saleTimestamp,
          type: 'SALE',
          direction: 'IN',
          amount: Number(p.amount) || 0,
          currency: p.currency,
          paymentMethod: p.method,
          userId: currentUser.id,
          userName: currentUser.name,
          description: `Venta ${ticketNumber}`,
          affectsCash: p.method === 'CASH',
          txId
        });

        if (p.method === 'CREDIT' && selectedClientId) {
          const rate = rates[p.currency] || 1;
          const amountInCUP = p.currency === 'CUP' ? p.amount : p.amount * rate;
          const clientIndex = nextClients.findIndex(cl => cl.id === selectedClientId);
          if (clientIndex !== -1) {
            const currentBalance = Number(nextClients[clientIndex].creditBalance) || 0;
            const newBalance = Math.max(0, currentBalance - amountInCUP);
            finalRemainingCredit = newBalance;
            nextClients[clientIndex] = {
              ...nextClients[clientIndex],
              creditBalance: newBalance,
              balance: newBalance,
              updatedAt: saleTimestamp
            };
          }
        }
      });

      // Cálculo de cambio
      const totalPaid = payments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
      const overpay = totalPaid - (Number(total) || 0);
      if (overpay > 0.009) {
        const changeCUP = convertCurrency(overpay, currency, 'CUP');
        newLedgerEntries.push({
          id: generateUniqueId(),
          timestamp: saleTimestamp,
          type: 'EXCHANGE',
          direction: 'OUT',
          amount: changeCUP,
          currency: 'CUP',
          paymentMethod: 'CASH',
          userId: currentUser.id,
          userName: currentUser.name,
          description: `Cambio Venta ${ticketNumber}`,
          affectsCash: true,
          txId
        });
      }

      // 3. Persistencia de Estado
      setProducts(nextProducts);
      setLedger(prev => [...prev, ...newLedgerEntries]);
      setClients(nextClients);
      setBusinessConfig(prev => ({ ...prev, ticketSequence: seq + 1 }));

      if (appliedCouponId) {
        setCoupons(prev => prev.map(c => 
          c.id === appliedCouponId ? { ...c, currentUsages: (Number(c.currentUsages) || 0) + 1 } : c
        ));
      }

      const finalTicket: Ticket = {
        id: txId,
        ticketNumber,
        items: items.map((i: any) => ({ ...i })), // Clonar items para evitar referencias vivas al cart
        subtotal: Number(saleData.subtotal) || 0,
        discount: Number(saleData.discount) || 0,
        couponDiscount: Number(couponDiscount) || 0,
        bogoDiscount: Number(bogoDiscount) || 0,
        bogoAppsCount: Number(bogoAppsCount) || 0,
        total: Number(total) || 0,
        payments,
        currency,
        note,
        appliedCouponId,
        clientId: selectedClientId || undefined,
        sellerName: currentUser.name,
        clientRemainingCredit: finalRemainingCredit,
        timestamp: saleTimestamp
      };

      setSales(prev => [...prev, { ...finalTicket, shiftId: activeShift.id, date: saleTimestamp }]);
      
      if (selectedClientId) {
        const historyItem: PurchaseHistoryItem = {
          id: generateUniqueId(),
          saleId: txId,
          timestamp: saleTimestamp,
          total: Number(total) || 0,
          currency,
          itemsCount: items.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)
        };
        setClients(prev => prev.map(c => c.id === selectedClientId ? { 
          ...c, 
          purchaseHistory: [historyItem, ...(c.purchaseHistory || [])], 
          updatedAt: saleTimestamp 
        } : c));
      }
      
      notify("Venta procesada con éxito", "success");
      return finalTicket;

    } catch (error) {
      console.error("FATAL SALE PROCESS ERROR:", error);
      notify("Error crítico al procesar venta.", "error");
      return null;
    }
  }, [products, activeShift, currentUser, convertCurrency, notify, selectedClientId, rates, clients, businessConfig.ticketSequence, coupons]);

  const processRefund = useCallback((saleId: string, refundItems: RefundItem[], authUser: User, source: 'CASHBOX' | 'OUTSIDE_CASHBOX'): boolean => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return false;

    const totalRefundCUP = refundItems.reduce((acc, item) => acc + item.amountCUP, 0);
    const timestamp = new Date().toISOString();
    const refundId = generateUniqueId();
    const saleLabel = sale.ticketNumber || saleId.slice(-6);

    if (source === 'CASHBOX') {
        const cashAvailable = getCurrentCash().CUP;
        if (cashAvailable < totalRefundCUP - 0.009) {
             notify("Fondo insuficiente en caja para este reembolso", "error");
             return false;
        }
    }

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
          details: `Reembolso Ticket ${saleLabel} (${source === 'CASHBOX' ? 'En Caja' : 'Fuera Caja'}): +${ri.qty} unidades`,
          entityType: cartItemInSale.selectedVariantId ? 'VARIANT' : 'PRODUCT',
          entityId: cartItemInSale.selectedVariantId || p.id
        }, ...(newP.history || [])];
      });
      return newP;
    });

    if (source === 'CASHBOX') {
        executeLedgerTransaction({
          type: 'REFUND',
          direction: 'OUT',
          amount: totalRefundCUP,
          currency: 'CUP',
          paymentMethod: 'CASH',
          description: `Reembolso Ticket ${saleLabel}`,
          txId: refundId
        });
    }

    setProducts(updatedProducts);
    
    const newRefund: Refund = {
        id: refundId,
        timestamp,
        shiftId: activeShift?.id || 'NO-SHIFT',
        authorizedBy: authUser.name,
        items: refundItems,
        totalCUP: totalRefundCUP,
        method: 'CUP',
        refundSource: source
    };

    setSales(prev => prev.map(s => s.id === saleId ? {
        ...s,
        refunds: [...(s.refunds || []), newRefund]
    } : s));

    notify(`Reembolso procesado (${source === 'CASHBOX' ? 'Caja' : 'Stock'}): -$${totalRefundCUP.toFixed(2)} CUP`, "success");
    return true;
  }, [sales, products, activeShift, notify, getCurrentCash, executeLedgerTransaction]);

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

  const addToWaitingList = useCallback((ticket: Ticket) => {
    const totalCUP = ticket.currency === 'CUP' ? ticket.total : ticket.total * (rates[ticket.currency] || 1);
    const client = clients.find(c => c.id === ticket.clientId);
    const newPending: PendingOrder = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber || ticket.id.slice(-6),
      timestamp: new Date().toISOString(),
      totalCUP,
      customerName: client?.name || 'Consumidor Final'
    };
    setPendingOrders(prev => {
        if (prev.some(p => p.id === newPending.id)) return prev;
        return [...prev, newPending];
    });
    notify("Pedido enviado a lista de espera", "success");
  }, [rates, clients, notify]);

  const callOrder = useCallback((orderId: string) => {
    const order = pendingOrders.find(p => p.id === orderId);
    if (!order) return;

    // Disparar evento a catálogo
    catalogChannel.postMessage({ type: 'ORDER_CALL', ticketNumber: order.ticketNumber });
    
    // Eliminar de pendientes
    setPendingOrders(prev => prev.filter(p => p.id !== orderId));
    notify(`Llamando Ticket #${order.ticketNumber}`, "success");
  }, [pendingOrders, notify]);

  const removePendingOrder = useCallback((orderId: string) => {
    setPendingOrders(prev => prev.filter(p => p.id !== orderId));
  }, []);

  const updateUserPin = useCallback(async (userId: string, newPin: string) => {
    if (!userId || newPin.length !== 4) return;
    const hashed = await hashPin(newPin);
    if (users.some(u => u.id !== userId && u.pin === hashed)) {
      notify("PIN ya está siendo utilizado por otro operador", "error");
      return;
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, pin: hashed } : u));
    notify("PIN actualizado correctamente", "success");
  }, [users, notify]);

  const addClientCredit = useCallback((clientId: string, amount: number, reason?: string) => {
    setClients(prev => prev.map(c => c.id === clientId ? { 
      ...c, 
      creditBalance: (Number(c.creditBalance) || 0) + (Number(amount) || 0),
      balance: (Number(c.creditBalance) || 0) + (Number(amount) || 0),
      updatedAt: new Date().toISOString() 
    } : c));
    notify("Crédito añadido", "success");
  }, [notify]);

  const deductClientCredit = useCallback((clientId: string, amount: number, reason?: string) => {
    let possible = false;
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        if ((Number(c.creditBalance) || 0) >= (Number(amount) || 0)) {
          possible = true;
          return { 
            ...c, 
            creditBalance: (Number(c.creditBalance) || 0) - (Number(amount) || 0),
            balance: (Number(c.creditBalance) || 0) - (Number(amount) || 0),
            updatedAt: new Date().toISOString() 
          };
        }
      }
      return c;
    }));
    if (!possible) notify("Saldo insuficiente", "error");
    else notify("Crédito deducido", "success");
    return possible;
  }, [notify]);

  const addClientGroup = useCallback((name: string) => {
    setClientGroups(prev => [...prev, { id: generateUniqueId(), name, color: '#64748b', createdAt: new Date().toISOString() }]);
    notify("Grupo creado", "success");
  }, [notify]);

  const updateClientGroup = useCallback((id: string, name: string) => {
    setClientGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
    notify("Grupo actualizado", "success");
  }, [notify]);

  const deleteClientGroup = useCallback((id: string) => {
    if (id === 'GENERAL') return;
    setClientGroups(prev => prev.filter(g => g.id !== id));
    setClients(prev => prev.map(c => c.groupId === id ? { ...c, groupId: 'GENERAL' } : c));
    notify("Grupo eliminado", "success");
  }, [notify]);

  const addEmployee = async (employee: Employee, rawPin: string) => {
    const hashedPin = await hashPin(rawPin);
    const newUserId = generateUniqueId();
    
    const newUser: User = {
      id: newUserId,
      name: employee.name,
      pin: hashedPin,
      role: employee.role
    };

    const finalEmployee = { ...employee, userId: newUserId };
    setEmployees(prev => [...prev, finalEmployee]);
    setUsers(prev => {
        const next = [...prev, newUser];
        if (prev.length === 0) {
            setCurrentUser(newUser);
        }
        return next;
    });
    notify("Empleado registrado con éxito", "success");
  };

  const updateEmployee = async (employee: Employee, rawPin?: string) => {
    let hashedPin = '';
    if (rawPin) {
      hashedPin = await hashPin(rawPin);
    }

    // 1. Actualizar array de empleados
    const nextEmployees = employees.map(e => e.id === employee.id ? { ...employee, updatedAt: new Date().toISOString() } : e);
    setEmployees(nextEmployees);
    
    // 2. Sincronizar usuarios de TPV y manejar el filtrado de bajas laborales
    setUsers(prev => {
      const updatedUsers = prev.map(u => {
        if (u.id === employee.userId) {
          return {
            ...u,
            name: employee.name,
            role: employee.role,
            pin: rawPin ? hashedPin : u.pin
          };
        }
        return u;
      });

      // Filtrar usuarios cuyos empleados asociados tengan fecha de baja
      return updatedUsers.filter(u => {
        const associatedEmp = nextEmployees.find(e => e.userId === u.id);
        return !associatedEmp?.terminationDate;
      });
    });

    notify("Ficha actualizada", "success");
  };

  const deleteEmployee = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (emp) {
      setUsers(prev => prev.filter(u => u.id !== emp.userId));
    }
    setEmployees(prev => prev.filter(e => e.id !== id));
    notify("Empleado eliminado", "success");
  };

  const addEmployeePayment = (employeeId: string, payment: EmployeePaymentEvent) => {
    setEmployees(prev => prev.map(e => e.id === employeeId ? {
      ...e,
      paymentHistory: [payment, ...e.paymentHistory],
      updatedAt: new Date().toISOString()
    } : e));
    notify("Pago registrado", "success");
  };

  const checkModuleAccess = useCallback((moduleId: string): boolean => {
    // Si no hay usuarios en el sistema, permitimos acceso exclusivo a EMPLOYEES para el setup inicial
    if (users.length === 0) {
      return moduleId === View.EMPLOYEES;
    }

    // Si existen usuarios pero no hay sesión activa, permitir POS y CONFIGURATION para login
    if (!currentUser) {
      return moduleId === View.POS || moduleId === View.CONFIGURATION;
    }
    
    // TPV siempre accesible si el usuario está logueado como medida de seguridad fallback
    if (moduleId === View.POS) return true;

    const roleViews = ROLE_VIEWS[currentUser.role] || [];
    const currentPlan = (businessConfig.license?.tier || 'GOLD') as LicenseTier;
    const planAllowedViews = PLAN_CAPABILITIES[currentPlan]?.allowedViews || [];

    // ADMIN siempre tiene acceso total
    if (currentUser.role === Role.ADMIN) return true;

    // El acceso es la intersección de lo permitido por el ROL y lo incluido en el PLAN
    return roleViews.includes(moduleId as View) && planAllowedViews.includes(moduleId as View);
  }, [currentUser, businessConfig.license, users.length]);

  const getFirstAllowedView = useCallback((): View => {
    if (users.length === 0) return View.EMPLOYEES; // Setup inicial forzado
    if (!currentUser) return View.POS;
    if (currentUser.role === Role.ADMIN) return View.POS;

    const priorities = [View.POS, View.CLIENTS, View.INVENTORY, View.EMPLOYEES, View.DASHBOARD, View.LEDGER, View.CONFIGURATION];
    for (const v of priorities) {
      if (checkModuleAccess(v)) return v;
    }
    return View.POS;
  }, [currentUser, checkModuleAccess, users.length]);

  return (
    <StoreContext.Provider value={{
      view, setView, currentUser, users, businessConfig, updateBusinessConfig: setBusinessConfig,
      currencies, warehouses, categories, ledger, products, sales, clients, coupons, bogoOffers, offers,
      activePosTerminalId, setActivePosTerminalId,
      pendingOrders, addToWaitingList, callOrder, removePendingOrder,
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
        if (!PermissionEngine.enforcePlanLimits('OPERATORS', users.length, getCurrentTier())) {
            notify(`Límite de operadores alcanzado para el plan ${getCurrentTier()}.`, 'error');
            return;
        }
        const hashed = await hashPin(u.pin);
        setUsers(prev => [...prev, { ...u, pin: hashed }]);
      },
      updateUserPin,
      deleteUser: (id) => setUsers(prev => prev.filter(u => u.id !== id)),
      login,
      validatePin,
      logout,
      checkModuleAccess,
      getFirstAllowedView,
      isLicenseValid: businessConfig.licenseStatus === 'ACTIVE',
      applyLicenseKey: async (key: string) => {
        let tier: LicenseTier | null = null;
        if (key === MASTER_KEYS.GOLD) tier = 'GOLD';
        else if (key === MASTER_KEYS.PLATINUM) tier = 'PLATINUM';
        
        if (!tier) return false;

        // Si es plan GOLD, forzar a moneda CUP si había otras configuradas (para cumplimiento)
        if (tier === 'GOLD') {
            setPosCurrency('CUP');
        }

        setBusinessConfig(prev => ({
          ...prev, 
          licenseStatus: 'ACTIVE',
          license: { 
            tier: tier!, 
            status: 'ACTIVE', 
            key, 
            expiryDate: new Date(Date.now() + 86400000).toISOString() // 24 HORAS
          } as any
        }));
        notify(`Plan ${tier} Activado por 24 horas`, "success");
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
        setCart(prev => {
          const item = prev.find(i => i.cartId === cartId);
          if (!item) return prev;
          
          if (delta <= 0) {
            return prev.map(i => i.cartId === cartId ? { ...i, quantity: Math.max(1, (Number(i.quantity) || 0) + delta) } : i);
          }
          
          const p = products.find(prod => prod.id === item.id);
          if (!p) return prev;
          
          const stockAvailable = item.selectedVariantId 
            ? (p.variants.find(v => v.id === item.selectedVariantId)?.stock || 0)
            : (p.stock || 0);
            
          if ((Number(item.quantity) + delta) > stockAvailable) {
            notify(`Stock insuficiente: ${stockAvailable} disponibles`, "error");
            return prev;
          }

          return prev.map(i => i.cartId === cartId ? { ...i, quantity: Number(i.quantity) + delta } : i);
        });
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
      addCurrency: (c) => {
          if (getCurrentTier() === 'GOLD') {
              notify("El Plan GOLD solo permite operar en CUP", "error");
              return;
          }
          setCurrencies(prev => [...prev, c]);
      },
      updateCurrency: (c) => setCurrencies(prev => prev.map(curr => curr.code === c.code ? c : curr)),
      deleteCurrency: (code) => setCurrencies(prev => prev.filter(c => c.code !== code)),
      addPaymentMethod: (method) => {
        setBusinessConfig(prev => ({
          ...prev,
          paymentMethods: [...prev.paymentMethods, method]
        }));
        notify("Método de pago añadido", "success");
      },
      updatePaymentMethod: (method) => {
        setBusinessConfig(prev => ({
          ...prev,
          paymentMethods: prev.paymentMethods.map(pm => pm.id === method.id ? method : pm)
        }));
        // Sincronización: si se desactiva, eliminar de todas las monedas
        if (!method.enabled) {
          setCurrencies(prev => prev.map(c => ({
            ...c,
            allowedPaymentMethods: c.allowedPaymentMethods.filter(id => id !== method.id)
          })));
        }
        notify("Método de pago actualizado", "success");
      },
      deletePaymentMethod: (id) => {
        setBusinessConfig(prev => ({
          ...prev,
          paymentMethods: prev.paymentMethods.filter(pm => pm.id !== id)
        }));
        // Sincronización: eliminar de todas las monedas
        setCurrencies(prev => prev.map(c => ({
          ...c,
          allowedPaymentMethods: c.allowedPaymentMethods.filter(mid => mid !== id)
        })));
        notify("Método de pago eliminado", "success");
      },
      isItemLocked: (key, idx) => PermissionEngine.isItemSoftLocked(key, idx, getCurrentTier()),
      rates,
      getCurrentCash,
      getLedgerBalance: (currency: string, method: string) => {
        return ledger
          .filter(l => l.currency === currency && l.paymentMethod === method && l.affectsCash !== false)
          .reduce((acc, l) => l.direction === 'IN' ? acc + l.amount : acc - l.amount, 0);
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
      setSelectedClientId,
      executeLedgerTransaction,
      employees,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      addEmployeePayment
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
