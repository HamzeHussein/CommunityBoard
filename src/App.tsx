// src/App.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import Header from "./partials/Header";
import Main from "./partials/Main";
import Footer from "./partials/Footer";
import BootstrapBreakpoints from "./parts/BootstrapBreakpoints";

// Auth-provider
import { AuthProvider } from "./hooks/useAuth";

// Theme-provider
import ThemeProvider from "./theme/ThemeProvider";
import "./theme/theme.css";

const showBootstrapBreakpoints = true;

export default function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Header appName="CommunityHub" />
        <Main />
        <Footer />
        {showBootstrapBreakpoints ? <BootstrapBreakpoints /> : null}
      </AuthProvider>
    </ThemeProvider>
  );
}
