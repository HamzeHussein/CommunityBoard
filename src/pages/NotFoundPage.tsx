import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="container py-5 d-flex align-items-center justify-content-center" style={{ minHeight: "70vh" }}>
      <div className="text-center">
        <div className="display-1 fw-bold text-primary mb-3">404</div>
        <h1 className="h4 mb-3">Sidan kunde inte hittas</h1>
        <p className="text-muted mb-4">
          Oops! Länken kan vara fel, eller sidan kan ha tagits bort.
        </p>
        <div className="d-flex flex-wrap gap-2 justify-content-center">
          <Link to="/" className="btn btn-primary">
            ← Till startsidan
          </Link>
          <Link to="/board" className="btn btn-outline-secondary">
            Gå till Board
          </Link>
        </div>
      </div>
    </div>
  );
}

(NotFoundPage as any).route = {
  path: "*",
  parent: "/",
};
