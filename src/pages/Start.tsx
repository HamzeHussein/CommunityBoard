// src/pages/Start.tsx
import { Row, Col, Card } from "react-bootstrap";
import { Link } from "react-router-dom";
import { FaComments, FaUsers, FaInfoCircle } from "react-icons/fa";

export default function Start() {
  return (
    <div className="py-5">
      <Row className="justify-content-center text-center mb-4">
        <Col md={8}>
          <h1 className="fw-bold mb-3">
            🌐 Välkommen till <span className="text-primary">CommunityHub</span>
          </h1>
          <p className="lead text-muted">
            Här kan du läsa inlägg, dela dina tankar och vara en del av vårt community.
          </p>

          {/* Byt från <Button as={Link} ...> till ren Link med btn-klasser */}
          <Link to="/board" className="btn btn-primary btn-lg mt-3 shadow-sm">
            Gå till Community Board →
          </Link>
        </Col>
      </Row>

      <Row className="g-4 mt-4">
        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="text-center">
              <FaComments size={40} className="mb-3 text-primary" />
              <Card.Title>Diskutera</Card.Title>
              <Card.Text>
                Starta konversationer, kommentera och håll dig uppdaterad.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="text-center">
              <FaUsers size={40} className="mb-3 text-success" />
              <Card.Title>Gemenskap</Card.Title>
              <Card.Text>
                Anslut till andra medlemmar och dela erfarenheter och idéer.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="text-center">
              <FaInfoCircle size={40} className="mb-3 text-warning" />
              <Card.Title>Information</Card.Title>
              <Card.Text>
                Hitta de senaste nyheterna, uppdateringarna och viktig information.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

(Start as any).route = {
  path: "/",
  menuLabel: "Start",
  index: 1,
};
