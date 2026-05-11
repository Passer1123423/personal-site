import { Route, Routes } from 'react-router'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import AboutPage from './pages/AboutPage'
import HomePage from './pages/HomePage'
import ProjectsPage from './pages/ProjectsPage'
import WorksPage from './pages/WorksPage'
import ComicReaderPage from './pages/ComicReaderPage'
import ComicsPage from './pages/ComicsPage'
import ComicSeriesPage from './pages/ComicSeriesPage'

function App() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/works" element={<WorksPage />} />
        <Route path="/works/comics" element={<ComicsPage />} />
        <Route path="/works/comics/:seriesSlug" element={<ComicSeriesPage />} />
        <Route
          path="/works/comics/:seriesSlug/:partSlug/:chapterSlug"
          element={<ComicReaderPage />}
        />
        <Route path="/about" element={<AboutPage />} />
      </Routes>

      <Footer />
    </main>
  )
}

export default App
