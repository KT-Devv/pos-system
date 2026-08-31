import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from '../lib/ipc';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  sessionToken: string | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = async (pin: string): Promise<boolean> => {
    setLoading(true);
    try {
      const result = await api.auth.login(pin);
      if (result?.user) {
        setUser(result.user);
        setSessionToken(result.sessionToken);
        return true;
      }
      setUser(null);
      setSessionToken(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    if (sessionToken) {
      api.auth.logout(sessionToken).catch(() => undefined);
    }
    setSessionToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, sessionToken, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
