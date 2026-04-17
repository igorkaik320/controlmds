import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "operador" | "conferente";

interface Profile {
  display_name: string;
  role: string;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: AppRole;
  isPending: boolean;
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
  const [userRole, setUserRole] = useState<AppRole>("operador");
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let initialised = false;

    const loadUserData = async (userId: string) => {
      await Promise.all([fetchProfile(userId), fetchRole(userId)]);
      if (isMounted) setLoading(false);
    };

    const refreshUserDataSilently = async (userId: string) => {
      await Promise.all([fetchProfile(userId), fetchRole(userId)]);
    };

    // Get initial session first to avoid race conditions
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      const nextUser = currentSession?.user ?? null;

      setSession(currentSession);
      setUser(nextUser);
      initialised = true;

      if (nextUser) {
        void loadUserData(nextUser.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      const nextUser = nextSession?.user ?? null;

      setSession(nextSession);

      // On INITIAL_SESSION before our getSession resolves, skip to avoid double-processing
      if (event === "INITIAL_SESSION" && !initialised) return;

      // Token refresh or tab-focus re-auth: never show loading, just silently refresh data
      if (event === "TOKEN_REFRESHED") {
        if (nextUser) void refreshUserDataSilently(nextUser.id);
        return;
      }

      setUser((currentUser) => {
        const currentUserId = currentUser?.id;
        const nextUserId = nextUser?.id ?? null;

        if (!nextUser) {
        setProfile(null);
          setUserRole("operador");
          setIsPending(false);
          setLoading(false);
          return null;
        }

        // Only show loading for actual user changes (login/logout), not tab switches
        if (!currentUserId || currentUserId !== nextUserId) {
          setLoading(true);
          void loadUserData(nextUserId!);
        } else if (event === "SIGNED_IN") {
          // Same user re-signed in (e.g. tab refocus) — silent refresh only
          void refreshUserDataSilently(nextUserId!);
        }

        return nextUser;
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("display_name, role").eq("user_id", userId).single();

    if (data) setProfile(data);
  }

  async function fetchRole(userId: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);

    if (data && data.length > 0) {
      setIsPending(false);
      const roles = data.map((r) => r.role as AppRole);
      if (roles.includes("admin")) setUserRole("admin");
      else if (roles.includes("conferente")) setUserRole("conferente");
      else setUserRole("operador");
    } else {
      // Usuários sem roles definidos são tratados como operadores e não ficam pendentes
      setIsPending(false);
      setUserRole("operador");
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
  const signIn = async (email: string, password: string) => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const diag = {
      app: "ControlMDS",
      url: SUPABASE_URL,
      origin: typeof window !== "undefined" ? window.location.origin : "n/a",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
      online: typeof navigator !== "undefined" ? navigator.onLine : "n/a",
      timestamp: new Date().toISOString(),
    };

    // 1) Pré-checagem de conectividade direta com o Supabase (isola DNS/firewall/extensões)
    console.groupCollapsed("%c[ControlMDS] Diagnóstico de Login", "color:#2563eb;font-weight:bold");
    console.log("Ambiente:", diag);
    try {
      const probeStart = performance.now();
      const probe = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        method: "GET",
        cache: "no-store",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      });
      console.log(
        `Probe /auth/v1/health → status ${probe.status} em ${Math.round(performance.now() - probeStart)}ms`,
      );
    } catch (probeErr: any) {
      console.error("❌ Falha ao acessar Supabase ANTES do login:", {
        name: probeErr?.name,
        message: probeErr?.message,
        cause: probeErr?.cause,
      });
      console.warn(
        "Causas prováveis: DNS local (tente 1.1.1.1/8.8.8.8), firewall corporativo, antivírus, extensão do navegador, VPN ou bloqueio do provedor.",
      );
    }

    const attempt = async () => {
      const start = performance.now();
      try {
        const result = await supabase.auth.signInWithPassword({ email, password });
        console.log(
          `signInWithPassword finalizado em ${Math.round(performance.now() - start)}ms`,
          result.error ? { error: result.error } : "sucesso",
        );
        return result;
      } catch (e: any) {
        console.error("Exceção lançada por signInWithPassword:", {
          name: e?.name,
          message: e?.message,
          stack: e?.stack,
          cause: e?.cause,
        });
        return { data: null as any, error: e };
      }
    };

    let { error } = await attempt();

    const isNetworkError = (msg?: string) =>
      !!msg && /failed to fetch|networkerror|err_name_not_resolved|load failed|network request failed/i.test(msg);

    // Retry once on transient network errors (DNS hiccup, fetch abort, etc.)
    if (error && isNetworkError(error.message)) {
      console.warn("🔁 Erro de rede detectado, tentando novamente em 800ms...");
      await new Promise((r) => setTimeout(r, 800));
      ({ error } = await attempt());
    }

    if (error && isNetworkError(error.message)) {
      console.error("❌ Login falhou por erro de rede após retry. Diagnóstico final:", diag);
      console.groupEnd();
      return {
        error: {
          ...error,
          message:
            "Não foi possível conectar ao servidor. Abra o DevTools (F12) → aba Console e envie o bloco '[ControlMDS] Diagnóstico de Login' para o suporte. Tente também: (1) Ctrl+Shift+R, (2) aba anônima, (3) trocar DNS para 1.1.1.1, (4) desativar VPN/antivírus.",
        },
      };
    }

    if (error) {
      console.warn("Login retornou erro (não é rede):", error.message);
    }
    console.groupEnd();
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => {
    if (userRole === "admin") return true;
    return userRole === role;
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, userRole, isPending, loading, signUp, signIn, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

