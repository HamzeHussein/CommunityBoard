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
export const postsApi = {
  /**
   * Smart list:
   * - Om varken search eller category är satta -> hämta från vyn (/api/posts/with-count)
   *   så vi får med comment_count direkt (VG-kravet “vyer via REST” används i UI).
   * - Annars: vanliga /api/posts med filter.
   */
  list: async (search?: string, category?: string) => {
    const s = (search ?? "").trim();
    const c = (category ?? "").trim();

    if (!s && !c) {
      // använd vyn
      return request<Post[]>(`/api/posts/with-count`);
    }

    // använd filtrerad lista
    const qs = new URLSearchParams();
    if (s) qs.set("search", s);
    if (c) qs.set("category", c);
    const q = qs.toString();
    return request<Post[]>(`/api/posts${q ? `?${q}` : ""}`);
  },

  // Finns kvar ifall vi vill hämta vyn explicit någon gång
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

// === USERS API (ev. adminvy i framtiden) ===
export const usersApi = {
  list: () => request<User[]>(`/api/users`),
};

// === EXPORT API (filnedladdningar) ===
export const exportApi = {
  json: () => requestBlob(`/api/export/posts.json`), // application/json (som fil)
  csv: () => requestBlob(`/api/export/posts.csv`),   // text/csv (som fil)
};

// === PROFILE API (NYTT) ===
export const profileApi = {
  get: () => request<Profile>(`/api/profile`),
  update: (data: { email?: string; phone?: string }) =>
    request<void>(`/api/profile`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
