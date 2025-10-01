import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Register() {
  const nav = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) nav("/board", { replace: true });
  }, [user, nav]);

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <div className="card shadow-sm">
        <div className="card-body">
          <h1 className="h3 mb-3">Skapa konto</h1>

          <div className="alert alert-info">
            Den här demon har inte självregistrering aktiverad ännu.
            <br />
            Använd demo-konton: <strong>admin/admin</strong> eller{" "}
            <strong>user/user</strong>.
          </div>

          <Link to="/login" className="btn btn-primary">
            Gå till inloggning
          </Link>
        </div>
      </div>
    </div>
  );
}

// Route-metadata (ingen menylänk)
; (Register as any).route = { path: "/register", parent: "/" };
