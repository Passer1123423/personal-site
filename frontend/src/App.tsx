import { Route, Routes } from 'react-router'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import AboutPage from './pages/AboutPage'
import HomePage from './pages/HomePage'
import ProjectsPage from './pages/ProjectsPage'
import WorksPage from './pages/WorksPage'

function App() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/works" element={<WorksPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>

      <Footer />
    </main>
  )
}

export default App
