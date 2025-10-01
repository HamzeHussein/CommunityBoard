// src/utils/api.ts
export type Post = {
  id: number;
  author: string;
  title: string;
  content: string;
  category: string;
  created: string;
  updated?: string | null;
};

export type Comment = {
  id: number;
  post_id: number;
  author: string;
  content: string;
  created: string;
};

// Om du har proxy i vite.config.ts kan BASE_URL vara tom
const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
  if (!raw) return undefined as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return (raw as unknown) as T;
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

  create: (data: Pick<Post, 'title' | 'content' | 'author' | 'category'>) =>
    request<{ id: number }>(`/api/posts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Pick<Post, 'title' | 'content' | 'category' | 'author'>>) =>
    request<void>(`/api/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/api/posts/${id}`, { method: 'DELETE' }),
};

export const commentsApi = {
  listByPost: (postId: number) =>
    request<Comment[]>(`/api/posts/${postId}/comments`),

  create: (postId: number, data: Pick<Comment, 'author' | 'content'>) =>
    request<{ id: number }>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/api/comments/${id}`, { method: 'DELETE' }),
};
