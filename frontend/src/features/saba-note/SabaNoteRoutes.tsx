import { Route, Routes } from "react-router-dom";

import SabaNoteDerivationPage from "./pages/SabaNoteDerivationPage";
import SabaNoteOverviewPage from "./pages/SabaNoteOverviewPage";
import SabaNoteWorkspacePage from "./pages/SabaNoteWorkspacePage";
import "./saba-note.css";

export default function SabaNoteRoutes() {
  return (
    <Routes>
      <Route index element={<SabaNoteOverviewPage />} />
      <Route
        path="derivation/:id"
        element={<SabaNoteDerivationPage />}
      />
      <Route path="workspace" element={<SabaNoteWorkspacePage />} />
    </Routes>
  );
}
