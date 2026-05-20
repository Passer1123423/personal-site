import { matchPath, Route, Routes, useLocation } from "react-router-dom";
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import AboutPage from './pages/AboutPage'
import HomePage from './pages/HomePage'
import ProjectsPage from './pages/ProjectsPage'
import WorksPage from './pages/WorksPage'
import RegisterPage from "./pages/RegisterPage";
import UserPage from "./pages/UserPage";
import ComicReaderPage from './pages/ComicReaderPage'
import ComicsPage from './pages/ComicsPage'
import ComicSeriesPage from './pages/ComicSeriesPage'
import CreatorComicsPage from "./pages/CreatorComicsPage";
import CreatorComicSeriesPage from "./pages/CreatorComicSeriesPage";
import CreatorComicPartPage from "./pages/CreatorComicPartPage";
import AdminHomePage from "./pages/AdminHomePage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminComicsPage from "./pages/AdminComicsPage";
import AdminUsersPage from "./pages/AdminUsersPage";

function App() {
  const location = useLocation();

  const isComicReaderPage = Boolean(
    matchPath(
      "/works/comics/:seriesSlug/:partSlug/:chapterSlug",
      location.pathname,
    ),
  );

  return (
    <main className="min-h-screen bg-slate-50">
      {!isComicReaderPage && <Navbar />}
      
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/works" element={<WorksPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/users/:username" element={<UserPage />} />
        <Route path="/works/comics" element={<ComicsPage />} />
        <Route path="/works/comics/:seriesSlug" element={<ComicSeriesPage />} />
        <Route
          path="/works/comics/:seriesSlug/:partSlug/:chapterSlug"
          element={<ComicReaderPage />}
        />
        <Route path="/creator/comics" element={<CreatorComicsPage />} />
        <Route
          path="/creator/comics/:seriesSlug"
          element={<CreatorComicSeriesPage />}
        />
        <Route
          path="/creator/comics/:seriesSlug/:partSlug"
          element={<CreatorComicPartPage />}
        />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/comics" element={<AdminComicsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
      </Routes>

      <Footer />
    </main>
  )
}

export default App
