import type { JSX } from 'react';
import { createElement } from 'react';
// page components
import NotFoundPage from './pages/NotFoundPage.tsx';
import Start from './pages/Start.tsx';
import Board from './pages/Board';


interface Route {
  element: JSX.Element;
  path: string;
  loader?: Function;
  menuLabel?: string;
  index?: number;
  parent?: string;
}

export default [
  NotFoundPage,
  Start,
  Board,
]
  .map(x => (({ element: createElement(x), ...((x as any).route) }) as Route))

  .sort((a, b) => (a.index || 0) - (b.index || 0));
