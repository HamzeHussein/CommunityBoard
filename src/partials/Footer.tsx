export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer mt-5 border-top bg-light">
      <div className="container py-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
          <div className="text-muted small">
            © {year} <strong>CommunityHub</strong> · Byggd med ❤️ med React + Bootstrap
          </div>
          <div className="d-flex gap-3 small">
            <a
              className="link-secondary text-decoration-none"
              href="https://getbootstrap.com/"
              target="_blank"
              rel="noreferrer"
            >
              Bootstrap
            </a>
            <a
              className="link-secondary text-decoration-none"
              href="https://react.dev/"
              target="_blank"
              rel="noreferrer"
            >
              React
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
