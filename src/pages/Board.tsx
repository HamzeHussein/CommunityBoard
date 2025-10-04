// src/pages/Board.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { postsApi, commentsApi, type Post, type Comment } from "../utils/api";
import { useAuth } from "../hooks/useAuth";
import {
  FaDownload,
  FaSearch,
  FaSync,
  FaPlus,
  FaEdit,
  FaTrash,
  FaCommentDots,
  FaChevronDown,
  FaChevronUp,
  FaFilter,
  FaInfoCircle,
  FaLink,
  FaClipboardCheck,
} from "react-icons/fa";

export default function Board() {
  const { user, loading: authLoading } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<
    Partial<Pick<Post, "title" | "content" | "category">>
  >({});
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentsOpen, setCommentsOpen] = useState<Record<number, boolean>>({});
  const [newComment, setNewComment] = useState<
    Record<number, { author: string; content: string }>
  >({});

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const canEditPost = useMemo(
    () => (p: Post) => !!user && (user.role === "admin" || user.username === p.author),
    [user]
  );

  function fmt(dt?: string | null) {
    if (!dt) return "";
    const d = new Date((dt || "").replace(" ", "T"));
    return isNaN(+d) ? (dt || "") : d.toLocaleString();
  }

  function categoryClass(cat?: string) {
    if (!cat) return "text-bg-secondary";
    const c = cat.toLowerCase();
    if (c.includes("info")) return "text-bg-secondary";
    if (c.includes("bug") || c.includes("varning")) return "text-bg-danger";
    if (c.includes("nyhet") || c.includes("news")) return "text-bg-success";
    if (c.includes("fråga") || c.includes("question")) return "text-bg-warning";
    return "text-bg-secondary";
  }

  function postPermalink(id: number) {
    const origin = window.location.origin;
    return `${origin}/board#post-${id}`;
  }

  async function copyPostLink(id: number) {
    const url = postPermalink(id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      alert("Kunde inte kopiera länk.");
    }
  }

  // --- Hämta inlägg + merga in comment_count från /with-count ---
  async function fetchPosts() {
    setLoading(true);
    setError(null);
    try {
      // 1) Hämta listan (respekterar din sök/filterlogik i postsApi)
      const list = await postsApi.list(search, category);

      // 2) Hämta alla counts och merga in (så vi får (N) även när sök/filter används)
      let merged = list;
      try {
        const res = await fetch(`/api/posts/with-count`, { credentials: "include" });
        if (res.ok) {
          const counts: Array<Pick<Post, "id" | "comment_count">> = await res.json();
          const map = new Map<number, number>();
          counts.forEach((p) => {
            if (typeof p.comment_count === "number") map.set(p.id, p.comment_count);
          });
          merged = list.map((p) => ({ ...p, comment_count: map.get(p.id) ?? p.comment_count }));
        }
      } catch {
        // mjuk-fail: om counts inte går att hämta lämnar vi listan som är
      }

      setPosts(merged);
    } catch (e: any) {
      setError(e?.message ?? "Kunde inte hämta inlägg.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Öppna edit-läge automatiskt om vi kommer från detaljsidan med ?edit=ID
  useEffect(() => {
    const edit = searchParams.get("edit");
    if (loading || !edit) return;

    const id = Number(edit);
    if (Number.isNaN(id)) return;

    const p = posts.find((x) => x.id === id);
    if (!p) return;

    startEdit(p);

    setTimeout(() => {
      document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [loading, posts, searchParams, setSearchParams]);

  function handleSearch() {
    fetchPosts();
  }
  function handleReset() {
    setSearch("");
    setCategory("");
    setTimeout(() => fetchPosts(), 0);
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !newCategory.trim()) {
      setError("Titel, kategori och innehåll krävs.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await postsApi.create({
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory.trim(),
      });
      setNewTitle("");
      setNewCategory("");
      setNewContent("");
      await fetchPosts();
    } catch (e: any) {
      setError(e?.message ?? "Kunde inte skapa inlägg.");
    } finally {
      setCreating(false);
    }
  }

  // --- Edit ---
  async function startEdit(p: Post) {
    setEditingId(p.id);

    let title = p.title;
    let category = p.category ?? "";
    let content = p.content ?? "";

    if (!content || content.trim() === "") {
      try {
        const res = await fetch(`/api/posts/${p.id}`, { credentials: "include" });
        if (res.ok) {
          const full = await res.json();
          if (typeof full?.content === "string" && full.content.trim() !== "") content = full.content;
          if (!category && typeof full?.category === "string") category = full.category;
        } else {
          const resList = await fetch(`/api/posts`, { credentials: "include" });
          if (resList.ok) {
            const list: any[] = await resList.json();
            const found = list.find((x) => Number(x?.id) === p.id);
            if (found) {
              if (!content && typeof found?.content === "string") content = found.content;
              if (!category && typeof found?.category === "string") category = found.category;
              if (!title && typeof found?.title === "string") title = found.title;
            }
          }
        }
      } catch { }
    }

    setEditForm({ title, category, content });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  async function saveEdit(id: number) {
    if (!editForm.title?.trim() || !editForm.content?.trim()) {
      setError("Titel och innehåll krävs.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: { title?: string; content?: string; category?: string } = {
        title: editForm.title?.trim(),
        content: editForm.content?.trim(),
      };
      if (typeof editForm.category === "string" && editForm.category.trim() !== "") {
        payload.category = editForm.category.trim();
      }
      await postsApi.update(id, payload);
      await fetchPosts();
      cancelEdit();
    } catch (e: any) {
      setError(e?.message ?? "Kunde inte spara ändringarna.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Ta bort inlägget?")) return;
    try {
      await postsApi.delete(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Kunde inte ta bort inlägget.");
    }
  }

  async function toggleComments(postId: number) {
    const willOpen = !commentsOpen[postId];
    setCommentsOpen((prev) => ({ ...prev, [postId]: willOpen }));
    if (willOpen && !comments[postId]) {
      try {
        const list = await commentsApi.listByPost(postId);
        setComments((prev) => ({ ...prev, [postId]: list }));
      } catch (e: any) {
        setError(e?.message ?? "Kunde inte hämta kommentarer.");
      }
    }
  }

  async function addComment(postId: number) {
    const form = newComment[postId] || { author: user?.username ?? "", content: "" };
    const author = (form.author || user?.username || "").trim();
    const content = (form.content || "").trim();

    if (!content) {
      setError("Kommentarfältet är tomt.");
      return;
    }
    if (!author) {
      setError("Ange namn för kommentaren.");
      return;
    }

    try {
      const { id } = await commentsApi.create(postId, { author, content });
      const created: Comment = {
        id,
        post_id: postId,
        author,
        content,
        created: new Date().toISOString().slice(0, 19).replace("T", " "),
      };
      setComments((prev) => ({ ...prev, [postId]: [created, ...(prev[postId] || [])] }));
      setNewComment((prev) => ({
        ...prev,
        [postId]: { author: user?.username ?? author, content: "" },
      }));
      // bump count lokalt
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comment_count: (typeof p.comment_count === "number" ? p.comment_count : 0) + 1 }
            : p
        )
      );
    } catch (e: any) {
      setError(e?.message ?? "Kunde inte skapa kommentar.");
    }
  }

  async function deleteComment(postId: number, commentId: number) {
    if (!confirm("Ta bort kommentaren?")) return;
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
      }));
      // sänk count lokalt
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comment_count: Math.max(0, (typeof p.comment_count === "number" ? p.comment_count : 0) - 1) }
            : p
        )
      );
    } catch (e: any) {
      setError(e?.message ?? "Kunde inte ta bort kommentaren.");
    }
  }

  // Hjälp: förhandsvisning & Läs mer
  function preview(text: string | undefined | null, max = 240) {
    if (!text) return "";
    if (text.length <= max) return text;
    return text.slice(0, max).trimEnd() + "…";
  }

  return (
    <div className="container py-4">
      {/* Admin info banner */}
      {!authLoading && user?.role === "admin" && (
        <div className="alert alert-info shadow-sm mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Admin:</strong> glöm inte att exportera en backup då och då.
            </div>
            <div className="d-flex gap-2">
              <a className="btn btn-sm btn-outline-dark" href="/api/export/posts.csv" download>
                <FaDownload className="me-1" /> CSV
              </a>
              <a className="btn btn-sm btn-outline-dark" href="/api/export/posts.json" download>
                <FaDownload className="me-1" /> JSON
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">🌐 Community Board</h1>
          <p className="mb-0 text-muted">
            Snacka, dela och håll koll på det senaste i communityt.
          </p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body d-flex flex-column flex-md-row gap-2">
          <div className="input-group">
            <span className="input-group-text">
              <FaSearch />
            </span>
            <input
              className="form-control"
              placeholder="Sök inlägg (titel, innehåll, författare)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
                if (e.key === "Escape") setSearch("");
              }}
            />
          </div>
          <div className="input-group">
            <span className="input-group-text">
              <FaFilter />
            </span>
            <input
              className="form-control"
              placeholder="Kategori (t.ex. info, nyheter)…"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
                if (e.key === "Escape") setCategory("");
              }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleSearch}>
            <FaSearch className="me-1" /> Sök
          </button>
          <button className="btn btn-outline-secondary" onClick={handleReset}>
            <FaSync className="me-1" /> Rensa
          </button>
        </div>
      </div>

      {/* Create post */}
      {!authLoading && user && (
        <form className="card shadow-sm border-0 mb-4" onSubmit={handleCreatePost}>
          <div className="card-body">
            <h5 className="card-title">
              <FaPlus className="me-2" />
              Nytt inlägg
            </h5>
            <div className="row g-2">
              <div className="col-md-6">
                <input
                  className="form-control"
                  placeholder="Titel"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <input
                  className="form-control"
                  placeholder="Kategori (t.ex. info)"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              </div>
              <div className="col-12">
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Innehåll"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <button className="btn btn-success" disabled={creating}>
                {creating ? "Skapar…" : "Publicera"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Loading / error */}
      {loading && <div className="alert alert-secondary">Laddar…</div>}
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2">
          <FaInfoCircle /> {error}
        </div>
      )}

      {/* Posts list */}
      {!loading && !error && (
        <div className="vstack gap-3">
          {posts.length === 0 ? (
            <div className="text-muted">Inga inlägg hittades.</div>
          ) : (
            posts.map((p) => (
              <article id={`post-${p.id}`} key={p.id} className="card shadow-sm border-0">
                <div className="card-body">
                  {editingId === p.id ? (
                    <>
                      {/* Edit mode */}
                      <div className="row g-2">
                        <div className="col-md-6">
                          <input
                            className="form-control"
                            placeholder="Titel"
                            value={editForm.title ?? ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, title: e.target.value }))
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <input
                            className="form-control"
                            placeholder="Kategori"
                            value={editForm.category ?? ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, category: e.target.value }))
                            }
                          />
                        </div>
                        <div className="col-12">
                          <textarea
                            className="form-control"
                            rows={3}
                            placeholder="Innehåll"
                            value={editForm.content ?? ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, content: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button
                          className="btn btn-primary"
                          onClick={() => saveEdit(p.id)}
                          disabled={saving}
                        >
                          {saving ? "Sparar…" : "Spara"}
                        </button>
                        <button className="btn btn-light" onClick={cancelEdit}>
                          Avbryt
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Read mode */}
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h5 className="card-title mb-1">
                            <Link to={`/board/${p.id}`} className="text-decoration-none">
                              {p.title}
                            </Link>
                          </h5>
                          <small className="text-muted">
                            av <strong>{p.author}</strong> · {fmt(p.created)}
                          </small>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          {/* Copy link */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => copyPostLink(p.id)}
                          >
                            {copiedId === p.id ? (
                              <>
                                <FaClipboardCheck className="me-1" /> Kopierad
                              </>
                            ) : (
                              <>
                                <FaLink className="me-1" /> Länk
                              </>
                            )}
                          </button>
                          {p.category && (
                            <span className={`badge ${categoryClass(p.category)}`}>
                              {p.category}
                            </span>
                          )}
                          {user && canEditPost(p) && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => startEdit(p)}
                              >
                                <FaEdit className="me-1" /> Redigera
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(p.id)}
                              >
                                <FaTrash className="me-1" /> Ta bort
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Preview + Läs mer */}
                      <p className="card-text mt-3" style={{ whiteSpace: "pre-wrap" }}>
                        {preview(p.content)}
                      </p>
                      {p.content && p.content.length > 240 && (
                        <Link to={`/board/${p.id}`} className="btn btn-sm btn-outline-primary">
                          Läs mer
                        </Link>
                      )}

                      {/* Comments */}
                      <div className="mt-3">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => toggleComments(p.id)}
                        >
                          <FaCommentDots className="me-2" />
                          {commentsOpen[p.id] ? (
                            <>
                              Dölj kommentarer <FaChevronUp className="ms-1" />
                            </>
                          ) : (
                            <>
                              Visa kommentarer <FaChevronDown className="ms-1" />
                            </>
                          )}
                          {typeof p.comment_count === "number" ? ` (${p.comment_count})` : ""}
                        </button>

                        {commentsOpen[p.id] && (
                          <div className="mt-3">
                            {/* Add comment */}
                            <div className="card border-0 shadow-sm mb-3">
                              <div className="card-body">
                                <div className="row g-2 align-items-end">
                                  {!user && (
                                    <div className="col-md-4">
                                      <label className="form-label">Namn</label>
                                      <input
                                        className="form-control"
                                        value={newComment[p.id]?.author ?? ""}
                                        onChange={(e) =>
                                          setNewComment((prev) => ({
                                            ...prev,
                                            [p.id]: {
                                              author: e.target.value,
                                              content: prev[p.id]?.content ?? "",
                                            },
                                          }))
                                        }
                                        placeholder="Skriv ditt namn"
                                      />
                                    </div>
                                  )}
                                  <div className={user ? "col-12" : "col-md-8"}>
                                    <label className="form-label">Kommentar</label>
                                    <input
                                      className="form-control"
                                      value={newComment[p.id]?.content ?? ""}
                                      onChange={(e) =>
                                        setNewComment((prev) => ({
                                          ...prev,
                                          [p.id]: {
                                            author:
                                              prev[p.id]?.author ?? user?.username ?? "",
                                            content: e.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="Skriv en kommentar…"
                                    />
                                  </div>
                                </div>
                                <button
                                  className="btn btn-primary mt-2"
                                  onClick={() => addComment(p.id)}
                                >
                                  Skicka
                                </button>
                              </div>
                            </div>

                            {/* List comments */}
                            <div className="vstack gap-2">
                              {(comments[p.id] ?? []).length === 0 ? (
                                <div className="text-muted">Inga kommentarer ännu.</div>
                              ) : (
                                (comments[p.id] ?? []).map((c) => (
                                  <div
                                    key={c.id}
                                    className="border rounded p-2 d-flex justify-content-between align-items-start"
                                  >
                                    <div>
                                      <div className="small text-muted">
                                        <strong>{c.author}</strong> · {fmt(c.created)}
                                      </div>
                                      <div>{c.content}</div>
                                    </div>
                                    {user?.role === "admin" && (
                                      <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => deleteComment(p.id, c.id)}
                                      >
                                        <FaTrash className="me-1" /> Ta bort
                                      </button>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

(Board as any).route = {
  path: "/board",
  menuLabel: "Board",
  index: 2,
};
