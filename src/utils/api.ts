// src/utils/api.ts

export type Post = {
  id: number;
  author: string;
  title: string;
  content: string;
  category: string;
  created: string;
  updated?: string | null;
  comment_count?: number;
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
  email?: string | null;
  phone?: string | null;
};

export type AuthUser = {
  username: string;
  role: "admin" | "user";
};

export type Profile = {
  username: string;
  role: "admin" | "user";
  email?: string | null;
  phone?: string | null;
};

// === BASE ===
// Tom => samma origin (Vite-proxy i dev, samma app i prod).
// Vill du peka på extern backend, sätt VITE_API_BASE i .env.local
const BASE_URL =
  (import.meta?.env?.VITE_API_BASE as string | undefined)?.trim() || "";

/** JSON/text-request (returnerar T) */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include", // skicka/spara session-cookie
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
    return (raw as unknown) as T; // om servern skickar plain text
  }
}

/** Blob-request (för filnedladdningar) */
async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
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
export const postsApi = {
  list: async (search?: string, category?: string) => {
    const s = (search ?? "").trim();
    const c = (category ?? "").trim();

    if (!s && !c) {
      return request<Post[]>(`/api/posts/with-count`);
    }

    const qs = new URLSearchParams();
    if (s) qs.set("search", s);
    if (c) qs.set("category", c);
    const q = qs.toString();
    return request<Post[]>(`/api/posts${q ? `?${q}` : ""}`);
  },

  listWithCount: () => request<Post[]>(`/api/posts/with-count`),

  create: (data: Pick<Post, "title" | "content" | "category">) =>
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
// Viktigt: dina auth-endpoints ligger under /api/auth/...
export const authApi = {
  login: (username: string, password: string) =>
    request<AuthUser>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string) =>
    request<AuthUser>(`/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<AuthUser>(`/api/auth/me`),

  logout: () => request<{ ok: boolean }>(`/api/auth/logout`, { method: "POST" }),
};

// === USERS API ===
export const usersApi = {
  list: () => request<User[]>(`/api/users`),
};

// === EXPORT API ===
export const exportApi = {
  json: () => requestBlob(`/api/export/posts.json`),
  csv: () => requestBlob(`/api/export/posts.csv`),
};

// === PROFILE API ===
export const profileApi = {
  get: () => request<Profile>(`/api/profile`),
  update: (data: { email?: string; phone?: string }) =>
    request<void>(`/api/profile`, {
      method: "PUT", // behåll PUT – cookies fixade -> 200
      body: JSON.stringify(data),
    }),
};
