import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Chaque test repart d'un écran vide (Testing Library ne nettoie pas tout seul sans les globals de Vitest).
afterEach(cleanup);
