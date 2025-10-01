import type { JSX } from "react";
import { createElement } from "react";

// Pages
import Start from "./pages/Start";
import Board from "./pages/Board";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFoundPage from "./pages/NotFoundPage";

interface Route {
  element: JSX.Element;
  path: string;
  loader?: Function;
  menuLabel?: string;
  index?: number;
  parent?: string;
}

export default [
  Start,
  Board,
  Login,
  Register,
  NotFoundPage,
]
  .map(
    (x) =>
    ({
      element: createElement(x),
      ...((x as any).route),
    } as Route)
  )
  .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
