import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'operador' | 'conferente';

interface Profile {
  display_name: string;
  role: string;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: AppRole;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<AppRole>('operador');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadUserData = async (userId: string) => {
      await Promise.all([fetchProfile(userId), fetchRole(userId)]);
      if (isMounted) setLoading(false);
    };

    const refreshUserDataSilently = async (userId: string) => {
      await Promise.all([fetchProfile(userId), fetchRole(userId)]);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      const currentUserId = user?.id;
      const nextUserId = nextUser?.id;

      setSession(session);
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setUserRole('operador');
        setLoading(false);
        return;
      }

      // Só entra em loading se for troca real de usuário ou primeiro carregamento.
      if (!currentUserId || currentUserId !== nextUserId) {
        setLoading(true);
        loadUserData(nextUser.id);
        return;
      }

      // Em eventos como TOKEN_REFRESHED ao voltar para a aba,
      // atualiza silenciosamente sem desmontar a tela.
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        refreshUserDataSilently(nextUser.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const nextUser = session?.user ?? null;

      setSession(session);
      setUser(nextUser);

      if (nextUser) {
        loadUserData(nextUser.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [user?.id]);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, role')
      .eq('user_id', userId)
      .single();

    if (data) setProfile(data);
  }

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (data && data.length > 0) {
      const roles = data.map((r) => r.role as AppRole);
      if (roles.includes('admin')) setUserRole('admin');
      else if (roles.includes('conferente')) setUserRole('conferente');
      else setUserRole('operador');
    } else {
      setUserRole('operador');
    }
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => {
    if (userRole === 'admin') return true;
    return userRole === role;
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, userRole, loading, signUp, signIn, signOut, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
