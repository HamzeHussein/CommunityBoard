import { Outlet } from "react-router-dom";
import { Container } from "react-bootstrap";
import { useStateObject } from "../utils/useStateObject";
import "bootstrap/dist/css/bootstrap.min.css";
import "./sass/index.scss";

export default function Main() {
  const stateAndSetter = useStateObject({
    categoryChoice: "All",
    sortChoice: "Price (low to high)",
    bwImages: false,
  });

  return (
    <main className="app-main mt-4">
      <Container className="mb-5">
        <Outlet context={stateAndSetter} />
      </Container>
    </main>
  );
}
