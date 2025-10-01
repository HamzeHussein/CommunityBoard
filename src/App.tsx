// src/App.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import Header from "./partials/Header";
import Main from "./partials/Main";
import Footer from "./partials/Footer";
import BootstrapBreakpoints from "./parts/BootstrapBreakpoints";

// Auth-provider (från src/hooks/useAuth)
import { AuthProvider } from "./hooks/useAuth";

// slå av/på vid behov
const showBootstrapBreakpoints = true;

export default function App() {
  const location = useLocation();

  // scrolla upp vid varje ruttbyte
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <AuthProvider>
      <Header />
      <Main />
      <Footer />
      {showBootstrapBreakpoints ? <BootstrapBreakpoints /> : null}
    </AuthProvider>
  );
}
