// src/utils/api.ts
export type Post = {
  id: number;
  userId: number;
  author: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt?: string;
};

// Viktigt: använd proxy från vite.config.ts
// Om ingen env-variabel finns => använd tomt så vi får relativa paths (/api/...)
const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`);
    }

    const raw = await res.text();
    if (!raw) {

      return undefined as T;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Om backend returnerar text istället för JSON

      return (raw as unknown) as T;
    }
  } catch (err: any) {
    console.error('API request failed:', path, init, err);
    throw err;
  }
}

export const postsApi = {
  list: (search?: string, category?: string) => {
    const qs = new URLSearchParams();
    if (search?.trim()) qs.set('search', search.trim());
    if (category?.trim()) qs.set('category', category.trim());
    const q = qs.toString();
    return request<Post[]>(`/api/posts${q ? `?${q}` : ''}`);
  },

  update: (
    id: number,
    data: Partial<Pick<Post, 'title' | 'content' | 'category'>>
  ) =>
    request<Post>(`/api/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, updatedAt: new Date().toISOString() }),
    }),

  delete: (id: number) =>
    request<{ ok?: boolean }>(`/api/posts/${id}`, { method: 'DELETE' }),
};
