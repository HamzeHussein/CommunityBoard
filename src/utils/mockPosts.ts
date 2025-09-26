// src/utils/mockPosts.ts
import type { Post } from './api';

export const mockPosts: Post[] = [
  {
    id: 1,
    userId: 10,
    author: 'Hamze',
    title: 'Välkommen till Community Board 🚀',
    content: 'Det här är första inlägget. Allt är på väg att bli fire 🔥',
    category: 'Nyheter',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    userId: 2,
    author: 'Admin',
    title: 'Regler & tips',
    content: 'Var trevlig, håll trådar on-topic och rapportera spam.',
    category: 'Diskussion',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // igår
  },
];
