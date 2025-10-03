import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";

import "bootstrap/dist/css/bootstrap.min.css";
import "../sass/index.scss"; // <-- från /src upp EN nivå till /sass

import routes from "./routes";
import App from "./App";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: routes as RouteObject[],
    HydrateFallback: App,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
