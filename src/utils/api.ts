// src/utils/api.ts
export type Post = {
  id: number;
  userId: number;
  author: string;
  title: string;
  content: string;
  category: string;
  createdAt: string; // ISO
  updatedAt?: string;
};

const BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:5000';

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
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export const postsApi = {
  list: () => request<Post[]>('/api/posts'),
};
