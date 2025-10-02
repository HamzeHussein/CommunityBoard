import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../utils/api";

export default function Register() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) nav("/board", { replace: true });
  }, [user, nav]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newUser = await authApi.register(username, password);
      setUser(newUser);
      nav("/board");
    } catch (err: any) {
      setError(err.message || "Registrering misslyckades");
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <div className="card shadow-sm">
        <div className="card-body">
          <h1 className="h3 mb-3">Skapa konto</h1>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Användarnamn</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Lösenord</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-100">
              Registrera
            </button>
          </form>

          <div className="mt-3">
            Har du redan konto? <Link to="/login">Logga in här</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

(Register as any).route = { path: "/register", parent: "/" };
