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

async function ensureProfile(user: User, name?: string): Promise<UserProfile | null> {
  let profile = await fetchProfile(user.id);
  if (!profile) {
    const displayName = name || user.email?.split('@')[0] || 'User';
    const { error } = await supabase.from('users').insert({
      id: user.id,
      name: displayName,
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
    let isMounted = true;

    // Helper to load profile and update state
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

    // 1. Get the current session first
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        handleSession(session);
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      });

    // 2. Listen for auth state changes (login, logout, token refresh)
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
      if (error) return error.message;
      // onAuthStateChange will handle setting user/profile
      return null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'An unexpected error occurred';
      return msg;
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
        },
      });
      if (error) return error.message;

      // If email confirmation is required, user won't have a session yet
      if (data.user && !data.session) {
        return '__confirm_email__';
      }

      // If auto-confirmed, ensure profile is created
      if (data.user && data.session) {
        await ensureProfile(data.user, name).catch(() => {});
      }

      return null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'An unexpected error occurred';
      return msg;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
