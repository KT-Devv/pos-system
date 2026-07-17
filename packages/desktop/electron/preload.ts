import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  auth: {
    login: (pin: string) => Promise<any>;
  };
  products: {
    list: (search?: string) => Promise<any[]>;
    get: (id: string) => Promise<any>;
    getByBarcode: (barcode: string) => Promise<any>;
    create: (product: any) => Promise<any>;
    update: (id: string, product: any) => Promise<any>;
    delete: (id: string) => Promise<any>;
    stats: () => Promise<{ total: number; lowStock: number; outOfStock: number }>;
  };
  sales: {
    create: (sale: any) => Promise<any>;
    list: (filters?: any) => Promise<any[]>;
    getWithItems: (saleId: string) => Promise<any>;
    todayStats: () => Promise<any>;
    stats: (period: string) => Promise<any[]>;
  };
  inventory: {
    stockIn: (entry: any) => Promise<any>;
    stockOut: (entry: any) => Promise<any>;
    adjust: (entry: any) => Promise<any>;
    history: (filters?: any) => Promise<any[]>;
    lowStock: () => Promise<any[]>;
  };
  customers: {
    list: (search?: string) => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (customer: any) => Promise<any>;
    update: (id: string, customer: any) => Promise<any>;
    delete: (id: string) => Promise<any>;
  };
  settings: {
    get: (key?: string) => Promise<any>;
    set: (key: string, value: string) => Promise<any>;
    setup: (setup: any) => Promise<any>;
  };
  categories: {
    list: () => Promise<any[]>;
    create: (name: string) => Promise<any>;
    delete: (id: string) => Promise<any>;
  };
  suppliers: {
    list: () => Promise<any[]>;
    create: (supplier: any) => Promise<any>;
  };
  receipt: {
    print: (data: any) => Promise<any>;
    testPrint: () => Promise<any>;
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: (pin: string) => ipcRenderer.invoke('auth:login', pin),
  },
  products: {
    list: (search?: string) => ipcRenderer.invoke('products:list', search),
    get: (id: string) => ipcRenderer.invoke('products:get', id),
    getByBarcode: (barcode: string) => ipcRenderer.invoke('products:getByBarcode', barcode),
    create: (product: any) => ipcRenderer.invoke('products:create', product),
    update: (id: string, product: any) => ipcRenderer.invoke('products:update', id, product),
    delete: (id: string) => ipcRenderer.invoke('products:delete', id),
    stats: () => ipcRenderer.invoke('products:stats'),
  },
  sales: {
    create: (sale: any) => ipcRenderer.invoke('sales:create', sale),
    list: (filters?: any) => ipcRenderer.invoke('sales:list', filters),
    getWithItems: (saleId: string) => ipcRenderer.invoke('sales:getWithItems', saleId),
    todayStats: () => ipcRenderer.invoke('sales:todayStats'),
    stats: (period: string) => ipcRenderer.invoke('sales:stats', period),
  },
  inventory: {
    stockIn: (entry: any) => ipcRenderer.invoke('inventory:stockIn', entry),
    stockOut: (entry: any) => ipcRenderer.invoke('inventory:stockOut', entry),
    adjust: (entry: any) => ipcRenderer.invoke('inventory:adjust', entry),
    history: (filters?: any) => ipcRenderer.invoke('inventory:history', filters),
    lowStock: () => ipcRenderer.invoke('inventory:lowStock'),
  },
  customers: {
    list: (search?: string) => ipcRenderer.invoke('customers:list', search),
    get: (id: string) => ipcRenderer.invoke('customers:get', id),
    create: (customer: any) => ipcRenderer.invoke('customers:create', customer),
    update: (id: string, customer: any) => ipcRenderer.invoke('customers:update', id, customer),
    delete: (id: string) => ipcRenderer.invoke('customers:delete', id),
  },
  settings: {
    get: (key?: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    setup: (setup: any) => ipcRenderer.invoke('settings:setup', setup),
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (name: string) => ipcRenderer.invoke('categories:create', name),
    delete: (id: string) => ipcRenderer.invoke('categories:delete', id),
  },
  suppliers: {
    list: () => ipcRenderer.invoke('suppliers:list'),
    create: (supplier: any) => ipcRenderer.invoke('suppliers:create', supplier),
  },
  receipt: {
    print: (data: any) => ipcRenderer.invoke('receipt:print', data),
    testPrint: () => ipcRenderer.invoke('receipt:testPrint'),
  },
} satisfies ElectronAPI);
