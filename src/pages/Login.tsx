import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../utils/api";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const nav = useNavigate();
  const { user, loading, refresh } = useAuth();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // om inloggad redan -> hoppa till /board
  useEffect(() => {
    if (user) nav("/board", { replace: true });
  }, [user, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.login(username.trim(), password);
      await refresh(); // uppdatera auth-context
      nav("/board", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Inloggning misslyckades.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="container py-5">Laddar…</div>;

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <div className="card shadow-sm">
        <div className="card-body">
          <h1 className="h3 mb-4">Logga in</h1>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={onSubmit} className="vstack gap-3">
            <div>
              <label className="form-label">Användarnamn</label>
              <input
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="form-label">Lösenord</label>
              <input
                className="form-control"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button className="btn btn-primary w-100" disabled={submitting}>
              {submitting ? "Loggar in…" : "Logga in"}
            </button>
          </form>

          <div className="mt-3">
            <small className="text-muted">
              Har du inget konto? <Link to="/register">Registrera här</Link>
            </small>
          </div>

          <hr className="my-4" />
          <small className="text-muted">
            Demo-konton i backend seed: <strong>admin/admin</strong> (admin) och{" "}
            <strong>user/user</strong> (user).
          </small>
        </div>
      </div>
    </div>
  );
}

// Route-metadata (ingen menylänk)
; (Login as any).route = { path: "/login", parent: "/" };
