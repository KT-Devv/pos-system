import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { api } from '@/lib/ipc';

interface UserProfile {
  id: string;
  name: string;
  role: 'admin' | 'cashier';
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  login: (pin: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading] = useState(false);

  const login = useCallback(async (pin: string): Promise<string | null> => {
    try {
      const result = await api.auth.login(pin);
      if (result) {
        setUser(result as UserProfile);
        return null;
      }
      return 'Invalid PIN';
    } catch (e: unknown) {
      return e instanceof Error ? e.message : 'Login failed';
    }
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAdmin: user?.role === 'admin',
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
