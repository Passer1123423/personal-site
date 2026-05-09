import Footer from './components/Footer'
import Hero from './components/Hero'
import Navbar from './components/Navbar'
import ProjectsSection from './components/ProjectsSection'
import WorksSection from './components/WorksSection'

function App() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <Hero />
      <ProjectsSection />
      <WorksSection />
      <Footer />
    </main>
  )
}

export default App
