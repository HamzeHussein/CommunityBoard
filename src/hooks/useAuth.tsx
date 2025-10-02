// src/hooks/useAuth.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type JSX,
} from "react";
import { authApi, type AuthUser } from "../utils/api";

// Typ för contexten
type AuthContextType = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void; // ✅ lägg till denna
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

// Skapa context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Hämta nuvarande användare från backend (cookie-baserad session)
  const refresh = async () => {
    try {
      const u = await authApi.me();
      setUser(u);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, []);

  async function login(username: string, password: string) {
    const u = await authApi.login(username, password);
    setUser(u);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, login, logout, refresh }} // ✅ expose setUser
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook för att hämta context
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// === Guards för sidor ===
export function RequireAuth({
  children,
  fallback,
}: {
  children: JSX.Element;
  fallback?: JSX.Element;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div>Laddar...</div>;
  if (!user) return fallback ?? <div>Du måste logga in</div>;
  return children;
}

export function RequireAdmin({
  children,
  fallback,
}: {
  children: JSX.Element;
  fallback?: JSX.Element;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div>Laddar...</div>;
  if (!user || user.role !== "admin")
    return fallback ?? <div>Endast admin har tillgång</div>;
  return children;
}
