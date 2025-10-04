import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Alert, Badge, Card, Spinner } from "react-bootstrap";
import { useAuth } from "../hooks/useAuth";
import { commentsApi, type Comment } from "../utils/api";

type Post = {
  id: number;
  title: string;
  content: string;
  category?: string | null;
  author: string;
  created?: string | null;
  updated?: string | null;
  comment_count?: number;
};

function formatTime(iso?: string | null) {
  if (!iso) return "";
  const s = iso.includes("T") ? iso : iso.replace(" ", "T");
  const d = new Date(s);
  return isNaN(+d) ? iso : d.toLocaleString();
}

export default function PostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- comments state (single-post) ---
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newAuthor, setNewAuthor] = useState("");
  const [newContent, setNewContent] = useState("");

  // ---- load post (with fallback) ----
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/posts/${id}`, { credentials: "include" });
        if (res.ok) {
          const data: Post = await res.json();
          if (alive) setPost(data);
        } else {
          const resList = await fetch(`/api/posts`, { credentials: "include" });
          if (!resList.ok) throw new Error("Misslyckades att hämta inlägg.");
          const list: Post[] = await resList.json();
          const found = list.find((p) => String(p.id) === String(id)) || null;
          if (alive) {
            if (found) setPost(found);
            else setError("Inlägget kunde inte hittas.");
          }
        }
      } catch {
        if (alive) setError("Något gick fel när inlägget skulle hämtas.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  // ---- load comments lazily when opened ----
  async function ensureCommentsLoaded() {
    if (!post || comments.length > 0) return;
    try {
      setCommentsLoading(true);
      const list = await commentsApi.listByPost(post.id);
      setComments(list);
    } catch {
      // mjuk-fail (visa bara tomt)
    } finally {
      setCommentsLoading(false);
    }
  }

  function toggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next) ensureCommentsLoaded();
  }

  async function addComment() {
    if (!post) return;
    const author = (user?.username || newAuthor || "").trim();
    const content = newContent.trim();

    if (!content) {
      alert("Kommentarfältet är tomt.");
      return;
    }
    if (!author) {
      alert("Ange namn för kommentaren.");
      return;
    }

    try {
      const { id } = await commentsApi.create(post.id, { author, content });
      const created: Comment = {
        id,
        post_id: post.id,
        author,
        content,
        created: new Date().toISOString().slice(0, 19).replace("T", " "),
      };
      setComments((prev) => [created, ...prev]);
      setNewContent("");
      if (!user) setNewAuthor("");
    } catch {
      alert("Kunde inte skapa kommentaren.");
    }
  }

  async function deleteComment(commentId: number) {
    if (!post) return;
    if (!confirm("Ta bort kommentaren?")) return;
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      alert("Kunde inte ta bort kommentaren.");
    }
  }

  if (loading) {
    return (
      <div className="container my-4">
        <Spinner animation="border" role="status" aria-label="Laddar">
          <span className="visually-hidden">Laddar…</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container my-4">
        <Alert variant="danger" className="d-flex justify-content-between align-items-center">
          <div>{error}</div>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={() => navigate(-1)}
          >
            Tillbaka
          </button>
        </Alert>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container my-4">
        <Alert variant="warning">Inlägget saknas.</Alert>
      </div>
    );
  }

  const isOwner = user && user.username === post.author;
  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!isOwner;

  return (
    <div className="container my-4">
      <Card className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div>
              <Card.Title as="h1" className="h3 mb-1">
                {post.title}
              </Card.Title>
              <div className="text-muted small">
                av <strong>{post.author ?? "okänd"}</strong> · {formatTime(post.created)}
                {post.updated ? <> · uppdaterad {formatTime(post.updated)}</> : null}
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              {post.category ? <Badge bg="success">{post.category}</Badge> : null}
              <Link className="btn btn-sm btn-outline-secondary" to="/board">
                Till Board
              </Link>
            </div>
          </div>

          <hr />

          {/* normal textstorlek */}
          <div style={{ whiteSpace: "pre-wrap" }}>
            {post.content}
          </div>

          {canEdit ? (
            <>
              <hr />
              <div className="d-flex gap-2">
                <Link className="btn btn-primary" to={`/board?edit=${post.id}`}>
                  Redigera
                </Link>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    if (!confirm("Är du säker på att du vill ta bort inlägget?")) return;
                    const res = await fetch(`/api/posts/${post.id}`, {
                      method: "DELETE",
                      credentials: "include",
                    });
                    if (res.ok) navigate("/board");
                    else alert("Kunde inte ta bort inlägget.");
                  }}
                >
                  Ta bort
                </button>
              </div>
            </>
          ) : null}

          {/* --- Comments --- */}
          <hr />
          <div className="d-flex align-items-center gap-2 mb-2">
            <button className="btn btn-sm btn-outline-primary" onClick={toggleComments}>
              {commentsOpen ? "Dölj kommentarer" : "Visa kommentarer"}
              {typeof post.comment_count === "number" ? ` (${post.comment_count})` : ""}
            </button>
          </div>

          {commentsOpen && (
            <div>
              {/* Add comment */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <div className="row g-2 align-items-end">
                    {!user && (
                      <div className="col-md-4">
                        <label className="form-label">Namn</label>
                        <input
                          className="form-control"
                          value={newAuthor}
                          onChange={(e) => setNewAuthor(e.target.value)}
                          placeholder="Skriv ditt namn"
                        />
                      </div>
                    )}
                    <div className={user ? "col-12" : "col-md-8"}>
                      <label className="form-label">Kommentar</label>
                      <input
                        className="form-control"
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        placeholder="Skriv en kommentar…"
                      />
                    </div>
                  </div>
                  <button
                    className="btn btn-primary mt-2"
                    onClick={addComment}
                    disabled={commentsLoading}
                  >
                    Skicka
                  </button>
                </div>
              </div>

              {/* List comments */}
              {commentsLoading ? (
                <div className="text-muted">Laddar kommentarer…</div>
              ) : comments.length === 0 ? (
                <div className="text-muted">Inga kommentarer ännu.</div>
              ) : (
                <div className="vstack gap-2">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="border rounded p-2 d-flex justify-content-between align-items-start"
                    >
                      <div>
                        <div className="small text-muted">
                          <strong>{c.author}</strong> · {formatTime(c.created)}
                        </div>
                        <div>{c.content}</div>
                      </div>
                      {isAdmin && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteComment(c.id)}
                        >
                          Ta bort
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

(PostPage as any).route = {
  path: "/board/:id",
};
