
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  StoreContextType, View, CurrencyConfig, LedgerEntry, User, 
  BusinessConfig, Coupon, Offer, Role, Product, Client, ClientGroup, Ticket, Sale, Warehouse, LicenseTier
} from '../types';
import { MOCK_USERS, DEFAULT_BUSINESS_CONFIG } from '../constants';
import { PermissionEngine } from '../security/PermissionEngine';
import { AlertCircle, CheckCircle } from 'lucide-react';

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- NAVEGACIÓN Y SESIÓN ---
  const [view, setView] = useState<View>(View.POS);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved && saved !== 'null' ? JSON.parse(saved) : null;
  });

  // --- ENTIDADES ---
  const [users, setUsers] = useState<User[]>(() => JSON.parse(localStorage.getItem('users') || JSON.stringify(MOCK_USERS)));
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig>(() => JSON.parse(localStorage.getItem('businessConfig') || JSON.stringify(DEFAULT_BUSINESS_CONFIG)));
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>(() => JSON.parse(localStorage.getItem('currencies') || '[]'));
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => JSON.parse(localStorage.getItem('warehouses') || '[]'));
  const [ledger, setLedger] = useState<LedgerEntry[]>(() => JSON.parse(localStorage.getItem('ledger') || '[]'));
  const [products, setProducts] = useState<Product[]>(() => JSON.parse(localStorage.getItem('products') || '[]'));
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(localStorage.getItem('sales') || '[]'));
  const [clients, setClients] = useState<Client[]>(() => JSON.parse(localStorage.getItem('clients') || '[]'));
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>(() => JSON.parse(localStorage.getItem('clientGroups') || '[]'));
  const [coupons, setCoupons] = useState<Coupon[]>(() => JSON.parse(localStorage.getItem('coupons') || '[]'));
  const [offers, setOffers] = useState<Offer[]>(() => JSON.parse(localStorage.getItem('offers') || '[]'));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  const [posCurrency, setPosCurrency] = useState('CUP');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);

  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const notify = (message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const getCurrentTier = useCallback((): LicenseTier => (businessConfig.license?.tier || 'GOLD') as LicenseTier, [businessConfig.license]);

  // Persistencia
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

  const applyLicenseKey = async (key: string): Promise<boolean> => {
    let tier: LicenseTier | null = null;
    if (key.includes('GOLD')) tier = 'GOLD';
    else if (key.includes('SAPPHIRE')) tier = 'SAPPHIRE';
    else if (key.includes('PLATINUM')) tier = 'PLATINUM';

    if (!tier) return false;

    setBusinessConfig(prev => ({
      ...prev,
      licenseStatus: 'ACTIVE',
      license: {
        tier: tier!,
        status: 'ACTIVE',
        key,
        expiryDate: new Date(Date.now() + 86400000 * 365).toISOString()
      } as any
    }));
    notify(`Plan ${tier} Activado`, "success");
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setView(View.POS);
  };

  return (
    <StoreContext.Provider value={{
      view, setView, currentUser, users, businessConfig, updateBusinessConfig: setBusinessConfig,
      currencies, warehouses, ledger, products, sales, clients, coupons, offers,
      addWarehouse: (w) => setWarehouses([...warehouses, w]),
      deleteWarehouse: (id) => setWarehouses(warehouses.filter(w => w.id !== id)),
      addUser: (u) => setUsers([...users, u]),
      deleteUser: (id) => setUsers(users.filter(u => u.id !== id)),
      login: (pin: string) => {
        const u = users.find(u => u.pin === pin);
        if (u) { setCurrentUser(u); return true; }
        return false;
      },
      logout,
      checkModuleAccess: (mid) => PermissionEngine.validateModuleAccess(mid as View, getCurrentTier(), businessConfig.security),
      isLicenseValid: businessConfig.licenseStatus === 'ACTIVE',
      applyLicenseKey,
      notification,
      clearNotification: () => setNotification(null),
      // Resto de stubs para evitar errores de tipo en otros componentes
      addClient: (c) => setClients([...clients, c]),
      updateClient: (c) => setClients(clients.map(cl => cl.id === c.id ? c : cl)),
      executeLedgerTransaction: () => true,
      addProduct: (p) => setProducts([...products, p]),
      updateProduct: (p) => setProducts(products.map(pr => pr.id === p.id ? p : pr)),
      deleteProduct: (id) => setProducts(products.filter(p => p.id !== id)),
      cart, clearCart: () => setCart([]), addToCart: (p) => setCart([...cart, p]),
      removeFromCart: (id) => setCart(cart.filter(i => i.cartId !== id)),
      posCurrency, setPosCurrency, activeShift, 
      openShift: () => setActiveShift({ openedAt: new Date().toISOString(), openedBy: currentUser?.name }),
      closeShift: () => setActiveShift(null),
      isItemLocked: (key, idx) => PermissionEngine.isItemSoftLocked(key, idx, getCurrentTier())
    } as any}>
      {children}
      {notification && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-top">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 ${notification.type === 'error' ? 'bg-white border-red-500 text-red-600' : 'bg-white border-emerald-500 text-emerald-600'}`}>
            {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-bold text-sm uppercase">{notification.message}</span>
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
