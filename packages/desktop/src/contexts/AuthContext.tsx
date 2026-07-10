import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from '../lib/ipc';

export interface AuthUser {
  id: string;
  name: string;
  role: 'admin' | 'cashier';
}

interface AuthContextType {
  user: AuthUser | null;
  login: (pin: string) => Promise<string | null>;
  logout: () => Promise<void>;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  const login = async (pin: string): Promise<string | null> => {
    setLoading(true);
    try {
      const result = await api.auth.login(pin);
      if (result) {
        setUser({ id: result.id, name: result.name, role: result.role as 'admin' | 'cashier' });
        return null;
      }
      return 'Invalid PIN';
    } catch (e) {
      return e instanceof Error ? e.message : 'Login failed';
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
