// src/utils/mockPosts.ts
import type { Post } from "./api";

function now() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

const mockPosts: Post[] = [
  {
    id: 1,
    title: "Välkommen",
    content: "Första inlägget – systemet är igång!",
    author: "admin",              // <— använd author (string), inte userId
    category: "info",
    created: now(),
    updated: null,
    comment_count: 0,
  },
  {
    id: 2,
    title: "Solidaritet och stöd för Palestina",
    content:
      "Den pågående konflikten i Palestina väcker starka känslor världen över...",
    author: "Hamze1",             // <— använd author (string), inte userId
    category: "Nyheter",
    created: now(),
    updated: null,
    comment_count: 2,
  },
];

export default mockPosts;
export { mockPosts };
