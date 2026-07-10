import { contextBridge, ipcRenderer } from 'electron';

let sessionToken: string | null = null;

function invoke(channel: string, ...args: unknown[]) {
  return ipcRenderer.invoke(channel, sessionToken, ...args);
}

function invokePublic(channel: string, ...args: unknown[]) {
  return ipcRenderer.invoke(channel, ...args);
}

export interface ElectronAPI {
  auth: {
    login: (pin: string) => Promise<{ id: string; name: string; role: string } | null>;
    logout: () => Promise<void>;
  };
  products: {
    list: (search?: string) => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    getByBarcode: (barcode: string) => Promise<unknown>;
    create: (product: unknown) => Promise<unknown>;
    update: (id: string, product: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
    stats: () => Promise<{ total: number; lowStock: number; outOfStock: number }>;
  };
  sales: {
    create: (sale: unknown) => Promise<unknown>;
    list: (filters?: unknown) => Promise<unknown[]>;
    getWithItems: (saleId: string) => Promise<unknown>;
    todayStats: () => Promise<unknown>;
    stats: (period: string) => Promise<unknown[]>;
  };
  inventory: {
    stockIn: (entry: unknown) => Promise<unknown>;
    stockOut: (entry: unknown) => Promise<unknown>;
    adjust: (entry: unknown) => Promise<unknown>;
    history: (filters?: unknown) => Promise<unknown[]>;
    lowStock: () => Promise<unknown[]>;
  };
  customers: {
    list: (search?: string) => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    create: (customer: unknown) => Promise<unknown>;
    update: (id: string, customer: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  settings: {
    get: (key?: string) => Promise<unknown>;
    set: (key: string, value: string) => Promise<unknown>;
    setup: (setup: unknown) => Promise<unknown>;
    isSetupComplete: () => Promise<boolean>;
  };
  categories: {
    list: () => Promise<unknown[]>;
    create: (name: string) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  suppliers: {
    list: () => Promise<unknown[]>;
    create: (supplier: unknown) => Promise<unknown>;
  };
  users: {
    list: () => Promise<unknown[]>;
    create: (user: unknown) => Promise<unknown>;
  };
  receipt: {
    print: (data: unknown) => Promise<unknown>;
    testPrint: () => Promise<unknown>;
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: async (pin: string) => {
      const result = await invokePublic('auth:login', pin) as { user: { id: string; name: string; role: string }; sessionToken: string } | null;
      if (result?.sessionToken) {
        sessionToken = result.sessionToken;
        return result.user;
      }
      return null;
    },
    logout: async () => {
      if (sessionToken) await invokePublic('auth:logout', sessionToken);
      sessionToken = null;
    },
  },
  products: {
    list: (search?: string) => invoke('products:list', search),
    get: (id: string) => invoke('products:get', id),
    getByBarcode: (barcode: string) => invoke('products:getByBarcode', barcode),
    create: (product: unknown) => invoke('products:create', product),
    update: (id: string, product: unknown) => invoke('products:update', id, product),
    delete: (id: string) => invoke('products:delete', id),
    stats: () => invoke('products:stats'),
  },
  sales: {
    create: (sale: unknown) => invoke('sales:create', sale),
    list: (filters?: unknown) => invoke('sales:list', filters),
    getWithItems: (saleId: string) => invoke('sales:getWithItems', saleId),
    todayStats: () => invoke('sales:todayStats'),
    stats: (period: string) => invoke('sales:stats', period),
  },
  inventory: {
    stockIn: (entry: unknown) => invoke('inventory:stockIn', entry),
    stockOut: (entry: unknown) => invoke('inventory:stockOut', entry),
    adjust: (entry: unknown) => invoke('inventory:adjust', entry),
    history: (filters?: unknown) => invoke('inventory:history', filters),
    lowStock: () => invoke('inventory:lowStock'),
  },
  customers: {
    list: (search?: string) => invoke('customers:list', search),
    get: (id: string) => invoke('customers:get', id),
    create: (customer: unknown) => invoke('customers:create', customer),
    update: (id: string, customer: unknown) => invoke('customers:update', id, customer),
    delete: (id: string) => invoke('customers:delete', id),
  },
  settings: {
    get: (key?: string) => invoke('settings:get', key),
    set: (key: string, value: string) => invoke('settings:set', key, value),
    setup: (setup: unknown) => invokePublic('settings:setup', setup),
    isSetupComplete: () => invokePublic('settings:isSetupComplete'),
  },
  categories: {
    list: () => invoke('categories:list'),
    create: (name: string) => invoke('categories:create', name),
    delete: (id: string) => invoke('categories:delete', id),
  },
  suppliers: {
    list: () => invoke('suppliers:list'),
    create: (supplier: unknown) => invoke('suppliers:create', supplier),
  },
  users: {
    list: () => invoke('users:list'),
    create: (user: unknown) => invoke('users:create', user),
  },
  receipt: {
    print: (data: unknown) => invoke('receipt:print', data),
    testPrint: () => invoke('receipt:testPrint'),
  },
} satisfies ElectronAPI);
