// src/pages/Board.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { postsApi, commentsApi, exportApi, type Post, type Comment, authApi, type AuthUser } from '../utils/api';

export default function Board() {
  // auth
  const [me, setMe] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // posts
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  // create post
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  // edit post
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Pick<Post, 'title' | 'content' | 'category'>>>({});
  const [saving, setSaving] = useState(false);

  // comments per postId
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentsOpen, setCommentsOpen] = useState<Record<number, boolean>>({});
  const [newComment, setNewComment] = useState<Record<number, { author: string; content: string }>>({});

  const canEditPost = useMemo(
    () => (p: Post) => {
      if (!me) return false;
      return me.role === 'admin' || me.username === p.author;
    },
    [me]
  );

  // ===== AUTH =====
  useEffect(() => {
    (async () => {
      try {
        setAuthLoading(true);
        const u = await authApi.me();
        setMe(u);
      } catch {
        setMe(null);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  // ===== LOAD POSTS =====
  async function fetchPosts() {
    setLoading(true);
    setError(null);
    try {
      const data = await postsApi.list(search, category);
      setPosts(data);
    } catch (e: any) {
      setError(e?.message ?? 'Kunde inte hämta inlägg.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch() {
    fetchPosts();
  }
  function handleReset() {
    setSearch('');
    setCategory('');
    setTimeout(() => fetchPosts(), 0);
  }

  // ===== CREATE POST =====
  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !newCategory.trim()) {
      setError('Titel, kategori och innehåll krävs.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // backend sätter author från login-cookie om du är inloggad
      await postsApi.create({
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory.trim(),
      });
      setNewTitle('');
      setNewCategory('');
      setNewContent('');
      await fetchPosts();
    } catch (e: any) {
      setError(e?.message ?? 'Kunde inte skapa inlägg.');
    } finally {
      setCreating(false);
    }
  }

  // ===== EDIT POST =====
  function startEdit(p: Post) {
    setEditingId(p.id);
    setEditForm({ title: p.title, category: p.category, content: p.content });
  }
  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }
  async function saveEdit(id: number) {
    if (!editForm.title?.trim() || !editForm.content?.trim()) {
      setError('Titel och innehåll krävs.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await postsApi.update(id, {
        title: editForm.title!.trim(),
        content: editForm.content!.trim(),
        category: (editForm.category || '').toString().trim(),
      });
      await fetchPosts(); // säkert sätt (update returnerar 204)
      cancelEdit();
    } catch (e: any) {
      setError(e?.message ?? 'Kunde inte spara ändringarna.');
    } finally {
      setSaving(false);
    }
  }

  // ===== DELETE POST =====
  async function handleDelete(id: number) {
    if (!confirm('Ta bort inlägget?')) return;
    try {
      await postsApi.delete(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      setError(e?.message ?? 'Kunde inte ta bort inlägget.');
    }
  }

  // ===== COMMENTS =====
  async function toggleComments(postId: number) {
    const willOpen = !commentsOpen[postId];
    setCommentsOpen(prev => ({ ...prev, [postId]: willOpen }));
    if (willOpen && !comments[postId]) {
      try {
        const list = await commentsApi.listByPost(postId);
        setComments(prev => ({ ...prev, [postId]: list }));
      } catch (e: any) {
        setError(e?.message ?? 'Kunde inte hämta kommentarer.');
      }
    }
  }

  async function addComment(postId: number) {
    const form = newComment[postId] || { author: me?.username ?? '', content: '' };
    const author = (form.author || me?.username || '').trim();
    const content = (form.content || '').trim();

    if (!content) {
      setError('Kommentarfältet är tomt.');
      return;
    }
    if (!author) {
      setError('Ange namn för kommentaren.');
      return;
    }

    try {
      const { id } = await commentsApi.create(postId, { author, content });
      const created: Comment = {
        id,
        post_id: postId,
        author,
        content,
        created: new Date().toISOString().slice(0, 19).replace('T', ' '), // visning
      };
      setComments(prev => ({ ...prev, [postId]: [created, ...(prev[postId] || [])] }));
      setNewComment(prev => ({ ...prev, [postId]: { author: me?.username ?? author, content: '' } }));
    } catch (e: any) {
      setError(e?.message ?? 'Kunde inte skapa kommentar.');
    }
  }

  async function deleteComment(postId: number, commentId: number) {
    if (!confirm('Ta bort kommentaren?')) return;
    try {
      await commentsApi.delete(commentId);
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId),
      }));
    } catch (e: any) {
      setError(e?.message ?? 'Kunde inte ta bort kommentaren.');
    }
  }

  // ===== EXPORT (admin) =====
  async function downloadBlob(getBlob: () => Promise<Blob>, filename: string) {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // ===== RENDER =====
  return (
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">🌐 Community Board</h1>
          <p className="mb-0 text-muted">Snacka, dela och håll koll på det senaste i communityt.</p>
        </div>

        {/* Admin-åtgärder */}
        {!authLoading && me?.role === 'admin' && (
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={() => downloadBlob(exportApi.csv, 'posts.csv')}>
              Exportera CSV
            </button>
            <button className="btn btn-outline-secondary" onClick={() => downloadBlob(exportApi.json, 'posts.json')}>
              Exportera JSON
            </button>
          </div>
        )}
      </div>

      {/* Sök & filter */}
      <div className="d-flex flex-column flex-md-row gap-2 align-items-stretch mb-4">
        <input
          className="form-control"
          placeholder="Sök inlägg (titel, innehåll, författare)…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') setSearch(''); }}
        />
        <input
          className="form-control"
          placeholder="Kategori (ex. info, nyheter)…"
          value={category}
          onChange={e => setCategory(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') setCategory(''); }}
        />
        <button className="btn btn-primary" onClick={handleSearch}>Sök</button>
        <button className="btn btn-outline-secondary" onClick={handleReset} title="Rensa filter">Rensa</button>
      </div>

      {/* Skapa inlägg (inloggad) */}
      {!authLoading && me && (
        <form className="card shadow-sm mb-4" onSubmit={handleCreatePost}>
          <div className="card-body">
            <h5 className="card-title mb-3">Nytt inlägg</h5>
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <input
                  className="form-control"
                  placeholder="Titel"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div className="col-12 col-md-6">
                <input
                  className="form-control"
                  placeholder="Kategori (t.ex. info)"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  required
                />
              </div>
              <div className="col-12">
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Innehåll"
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mt-3">
              <button className="btn btn-success" disabled={creating}>
                {creating ? 'Skapar…' : 'Publicera'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Status */}
      {loading && <div className="alert alert-secondary">Laddar…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Lista */}
      {!loading && !error && (
        <div className="vstack gap-3">
          {posts.length === 0 ? (
            <div className="text-muted">Inga inlägg hittades.</div>
          ) : posts.map(p => (
            <article key={p.id} className="card shadow-sm">
              <div className="card-body">
                {editingId === p.id ? (
                  <>
                    {/* EDIT MODE */}
                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <input
                          className="form-control"
                          placeholder="Titel"
                          value={editForm.title ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <input
                          className="form-control"
                          placeholder="Kategori"
                          value={editForm.category ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                        />
                      </div>
                      <div className="col-12">
                        <textarea
                          className="form-control"
                          rows={4}
                          placeholder="Innehåll"
                          value={editForm.content ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-3">
                      <button className="btn btn-primary" onClick={() => saveEdit(p.id)} disabled={saving}>
                        {saving ? 'Sparar…' : 'Spara'}
                      </button>
                      <button className="btn btn-light" onClick={cancelEdit}>Avbryt</button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* READ MODE */}
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h5 className="card-title mb-1">{p.title}</h5>
                        <small className="text-muted">
                          av <strong>{p.author}</strong> ·{' '}
                          {p.created ? new Date(p.created.replace(' ', 'T')).toLocaleString() : ''}
                        </small>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {p.category && <span className="badge text-bg-secondary">{p.category}</span>}
                        {me && canEditPost(p) && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => startEdit(p)}
                              title="Redigera inlägg"
                            >
                              Redigera
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(p.id)}
                              title="Ta bort inlägg"
                            >
                              Ta bort
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="card-text mt-3 mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                      {p.content}
                    </p>

                    {/* Kommentarer */}
                    <div className="mt-3">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => toggleComments(p.id)}
                      >
                        {commentsOpen[p.id] ? 'Dölj kommentarer' : 'Visa kommentarer'}
                        {typeof p.comment_count === 'number' ? ` (${p.comment_count})` : ''}
                      </button>

                      {commentsOpen[p.id] && (
                        <div className="mt-3">
                          {/* Lägg till kommentar */}
                          <div className="card mb-3">
                            <div className="card-body">
                              <div className="row g-2 align-items-end">
                                {!me && (
                                  <div className="col-12 col-md-4">
                                    <label className="form-label">Namn</label>
                                    <input
                                      className="form-control"
                                      value={(newComment[p.id]?.author ?? '')}
                                      onChange={e =>
                                        setNewComment(prev => ({
                                          ...prev,
                                          [p.id]: { author: e.target.value, content: prev[p.id]?.content ?? '' },
                                        }))
                                      }
                                      placeholder="Skriv ditt namn"
                                    />
                                  </div>
                                )}
                                <div className={me ? 'col-12' : 'col-12 col-md-8'}>
                                  <label className="form-label">Kommentar</label>
                                  <input
                                    className="form-control"
                                    value={(newComment[p.id]?.content ?? '')}
                                    onChange={e =>
                                      setNewComment(prev => ({
                                        ...prev,
                                        [p.id]: { author: prev[p.id]?.author ?? (me?.username ?? ''), content: e.target.value },
                                      }))
                                    }
                                    placeholder="Skriv en kommentar…"
                                  />
                                </div>
                              </div>
                              <button className="btn btn-primary mt-2" onClick={() => addComment(p.id)}>
                                Skicka
                              </button>
                            </div>
                          </div>

                          {/* Lista kommentarer */}
                          <div className="vstack gap-2">
                            {(comments[p.id] ?? []).length === 0 ? (
                              <div className="text-muted">Inga kommentarer ännu.</div>
                            ) : (
                              (comments[p.id] ?? []).map(c => (
                                <div key={c.id} className="border rounded p-2 d-flex justify-content-between align-items-start">
                                  <div>
                                    <div className="small text-muted">
                                      <strong>{c.author}</strong> ·{' '}
                                      {c.created ? new Date(c.created.replace(' ', 'T')).toLocaleString() : ''}
                                    </div>
                                    <div>{c.content}</div>
                                  </div>
                                  {me?.role === 'admin' && (
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => deleteComment(p.id, c.id)}
                                      title="Ta bort kommentar"
                                    >
                                      Ta bort
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
          ))}
        </div>
      )}
    </div>
  );
}

(Board as any).route = {
  path: '/board',
  menuLabel: 'Board',
  index: 2,
};
