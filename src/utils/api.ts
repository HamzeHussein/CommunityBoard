// src/utils/api.ts

export type Post = {
  id: number;
  author: string;
  title: string;
  content: string;
  category: string;
  created: string;
  updated?: string | null;
  comment_count?: number; // från vy /api/posts/with-count
};

export type Comment = {
  id: number;
  post_id: number;
  author: string;
  content: string;
  created: string;
};

export type User = {
  id: number;
  username: string;
  role: "admin" | "user";
  created: string;
};

export type AuthUser = {
  username: string;
  role: "admin" | "user";
};

// === BASE ===
const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "";

/** Vanlig JSON/text-request (returnerar T) */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }

  const raw = await res.text();
  if (!raw) return undefined as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    // om backend skulle returnera ren text
    return (raw as unknown) as T;
  }
}

/** Blob-request för filnedladdningar (CSV/JSON som fil) */
async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      // OBS: sätt inte Content-Type här – servern bestämmer för filsvar
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }

  return await res.blob();
}

// === POSTS API ===
type PostCreateInput =
  | Pick<Post, "title" | "content" | "category">
  | (Pick<Post, "title" | "content" | "category"> & Partial<Pick<Post, "author">>);

export const postsApi = {
  list: (search?: string, category?: string) => {
    const qs = new URLSearchParams();
    if (search?.trim()) qs.set("search", search.trim());
    if (category?.trim()) qs.set("category", category.trim());
    const q = qs.toString();
    return request<Post[]>(`/api/posts${q ? `?${q}` : ""}`);
  },

  listWithCount: () => request<Post[]>(`/api/posts/with-count`),

  create: (data: PostCreateInput) =>
    request<{ id: number }>(`/api/posts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Pick<Post, "title" | "content" | "category">>) =>
    request<void>(`/api/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: number) => request<void>(`/api/posts/${id}`, { method: "DELETE" }),
};

// === COMMENTS API ===
export const commentsApi = {
  listByPost: (postId: number) => request<Comment[]>(`/api/posts/${postId}/comments`),

  create: (postId: number, data: Pick<Comment, "author" | "content">) =>
    request<{ id: number }>(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: number) => request<void>(`/api/comments/${id}`, { method: "DELETE" }),
};

// === AUTH API ===
export const authApi = {
  login: (username: string, password: string) =>
    request<AuthUser>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<AuthUser>(`/api/auth/me`),

  logout: () => request<{ ok: boolean }>(`/api/auth/logout`, { method: "POST" }),
};

// === USERS API (endast admin i UI) ===
export const usersApi = {
  list: () => request<User[]>(`/api/users`),
};

// === EXPORT API (filnedladdningar) ===
export const exportApi = {
  json: () => requestBlob(`/api/export/posts.json`), // application/json (som fil)
  csv: () => requestBlob(`/api/export/posts.csv`),   // text/csv (som fil)
};
