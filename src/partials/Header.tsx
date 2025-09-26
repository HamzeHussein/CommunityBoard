// src/partials/Header.tsx
import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container, Nav, Navbar } from 'react-bootstrap';
import routes from '../routes';

type AnyRoute = {
  path?: string;
  menuLabel?: string;
  index?: number;
  parent?: string;
};

export default function Header() {
  // whether the navbar is expanded or not (close after selection)
  const [expanded, setExpanded] = useState(false);

  // Always work with a *safe* array
  const allRoutes: AnyRoute[] = Array.isArray(routes) ? (routes as AnyRoute[]) : [];

  // Current path
  const pathName = useLocation().pathname;

  // Find current route by matching the longest path prefix first
  const currentRoute = useMemo(() => {
    return allRoutes
      .filter(r => typeof r?.path === 'string' && r.path!.length > 0)
      .slice()
      .sort((a, b) => (b.path!.length) - (a.path!.length)) // longest first
      .find(r => {
        const base = String(r.path).split(':')[0]; // handle /user/:id
        return base && pathName.indexOf(base) === 0;
      });
  }, [allRoutes, pathName]);

  // A route is active if exact match or its parent matches
  const isActive = (path?: string) =>
    !!path && (path === currentRoute?.path || path === currentRoute?.parent);

  // Menu items: only those with menuLabel, sorted by index
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
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </header>
  );
}
