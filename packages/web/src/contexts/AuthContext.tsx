import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

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
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (email: string, password: string, name: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

async function hasNoUsers(): Promise<boolean> {
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return false;
  }
  return (count ?? 0) === 0;
}

async function ensureProfile(user: User, name?: string): Promise<UserProfile | null> {
  let profile = await fetchProfile(user.id);
  if (!profile) {
    const displayName = name || user.email?.split('@')[0] || 'User';
    const role = (await hasNoUsers()) ? 'admin' : 'cashier';
    const { error } = await supabase.from('users').insert({
      id: user.id,
      name: displayName,
      email: user.email || '',
      role,
    });
    if (error) throw new Error(error.message);
    profile = await fetchProfile(user.id);
  }
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function handleSession(session: Session | null) {
      const authUser = session?.user ?? null;
      if (!isMounted) return;

      if (authUser) {
        setUser(authUser);
        try {
          const p = await ensureProfile(authUser);
          if (isMounted) setProfile(p);
        } catch {
          if (isMounted) setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }

      if (isMounted) setLoading(false);
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => handleSession(session))
      .catch(() => {
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSession(session).catch(() => {});
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    } catch (e: unknown) {
      return e instanceof Error ? e.message : 'An unexpected error occurred';
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      });
      if (error) return error.message;
      if (data.user && !data.session) return '__confirm_email__';
      if (data.user && data.session) {
        try {
          await ensureProfile(data.user, name);
        } catch (e) {
          return e instanceof Error ? e.message : 'Failed to create profile';
        }
      }
      return null;
    } catch (e: unknown) {
      return e instanceof Error ? e.message : 'An unexpected error occurred';
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      login,
      signup,
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
