import { Outlet } from "react-router-dom";
import { Container } from "react-bootstrap";
import { useStateObject } from "../utils/useStateObject";
// CSS laddas redan i entry (src/main.tsx)
// Om du ändå vill ladda din egen SCSS här: 
// import "../../sass/index.scss"; // från /src/partials upp TVÅ nivåer till /sass

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
