// src/partials/Header.tsx
import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container, Nav, Navbar } from 'react-bootstrap';
import routes from '../routes';
import { useAuth } from '../hooks/useAuth';

type AnyRoute = {
  path?: string;
  menuLabel?: string;
  index?: number;
  parent?: string;
};

export default function Header() {
  const [expanded, setExpanded] = useState(false);
  const { user, logout } = useAuth();

  const allRoutes: AnyRoute[] = Array.isArray(routes) ? (routes as AnyRoute[]) : [];
  const pathName = useLocation().pathname;

  const currentRoute = useMemo(() => {
    return allRoutes
      .filter(r => typeof r?.path === 'string' && r.path!.length > 0)
      .slice()
      .sort((a, b) => (b.path!.length) - (a.path!.length))
      .find(r => {
        const base = String(r.path).split(':')[0];
        return base && pathName.indexOf(base) === 0;
      });
  }, [allRoutes, pathName]);

  const isActive = (path?: string) =>
    !!path && (path === currentRoute?.path || path === currentRoute?.parent);

  const menuItems = useMemo(() => {
    return allRoutes
      .filter(r => !!r?.menuLabel && typeof r?.path === 'string')
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }, [allRoutes]);

  return (
    <header>
      <Navbar
        expanded={expanded}
        expand="md"
        className="bg-primary"
        data-bs-theme="dark"
        fixed="top"
      >
        <Container fluid>
          <Navbar.Brand className="me-5" as={Link} to="/">
            My webapp
          </Navbar.Brand>

          <Navbar.Toggle onClick={() => setExpanded(!expanded)} />

          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              {menuItems.map(({ menuLabel, path }, i) => (
                <Nav.Link
                  as={Link}
                  key={`${path}-${i}`}
                  to={path as string}
                  className={isActive(path) ? 'active' : ''}
                  onClick={() => setTimeout(() => setExpanded(false), 200)}
                >
                  {menuLabel}
                </Nav.Link>
              ))}
            </Nav>

            {/* Auth-del till höger */}
            <Nav>
              {user ? (
                <>
                  <Nav.Item className="me-3 text-light">
                    Hej, <strong>{user.username}</strong> ({user.role})
                  </Nav.Item>
                  <Nav.Link
                    as="button"
                    onClick={() => {
                      logout();
                      setExpanded(false);
                    }}
                    className="btn btn-sm btn-outline-light"
                  >
                    Logga ut
                  </Nav.Link>
                </>
              ) : (
                <>
                  <Nav.Link as={Link} to="/login" onClick={() => setExpanded(false)}>
                    Logga in
                  </Nav.Link>
                  <Nav.Link as={Link} to="/register" onClick={() => setExpanded(false)}>
                    Registrera
                  </Nav.Link>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </header>
  );
}
