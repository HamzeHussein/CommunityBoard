// src/pages/Register.tsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../utils/api";

export default function Register() {
  const nav = useNavigate();
  const { user, login } = useAuth(); // logga in direkt efter registrering

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) nav("/board", { replace: true });
  }, [user, nav]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Använd API-wrappern (kräver /api/auth/register i backend)
      await authApi.register(username.trim(), password);
      // Efter lyckad registrering → logga in användaren
      await login(username, password);
      nav("/board", { replace: true });
    } catch (err: any) {
      setError(err.message || "Kunde inte skapa användare");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <div className="card shadow-sm">
        <div className="card-body">
          <h1 className="h3 mb-3">Skapa konto</h1>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit} className="vstack gap-3">
            <div>
              <label className="form-label">Användarnamn</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="form-label">Lösenord</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? "Skapar konto..." : "Registrera"}
            </button>
          </form>

          <div className="mt-3">
            Har du redan ett konto? <Link to="/login">Logga in här</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Route-metadata
; (Register as any).route = { path: "/register", parent: "/" };
