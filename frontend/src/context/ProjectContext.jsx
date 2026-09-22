import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as projectsApi from '../api/projects';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(
    () => localStorage.getItem('currentProjectId') || null
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await projectsApi.listProjects();
    setProjects(data);
    // if nothing selected yet (or the saved selection no longer exists), default to the first project
    setCurrentProjectId((prev) => {
      if (prev && data.some((p) => p.id === prev)) return prev;
      return data[0]?.id || null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function selectProject(id) {
    setCurrentProjectId(id);
    localStorage.setItem('currentProjectId', id);
  }

  async function createProject(payload) {
    const created = await projectsApi.createProject(payload);
    setProjects((prev) => [...prev, created]);
    selectProject(created.id);
    return created;
  }

  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  return (
    <ProjectContext.Provider
      value={{ projects, currentProjectId, currentProject, loading, selectProject, createProject, refresh }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
