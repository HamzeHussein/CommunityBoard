
import { useEffect, useState } from 'react';
import { postsApi, type Post } from '../utils/api';
import { mockPosts } from '../utils/mockPosts';

export default function Board() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // server-side filter state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  // edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Pick<Post, 'title' | 'content' | 'category'>>>({});
  const [saving, setSaving] = useState(false);

  // defaultar till mock-fallback = true
  async function fetchPosts(opts: { useMockOnFail?: boolean } = { useMockOnFail: true }) {
    setLoading(true);
    setError(null);
    try {
      const data = await postsApi.list(search, category);
      setPosts(data);
    } catch (e: any) {
      console.warn('API misslyckades – visar mockade inlägg:', e);
      if (opts?.useMockOnFail !== false) {
        setPosts(mockPosts);
        setError(null);
      } else {
        setError(e.message || 'Kunde inte hämta inlägg.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // första laddningen – visa mock om API inte svarar
    fetchPosts({ useMockOnFail: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hämta från server med aktuellt filter (behåll fallback)
  function handleSearch() {
    fetchPosts(); // default keep fallback
  }

  function handleReset() {
    setSearch('');
    setCategory('');
    setTimeout(() => fetchPosts(), 0);
  }

  // Delete
  async function handleDelete(id: number) {
    if (!confirm('Ta bort inlägget?')) return;
    try {
      await postsApi.delete(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      setError(e.message || 'Kunde inte ta bort inlägget.');
    }
  }

  // Edit
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
      const updated = await postsApi.update(id, {
        title: editForm.title!.trim(),
        content: editForm.content!.trim(),
        category: (editForm.category || '').toString().trim(),
      });
      setPosts(prev => prev.map(p => (p.id === id ? updated : p)));
      cancelEdit();
    } catch (e: any) {
      setError(e.message || 'Kunde inte spara ändringarna.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container py-4">
      {/* Flashy hero */}
      <div className="board-hero mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
          <div>
            <h1 className="h2 mb-1">🌐 Community Board</h1>
            <p className="mb-0 opacity-75">
              Snacka, dela och håll koll på det senaste i communityt.
            </p>
          </div>
          {/* (Kommer senare: skapa nytt inlägg) */}
          <div className="d-none d-md-block">
            <button className="btn btn-light btn-lg disabled" aria-disabled>
              + Nytt inlägg (snart)
            </button>
          </div>
        </div>
      </div>

      {/* Sök & filter (server-side) */}
      <div className="d-flex flex-column flex-md-row gap-2 align-items-stretch search-toolbar mb-4">
        <input
          className="form-control"
          placeholder="Sök inlägg (titel, innehåll, författare)…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') setSearch(''); }}
        />
        <input
          className="form-control"
          placeholder="Kategori (ex. Nyheter, Diskussion)…"
          value={category}
          onChange={e => setCategory(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') setCategory(''); }}
        />
        <button className="btn btn-primary" onClick={handleSearch}>Sök</button>
        <button className="btn btn-outline-secondary" onClick={handleReset} title="Rensa filter">
          Rensa
        </button>
      </div>

      {/* Status */}
      {loading && <div className="alert alert-secondary">Laddar…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Lista */}
      {!loading && !error && (
        <div className="vstack gap-3">
          {posts.length === 0 ? (
            <div className="text-muted">Inga inlägg hittades.</div>
          ) : (
            posts.map((p) => (
              <article key={p.id} className="card card-glass shadow-sm">
                <div className="card-body">
                  {editingId === p.id ? (
                    <>
                      {/* EDIT MODE */}
                      <div className="row g-2">
                        <div className="col-12 col-md-6">
                          <input
                            className="form-control"
                            placeholder="Titel"
                            value={editForm.title || ''}
                            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <input
                            className="form-control"
                            placeholder="Kategori"
                            value={editForm.category || ''}
                            onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                          />
                        </div>
                        <div className="col-12">
                          <textarea
                            className="form-control"
                            rows={4}
                            placeholder="Innehåll"
                            value={editForm.content || ''}
                            onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button
                          className="btn btn-primary"
                          onClick={() => saveEdit(p.id)}
                          disabled={saving}
                        >
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
                            av <strong>{p.author}</strong> · {new Date(p.createdAt).toLocaleString()}
                          </small>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          {p.category && <span className="badge badge-soft">{p.category}</span>}
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
                        </div>
                      </div>
                      <p className="card-text mt-3 mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                        {p.content}
                      </p>
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
  path: '/board',
  menuLabel: 'Board',
  index: 2,
};
