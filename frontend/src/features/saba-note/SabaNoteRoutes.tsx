import { Route, Routes } from "react-router-dom";

import SabaNoteDerivationPage from "./pages/SabaNoteDerivationPage";
import SabaNoteManagePage from "./pages/SabaNoteManagePage";
import SabaNoteOverviewPage from "./pages/SabaNoteOverviewPage";
import SabaNoteTrashPage from "./pages/SabaNoteTrashPage";
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
      <Route path="manage" element={<SabaNoteManagePage />} />
      <Route path="trash" element={<SabaNoteTrashPage />} />
    </Routes>
  );
}
