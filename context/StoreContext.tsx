
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  StoreContextType, View, CurrencyConfig, LedgerEntry, User, 
  BusinessConfig, Coupon, Offer, Role, Product, Client, ClientGroup, Ticket, Sale, Warehouse, LicenseTier, POSStoreTerminal, Category
} from '../types';
import { MOCK_USERS, DEFAULT_BUSINESS_CONFIG, CATEGORIES as DEFAULT_CATEGORIES } from '../constants';
import { PermissionEngine } from '../security/PermissionEngine';
import { AlertCircle, CheckCircle } from 'lucide-react';

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// UTILIDAD DE GENERACIÓN DE IDS ÚNICOS E IRREPETIBLES (FASE B)
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

  // MIGRACIÓN Y GESTIÓN DE CATEGORÍAS V2 - Asegurando IDs Únicos
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('categories_v2');
    if (saved) return JSON.parse(saved);
    
    const oldStrings = JSON.parse(localStorage.getItem('categories') || '[]');
    const merged = Array.from(new Set(['Catálogo', ...DEFAULT_CATEGORIES.filter(c => c !== 'Todo'), ...oldStrings]));
    
    return merged.map(name => ({
      id: generateUniqueId(),
      name: name,
      color: name === 'Catálogo' ? '#0ea5e9' : '#64748b'
    }));
  });

  // MIGRACIÓN DE PRODUCTOS Y VARIANTES (FASE B)
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = JSON.parse(localStorage.getItem('products') || '[]');
    return saved.map((p: any) => ({
      ...p,
      id: p.id || generateUniqueId(),
      categories: p.categories || [p.category || 'Catálogo'],
      variants: (p.variants || []).map((v: any) => ({
        ...v,
        id: v.id || ('VAR-' + generateUniqueId())
      })),
      pricingRules: p.pricingRules || [],
      history: p.history || [],
      warehouseId: p.warehouseId || (p.batches && p.batches[0]?.warehouseId) || 'wh-default'
    }));
  });

  const [ledger, setLedger] = useState<LedgerEntry[]>(() => JSON.parse(localStorage.getItem('ledger') || '[]'));
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
    localStorage.setItem('offers', JSON.stringify(offers));
  }, [currentUser, users, businessConfig, currencies, warehouses, categories, products, sales, ledger, clients, clientGroups, coupons, offers]);

  const login = async (pin: string): Promise<boolean> => {
    const hashed = await hashPin(pin);
    const u = users.find(u => u.pin === hashed);
    if (u) { setCurrentUser(u); return true; }
    notify("PIN Incorrecto", "error");
    return false;
  };

  return (
    <StoreContext.Provider value={{
      view, setView, currentUser, users, businessConfig, updateBusinessConfig: setBusinessConfig,
      currencies, warehouses, categories, ledger, products, sales, clients, coupons, offers,
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
        const newCat: Category = { id: generateUniqueId(), name, color };
        setCategories(prev => [...prev, newCat]);
        notify("Categoría creada", "success");
      },
      updateCategory: (cat) => setCategories(prev => prev.map(c => c.id === cat.id ? cat : c)),
      deleteCategory: (id) => {
        const cat = categories.find(c => c.id === id);
        if (!cat) return;
        if (cat.name === 'Catálogo') { notify("No se puede eliminar la categoría base", "error"); return; }
        
        const hasActiveProducts = products.some(p => {
          const isLinked = p.categories.includes(cat.name);
          if (!isLinked) return false;
          const totalStock = (p.stock || 0) + (p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0);
          return totalStock > 0;
        });

        if (hasActiveProducts) {
          notify("No se puede eliminar: Hay productos con stock activo vinculados", "error");
          return;
        }

        setProducts(prev => prev.map(p => ({
          ...p,
          categories: p.categories.filter(c => c !== cat.name)
        })));
        setCategories(prev => prev.filter(c => c.id !== id));
        notify("Categoría eliminada", "success");
      },
      addUser: async (u) => {
        const hashed = await hashPin(u.pin);
        setUsers(prev => [...prev, { ...u, pin: hashed }]);
      },
      deleteUser: (id) => setUsers(prev => prev.filter(u => u.id !== id)),
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
      addProduct: (p) => setProducts(prev => [...prev, p]),
      updateProduct: (p) => setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod)),
      deleteProduct: (id) => setProducts(prev => prev.filter(p => p.id !== id)),
      cart, clearCart: () => setCart([]), addToCart: (p) => setCart(prev => [...prev, p]),
      removeFromCart: (id) => setCart(prev => prev.filter(i => i.cartId !== id)),
      posCurrency, setPosCurrency, activeShift, 
      openShift: () => setActiveShift({ openedAt: new Date().toISOString(), openedBy: currentUser?.name }),
      closeShift: () => setActiveShift(null),
      addCurrency: (c) => setCurrencies(prev => [...prev, c]),
      updateCurrency: (c) => setCurrencies(prev => prev.map(curr => curr.code === c.code ? c : curr)),
      deleteCurrency: (code) => setCurrencies(prev => prev.filter(c => c.code !== code)),
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
