// src/pages/Profile.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "react-bootstrap";
import { useAuth } from "../hooks/useAuth";
import { postsApi, type Post } from "../utils/api";
import {
  FaUserCircle,
  FaExternalLinkAlt,
  FaEdit,
  FaTrash,
  FaCommentDots,
} from "react-icons/fa";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function Profile() {
  const nav = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [myPosts, setMyPosts] = useState<Post[]>([]);

  // Om man inte är inloggad -> skicka till /login
  useEffect(() => {
    if (!authLoading && !user) {
      nav("/login", { replace: true });
    }
  }, [authLoading, user, nav]);

  const isAdmin = user?.role === "admin";

  const canManage = useMemo(
    () => (p: Post) => !!user && (user.role === "admin" || p.author === user.username),
    [user]
  );

  // Hämta mina inlägg (med comment_count inmergat via postsApi.list())
  useEffect(() => {
    if (authLoading || !user) return;

    (async () => {
      setState("loading");
      setError(null);
      try {
        const list = await postsApi.list(); // utan filter -> with-count används under huven
        const mine = list
          .filter((p) => p.author === user.username)
          .sort((a, b) => (a.created < b.created ? 1 : -1));
        setMyPosts(mine);
        setState("ready");
      } catch (e: any) {
        setError(e?.message ?? "Kunde inte hämta dina inlägg.");
        setState("error");
      }
    })();
  }, [authLoading, user]);

  async function removePost(id: number) {
    if (!confirm("Ta bort inlägget?")) return;
    try {
      await postsApi.delete(id);
      setMyPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Kunde inte ta bort inlägget.");
    }
  }

  if (authLoading) {
    return (
      <div className="container py-5">Laddar…</div>
    );
  }

  if (!user) return null; // redirect sker redan

  return (
    <div className="container py-5" style={{ maxWidth: 820 }}>
      {/* Header-kort */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body d-flex align-items-center gap-3">
          <FaUserCircle size={56} className="text-primary" aria-hidden />
          <div>
            <h1 className="h4 mb-1">{user.username}</h1>
            <Badge
              bg={isAdmin ? "warning" : "secondary"}
              text={isAdmin ? "dark" : undefined}
              title={`Roll: ${user.role}`}
            >
              {user.role}
            </Badge>
          </div>
          <div className="ms-auto d-flex gap-2">
            <Link to="/board" className="btn btn-sm btn-outline-primary">
              Till Board
            </Link>
            <button className="btn btn-sm btn-outline-danger" onClick={() => logout()}>
              Logga ut
            </button>
          </div>
        </div>
      </div>

      {/* Felmeddelande */}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Mina inlägg */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 mb-0">Mina inlägg</h2>
        <Link to="/board" className="btn btn-sm btn-success">Skapa nytt</Link>
      </div>

      {state === "loading" && (
        <div className="alert alert-secondary">Hämtar dina inlägg…</div>
      )}

      {state === "ready" && myPosts.length === 0 && (
        <div className="alert alert-light border">
          Du har inte skapat några inlägg ännu. <Link to="/board">Gå till Board</Link> och skriv ditt första!
        </div>
      )}

      {state === "ready" && myPosts.length > 0 && (
        <div className="vstack gap-3">
          {myPosts.map((p) => (
            <article key={p.id} className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h3 className="h6 mb-1">{p.title}</h3>
                    <div className="small text-muted">
                      Skapad: {new Date(p.created.replace(" ", "T")).toLocaleString()}
                      {p.updated ? ` · Uppdaterad: ${new Date(p.updated.replace(" ", "T")).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <Link to={`/board/${p.id}`} className="btn btn-sm btn-outline-primary">
                      <FaExternalLinkAlt className="me-1" /> Öppna
                    </Link>
                    {canManage(p) && (
                      <>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => nav(`/board?edit=${p.id}#post-${p.id}`)}
                        >
                          <FaEdit className="me-1" /> Redigera
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removePost(p.id)}
                        >
                          <FaTrash className="me-1" /> Ta bort
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="mb-0 mt-2 text-muted">
                  <FaCommentDots className="me-2" />
                  {typeof p.comment_count === "number" ? `${p.comment_count} kommentarer` : "Kommentarer: –"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// Route-metadata
(Profile as any).route = {
  path: "/profile",
  parent: "/",
  index: 99,
};
