import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'cashier';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (email: string, password: string, name: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('id', userId)
    .single();
  return data;
}

async function ensureProfile(user: User, name?: string): Promise<UserProfile | null> {
  let profile = await fetchProfile(user.id);
  if (!profile) {
    const emailDisplayName = user.email?.split('@')[0] || 'User';
    const { error } = await supabase.from('users').insert({
      id: user.id,
      name: name || emailDisplayName,
      email: user.email || '',
      role: 'admin',
    });
    if (!error) {
      profile = await fetchProfile(user.id);
    }
  }
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const p = await ensureProfile(u).catch(() => null);
        setProfile(p);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        ensureProfile(u).then(setProfile).catch(() => setProfile(null));
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    } catch (e: any) {
      return e?.message || 'An unexpected error occurred';
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return error.message;
      if (data.user) {
        await ensureProfile(data.user, name).catch(() => {});
      }
      return null;
    } catch (e: any) {
      return e?.message || 'An unexpected error occurred';
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
