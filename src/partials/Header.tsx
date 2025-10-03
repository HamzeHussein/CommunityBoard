import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Container, Nav, Navbar } from "react-bootstrap";
import routes from "../routes";
import { useAuth } from "../hooks/useAuth";

type AnyRoute = {
  path?: string;
  menuLabel?: string;
  index?: number;
  parent?: string;
};

type HeaderProps = {
  appName?: string;
};

export default function Header({ appName = "CommunityHub" }: HeaderProps) {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  const menuItems: AnyRoute[] = useMemo(() => {
    const arr = Array.isArray(routes) ? (routes as AnyRoute[]) : [];
    return arr
      .filter((r) => !!r?.menuLabel && typeof r?.path === "string")
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }, []);

  const isActive = (path?: string) =>
    !!path && (location.pathname === path || location.pathname.startsWith(`${path}/`));

  return (
    <header className="app-header">
      <Navbar
        expanded={expanded}
        expand="md"
        className="bg-primary shadow-sm"
        data-bs-theme="dark"
        fixed="top"
      >
        <Container fluid>
          <Navbar.Brand as={Link} to="/" className="fw-bold d-flex align-items-center gap-2">
            <span className="logo-bubble">💬</span>
            <span className="logo-text">{appName}</span>
          </Navbar.Brand>

          <Navbar.Toggle
            aria-controls="main-nav"
            onClick={() => setExpanded((x) => !x)}
          />

          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto">
              {menuItems.map(({ path, menuLabel }, i) => (
                <Nav.Link
                  as={Link}
                  key={`${path}-${i}`}
                  to={path as string}
                  className={isActive(path) ? "active" : ""}
                  onClick={() => setTimeout(() => setExpanded(false), 150)}
                >
                  {menuLabel}
                </Nav.Link>
              ))}
            </Nav>

            <Nav className="align-items-center gap-2">
              {user ? (
                <>
                  <span className="navbar-text small text-light">
                    Hej, <strong>{user.username}</strong>
                  </span>
                  <span
                    className={`badge ${user.role === "admin" ? "text-bg-warning" : "text-bg-light"
                      }`}
                    title={`Roll: ${user.role}`}
                  >
                    {user.role}
                  </span>
                  <Nav.Link
                    as="button"
                    className="btn btn-sm btn-outline-light ms-2"
                    onClick={() => {
                      logout();
                      setExpanded(false);
                    }}
                  >
                    Logga ut
                  </Nav.Link>
                </>
              ) : (
                <>
                  <Nav.Link
                    as={Link}
                    to="/login"
                    onClick={() => setTimeout(() => setExpanded(false), 150)}
                  >
                    Logga in
                  </Nav.Link>
                  <Nav.Link
                    as={Link}
                    to="/register"
                    onClick={() => setTimeout(() => setExpanded(false), 150)}
                  >
                    Registrera
                  </Nav.Link>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <div style={{ height: "64px" }} />
    </header>
  );
}
