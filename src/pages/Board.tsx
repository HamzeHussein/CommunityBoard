
import { useEffect, useState } from 'react';
import { postsApi, type Post } from '../utils/api';
import { mockPosts } from '../utils/mockPosts'; // ⬅️ NY: mock-fallback

export default function Board() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await postsApi.list();
        setPosts(data);
      } catch (e: any) {
        console.warn('API misslyckades – visar mockade inlägg:', e);
        setPosts(mockPosts);   // ⬅️ NY: fallback till mock
        setError(null);        // ⬅️ NY: dölj felrutan
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
          {/* (Kommer senare) */}
          <div className="d-none d-md-block">
            <button className="btn btn-light btn-lg disabled" aria-disabled>
              + Nytt inlägg (snart)
            </button>
          </div>
        </div>
      </div>

      {/* Sök/filter – (aktiveras senare) */}
      <div className="d-flex flex-column flex-md-row gap-2 align-items-stretch search-toolbar mb-4">
        <input className="form-control" placeholder="Sök inlägg..." disabled />
        <select className="form-select" disabled>
          <option>Alla kategorier</option>
        </select>
        <button className="btn btn-primary" disabled>Sök</button>
      </div>

      {/* Status */}
      {loading && <div className="alert alert-secondary">Laddar…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Lista */}
      {!loading && !error && (
        <div className="vstack gap-3">
          {posts.length === 0 ? (
            <div className="text-muted">Inga inlägg ännu.</div>
          ) : (
            posts.map((p) => (
              <article key={p.id} className="card card-glass shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h5 className="card-title mb-1">{p.title}</h5>
                      <small className="text-muted">
                        av <strong>{p.author}</strong> · {new Date(p.createdAt).toLocaleString()}
                      </small>
                    </div>
                    {p.category && <span className="badge badge-soft">{p.category}</span>}
                  </div>
                  <p className="card-text mt-3 mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                    {p.content}
                  </p>
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
