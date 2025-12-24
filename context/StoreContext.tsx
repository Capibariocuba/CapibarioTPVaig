
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  StoreContextType, View, CurrencyConfig, LedgerEntry, User, 
  BusinessConfig, Coupon, Offer, Role, Product, Client, ClientGroup, Ticket, Sale, Warehouse, LicenseTier, POSStoreTerminal
} from '../types';
import { MOCK_USERS, DEFAULT_BUSINESS_CONFIG } from '../constants';
import { PermissionEngine } from '../security/PermissionEngine';
import { AlertCircle, CheckCircle } from 'lucide-react';

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Helper para hashing de PIN (SHA-256)
const hashPin = async (pin: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(pin + "capibario-tpv-salt"); 
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const WEAK_PINS = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '3210'];

// Divisas por defecto requeridas
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
  
  // Inicialización de divisas con valores por defecto si el storage está vacío
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>(() => {
    const saved = localStorage.getItem('currencies');
    if (saved && saved !== '[]') return JSON.parse(saved);
    return DEFAULT_CURRENCIES;
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => JSON.parse(localStorage.getItem('warehouses') || '[]'));
  const [ledger, setLedger] = useState<LedgerEntry[]>(() => JSON.parse(localStorage.getItem('ledger') || '[]'));
  const [products, setProducts] = useState<Product[]>(() => JSON.parse(localStorage.getItem('products') || '[]'));
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(localStorage.getItem('sales') || '[]'));
  const [clients, setClients] = useState<Client[]>(() => JSON.parse(localStorage.getItem('clients') || '[]'));
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>(() => JSON.parse(localStorage.getItem('clientGroups') || '[]'));
  const [coupons, setCoupons] = useState<Coupon[]>(() => JSON.parse(localStorage.getItem('coupons') || '[]'));
  const [offers, setOffers] = useState<Offer[]>(() => JSON.parse(localStorage.getItem('offers') || '[]'));
  
  const [posCurrency, setPosCurrency] = useState('CUP');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const notify = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const getCurrentTier = useCallback((): LicenseTier => (businessConfig.license?.tier || 'GOLD') as LicenseTier, [businessConfig.license]);

  // Sincronización de divisa base con Empresa y Lógica de arranque para Puntos de Venta
  useEffect(() => {
    const defaultWarehouseId = warehouses[0]?.id || 'wh-default';
    let updatedBiz = false;
    let newTerminals = [...(businessConfig.posTerminals || [])];

    if (newTerminals.length === 0) {
      newTerminals = [{ id: 'pos-1', name: 'Punto de Venta 1', warehouseId: defaultWarehouseId }];
      updatedBiz = true;
    } else {
      newTerminals = newTerminals.map(t => {
        if (!t.warehouseId) {
          updatedBiz = true;
          return { ...t, warehouseId: defaultWarehouseId };
        }
        return t;
      });
    }

    if (updatedBiz) {
      setBusinessConfig(prev => ({ ...prev, posTerminals: newTerminals }));
    }

    // Sincronización: asegurar que primaryCurrency existe en currencies
    const baseCode = businessConfig.primaryCurrency;
    const exists = currencies.find(c => c.code === baseCode);
    if (!exists) {
      setCurrencies(prev => [...prev, { code: baseCode, symbol: '$', rate: 1, allowedPaymentMethods: ['CASH', 'TRANSFER'] }]);
    } else if (exists.rate !== 1) {
      // La base debe tener tasa 1 siempre
      setCurrencies(prev => prev.map(c => c.code === baseCode ? { ...c, rate: 1 } : c));
    }
  }, [warehouses.length, businessConfig.primaryCurrency]);

  useEffect(() => {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('businessConfig', JSON.stringify(businessConfig));
    localStorage.setItem('currencies', JSON.stringify(currencies));
    localStorage.setItem('warehouses', JSON.stringify(warehouses));
    localStorage.setItem('products', JSON.stringify(products));
    localStorage.setItem('sales', JSON.stringify(sales));
    localStorage.setItem('ledger', JSON.stringify(ledger));
    localStorage.setItem('clients', JSON.stringify(clients));
    localStorage.setItem('clientGroups', JSON.stringify(clientGroups));
    localStorage.setItem('coupons', JSON.stringify(coupons));
    localStorage.setItem('offers', JSON.stringify(offers));
  }, [currentUser, users, businessConfig, currencies, warehouses, products, sales, ledger, clients, clientGroups, coupons, offers]);

  const validatePinSecurity = async (pin: string, excludeUserId?: string): Promise<{valid: boolean, error?: string}> => {
    if (pin.length !== 4) return { valid: false, error: "El PIN debe tener 4 dígitos." };
    if (WEAK_PINS.includes(pin)) return { valid: false, error: "PIN demasiado débil." };
    
    const hashed = await hashPin(pin);
    const exists = users.some(u => u.pin === hashed && u.id !== excludeUserId);
    if (exists) return { valid: false, error: "PIN ya en uso." };
    
    return { valid: true };
  };

  const login = async (pin: string): Promise<boolean> => {
    const hashed = await hashPin(pin);
    const u = users.find(u => u.pin === hashed);
    if (u) {
      setCurrentUser(u);
      return true;
    }
    notify("PIN Incorrecto", "error");
    return false;
  };

  return (
    <StoreContext.Provider value={{
      view, setView, currentUser, users, businessConfig, updateBusinessConfig: setBusinessConfig,
      currencies, warehouses, ledger, products, sales, clients, coupons, offers,
      addWarehouse: (w) => setWarehouses([...warehouses, w]),
      deleteWarehouse: (id) => setWarehouses(warehouses.filter(w => w.id !== id)),
      addUser: async (u) => {
        const validation = await validatePinSecurity(u.pin);
        if (!validation.valid) { notify(validation.error!, "error"); return; }
        const hashed = await hashPin(u.pin);
        setUsers([...users, { ...u, pin: hashed }]);
      },
      updateUserPin: async (id, pin) => {
        const validation = await validatePinSecurity(pin, id);
        if (!validation.valid) { notify(validation.error!, "error"); return; }
        const hashed = await hashPin(pin);
        setUsers(users.map(u => u.id === id ? { ...u, pin: hashed } : u));
      },
      deleteUser: (id) => setUsers(users.filter(u => u.id !== id)),
      login,
      logout: () => { setCurrentUser(null); setView(View.POS); },
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
      addClient: (c) => setClients([...clients, c]),
      cart, clearCart: () => setCart([]), addToCart: (p) => setCart([...cart, p]),
      removeFromCart: (id) => setCart(cart.filter(i => i.cartId !== id)),
      posCurrency, setPosCurrency, activeShift, 
      openShift: () => setActiveShift({ openedAt: new Date().toISOString(), openedBy: currentUser?.name }),
      closeShift: () => setActiveShift(null),
      addCurrency: (c) => setCurrencies([...currencies, c]),
      updateCurrency: (c) => setCurrencies(currencies.map(curr => curr.code === c.code ? c : curr)),
      deleteCurrency: (code) => setCurrencies(currencies.filter(c => c.code !== code)),
      isItemLocked: (key, idx) => PermissionEngine.isItemSoftLocked(key, idx, getCurrentTier()),
      rates: currencies.reduce((acc, c) => ({ ...acc, [c.code]: c.rate }), {})
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
