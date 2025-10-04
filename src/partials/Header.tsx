// src/partials/Header.tsx
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Container, Nav, Navbar, Dropdown, Modal, Form } from "react-bootstrap";
import routes from "../routes";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../theme/ThemeProvider";
import { profileApi } from "../utils/api";

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
  const { theme, effectiveTheme, setTheme, toggle } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  // Kontaktinfo-modal state
  const [showProfile, setShowProfile] = useState(false);
  const [pfEmail, setPfEmail] = useState("");
  const [pfPhone, setPfPhone] = useState("");
  const [pfLoading, setPfLoading] = useState(false);
  const [pfSaving, setPfSaving] = useState(false);
  const [pfError, setPfError] = useState<string | null>(null);
  const [pfSuccess, setPfSuccess] = useState<string | null>(null);

  const menuItems: AnyRoute[] = useMemo(() => {
    const arr = Array.isArray(routes) ? (routes as AnyRoute[]) : [];
    return arr
      .filter((r) => !!r?.menuLabel && typeof r?.path === "string")
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }, []);

  const isActive = (path?: string) =>
    !!path &&
    (location.pathname === path || location.pathname.startsWith(`${path}/`));

  async function openProfileModal() {
    setShowProfile(true);
    setPfLoading(true);
    setPfError(null);
    setPfSuccess(null);
    try {
      const me = await profileApi.get();
      setPfEmail(me.email ?? "");
      setPfPhone(me.phone ?? "");
    } catch (e: any) {
      setPfError(e?.message ?? "Kunde inte hämta profil.");
    } finally {
      setPfLoading(false);
    }
  }

  async function saveProfile() {
    setPfSaving(true);
    setPfError(null);
    setPfSuccess(null);
    try {
      await profileApi.update({ email: pfEmail || undefined, phone: pfPhone || undefined });
      setPfSuccess("Sparat!");
    } catch (e: any) {
      setPfError(e?.message ?? "Kunde inte spara.");
    } finally {
      setPfSaving(false);
    }
  }

  return (
    <header className="app-header" role="banner">
      <Navbar
        expanded={expanded}
        expand="md"
        className="bg-primary shadow-sm"
        data-bs-theme="dark"
        fixed="top"
      >
        <Container fluid>
          <Navbar.Brand
            as={Link}
            to="/"
            className="fw-bold d-flex align-items-center gap-2"
            aria-label={`${appName} startsida`}
            onClick={() => setTimeout(() => setExpanded(false), 150)}
          >
            <span className="logo-bubble" aria-hidden>💬</span>
            <span className="logo-text">{appName}</span>
          </Navbar.Brand>

          <Navbar.Toggle
            aria-controls="main-nav"
            aria-label="Öppna/stäng meny"
            onClick={() => setExpanded((x) => !x)}
          />

          <Navbar.Collapse id="main-nav" role="navigation" aria-label="Huvudmeny">
            {/* Vänster meny (från routes med menuLabel) */}
            <Nav className="me-auto">
              {menuItems.map(({ path, menuLabel }, i) => (
                <Nav.Link
                  as={Link}
                  key={`${path}-${i}`}
                  to={path as string}
                  className={isActive(path) ? "active" : ""}
                  onClick={() => setTimeout(() => setExpanded(false), 150)}
                  aria-current={isActive(path) ? "page" : undefined}
                >
                  {menuLabel}
                </Nav.Link>
              ))}
            </Nav>

            {/* Högerdel (tema + auth) */}
            <Nav className="align-items-center gap-2">
              {/* Tema-toggle */}
              <Dropdown align="end">
                <Dropdown.Toggle
                  variant="outline-light"
                  size="sm"
                  id="theme-toggle"
                  aria-label={`Tema: ${effectiveTheme}. Ändra tema`}
                >
                  {effectiveTheme === "dark" ? "🌙 Mörkt" : "☀️ Ljust"}
                </Dropdown.Toggle>
                <Dropdown.Menu aria-labelledby="theme-toggle">
                  <Dropdown.Item
                    active={theme === "light"}
                    onClick={() => setTheme("light")}
                    aria-checked={theme === "light"}
                    role="menuitemradio"
                  >
                    ☀️ Ljust
                  </Dropdown.Item>
                  <Dropdown.Item
                    active={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    aria-checked={theme === "dark"}
                    role="menuitemradio"
                  >
                    🌙 Mörkt
                  </Dropdown.Item>
                  <Dropdown.Item
                    active={theme === "system"}
                    onClick={() => setTheme("system")}
                    aria-checked={theme === "system"}
                    role="menuitemradio"
                  >
                    💻 System
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={toggle}>Växla (snabb)</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              {user ? (
                <>
                  {/* Hej, Namn (klick öppnar kontaktinfo) */}
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-light text-decoration-none"
                    onClick={openProfileModal}
                    title="Redigera kontaktinfo"
                    aria-label="Redigera kontaktinfo"
                  >
                    Hej, <strong>{user.username}</strong>
                  </button>

                  {/* Logga ut */}
                  <Nav.Link
                    as="button"
                    className="btn btn-sm btn-outline-light ms-1"
                    onClick={() => {
                      logout();
                      setExpanded(false);
                    }}
                    title="Logga ut"
                    aria-label="Logga ut"
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

      {/* spacer så content inte hamnar under fixed headern */}
      <div style={{ height: "64px" }} />

      {/* Kontaktinfo-modal */}
      <Modal
        show={showProfile}
        onHide={() => setShowProfile(false)}
        centered
        aria-labelledby="kontaktinfo-title"
      >
        <Modal.Header closeButton>
          <Modal.Title id="kontaktinfo-title">Kontaktinfo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pfLoading ? (
            <div className="text-muted">Laddar…</div>
          ) : (
            <>
              {pfError && <div className="alert alert-danger py-2">{pfError}</div>}
              {pfSuccess && <div className="alert alert-success py-2">{pfSuccess}</div>}

              <Form>
                <Form.Group className="mb-3" controlId="pfEmail">
                  <Form.Label>E-postadress</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="namn@exempel.se"
                    value={pfEmail}
                    onChange={(e) => setPfEmail(e.target.value)}
                  />
                  <Form.Text className="text-muted">
                    Lämna tomt om du inte vill ange e-post.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-0" controlId="pfPhone">
                  <Form.Label>Mobilnummer</Form.Label>
                  <Form.Control
                    type="tel"
                    placeholder="+46 7X XXX XX XX"
                    value={pfPhone}
                    onChange={(e) => setPfPhone(e.target.value)}
                  />
                  <Form.Text className="text-muted">
                    Tillåtna tecken: siffror, mellanslag, bindestreck och ev. + i början.
                  </Form.Text>
                </Form.Group>
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowProfile(false)}
          >
            Stäng
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveProfile}
            disabled={pfLoading || pfSaving}
          >
            {pfSaving ? "Sparar…" : "Spara"}
          </button>
        </Modal.Footer>
      </Modal>
    </header>
  );
}
