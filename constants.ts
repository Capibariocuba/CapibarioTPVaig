
import { Currency, User, Role, BusinessConfig, Product, Client } from './types';

// Función para generar un HWID persistente simulado para el navegador
export const generateHwid = () => {
    let hwid = localStorage.getItem('_app_hwid');
    if (!hwid) {
        hwid = 'HWID-' + Math.random().toString(36).substr(2, 9).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
        localStorage.setItem('_app_hwid', hwid);
    }
    return hwid;
};

// Logo Oficial Capibario TPV (Identidad fija del Software)
export const CAPIBARIO_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cdefs%3E%3ClinearGradient id='a' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%230ea5e9;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%230c4a6e;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='512' height='512' rx='128' fill='url(%23a)'/%3E%3Cpath d='M350 200c0-50-40-80-90-80s-100 30-100 80v120h190V200z' fill='%23fff' opacity='.2'/%3E%3Ccircle cx='200' cy='200' r='20' fill='%23fff'/%3E%3Crect x='160' y='340' width='192' height='40' rx='10' fill='%23f97316'/%3E%3Ctext x='256' y='368' font-family='Arial' font-weight='bold' font-size='24' text-anchor='middle' fill='%23fff'%3ETPV%3C/text%3E%3C/svg%3E";

// LLAVES MAESTRAS DE 24 HORAS
export const MASTER_KEYS = {
    GOLD: 'GOLD-MASTER-24H',
    SAPPHIRE: 'SAPPHIRE-MASTER-24H',
    PLATINUM: 'PLATINUM-MASTER-24H'
};

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  name: "Mi Negocio",
  showName: true,
  abbreviation: "MN",
  identifier: "MN-001",
  ticketSequence: 1,
  address: "Dirección del Negocio",
  showAddress: true,
  taxId: "", 
  showTaxId: true,
  phone: "+53 00000000",
  showPhone: true,
  email: "negocio@ejemplo.com",
  showEmail: true,
  primaryCurrency: Currency.CUP,
  footerMessage: "Gracias por su compra",
  showFooter: true,
  logo: undefined,
  licenseStatus: "TRIAL",
  activeModules: ['POS', 'INVENTORY', 'DASHBOARD', 'LEDGER', 'CONFIGURATION'],
  paymentMethods: [
    { id: 'CASH', label: 'Efectivo', enabled: true, showInTicket: true },
    { id: 'TRANSFER', label: 'Transferencia', enabled: true, showInTicket: true },
    { id: 'CARD', label: 'Tarjeta', enabled: false, showInTicket: true },
    { id: 'CRYPTO', label: 'Cripto', enabled: false, showInTicket: false },
    { id: 'TROPIPAY', label: 'Tropipay', enabled: false, showInTicket: false },
    { id: 'QVAPAY', label: 'QvaPay', enabled: false, showInTicket: false },
  ],
  printerConfig: {
    name: 'Generica 80mm',
    paperSize: '80mm'
  },
  scannerConfig: {
    name: 'USB Scanner',
    enabled: true
  },
  security: {
    hwid: generateHwid(),
    lastSystemTime: new Date().toISOString(),
    installationDate: new Date().toISOString()
  },
  license: undefined, 
  lastUpdated: new Date().toISOString(),
  // Valores por defecto Empresa Fase 2
  googleAccount: { email: '', connected: false },
  posTerminals: [],
  peripherals: { printerMode: 'WEB', barcodeScannerMode: 'KEYBOARD' },
  isWebCatalogActive: false,
  webCatalogPort: 8088,
  showQrTransfer: false,
  qrTransferImageData: undefined,
  showQrEnzona: false,
  qrEnzonaImageData: undefined
};

export const MOCK_USERS: User[] = [
  { id: 'admin-1', name: 'Administrador', pin: '1234', role: Role.ADMIN }
];

export const MOCK_PRODUCTS: Product[] = [];

export const MOCK_CLIENTS: Client[] = [];

export const CATEGORIES = ['Todo', 'Alimentos', 'Bebidas', 'Limpieza', 'Otros'];
