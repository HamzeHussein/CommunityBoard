// src/pages/Profile.tsx
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Badge } from "react-bootstrap";

export default function Profile() {
  const nav = useNavigate();
  const { user, loading, logout } = useAuth();

  // Om man inte är inloggad -> skicka till /login
  useEffect(() => {
    if (!loading && !user) {
      nav("/login", { replace: true });
    }
  }, [loading, user, nav]);

  if (loading) {
    return <div className="container py-5">Laddar…</div>;
  }

  if (!user) return null; // kortslut när redirect sker

  const isAdmin = user.role === "admin";

  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center"
              style={{
                width: 64,
                height: 64,
                background: "#eef2ff",
                fontSize: 32,
              }}
              aria-hidden
            >
              👤
            </div>
            <div>
              <h1 className="h4 mb-1">{user.username}</h1>
              <Badge bg={isAdmin ? "warning" : "secondary"} text={isAdmin ? "dark" : undefined}>
                {user.role}
              </Badge>
            </div>
          </div>

          <hr />

          <div className="mb-3">
            <h2 className="h6 text-uppercase text-muted">Konto</h2>
            <ul className="mb-0">
              <li><strong>Användarnamn:</strong> {user.username}</li>
              <li>
                <strong>Roll:</strong> {user.role}{" "}
                {isAdmin ? "(har adminbehörigheter)" : "(vanlig användare)"}
              </li>
            </ul>
          </div>

          <div className="alert alert-info d-flex gap-2 align-items-center">
            <span>ℹ️</span>
            <div className="small mb-0">
              <strong>Tips:</strong> Som {isAdmin ? "admin" : "användare"} kan du
              {isAdmin ? " redigera och ta bort alla inlägg, exportera data och moderera kommentarer." : " skapa inlägg, redigera dina egna och kommentera."}
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mt-3">
            <Link to="/board" className="btn btn-primary">
              Till Board
            </Link>
            <button
              className="btn btn-outline-danger"
              onClick={() => logout()}
              title="Logga ut"
            >
              Logga ut
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Route-metadata (ingen menylänk här – vi kan lägga en konditionell länk i Header om du vill)
; (Profile as any).route = {
  path: "/profile",
  parent: "/",
  index: 99,
};
