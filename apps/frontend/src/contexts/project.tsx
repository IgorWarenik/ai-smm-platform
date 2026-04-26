'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Project = { id: string; name: string; description?: string }

type ProjectCtx = {
  activeProject: Project | null
  setActiveProject: (p: Project | null) => void
  clearActiveProject: () => void
}

const ProjectContext = createContext<ProjectCtx | null>(null)

const STORAGE_KEY = 'active_project'

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProjectState] = useState<Project | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setActiveProjectState(JSON.parse(stored))
    } catch { }
  }, [])

  const setActiveProject = useCallback((p: Project | null) => {
    setActiveProjectState(p)
    if (p) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const clearActiveProject = useCallback(() => {
    setActiveProjectState(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject, clearActiveProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider')
  return ctx
}
