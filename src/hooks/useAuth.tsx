import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  email: string;
  nom_complet: string | null;
  role: "admin" | "tiers";
  actif: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // defer profile fetch to avoid deadlocks
        setTimeout(() => {
          void fetchProfile(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
      }
    });

    // 2. Then existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        void fetchProfile(data.session.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    let { data } = await supabase
      .from("profiles")
      .select("id, email, nom_complet, role, actif")
      .eq("id", userId)
      .maybeSingle();
    if (!data) {
      const { data: ensured } = await supabase.rpc("ensure_current_profile");
      if (ensured) {
        data = {
          id: ensured.id,
          email: ensured.email,
          nom_complet: ensured.nom_complet,
          role: ensured.role,
          actif: ensured.actif,
        };
      }
    }
    if (data) setProfile(data as Profile);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
