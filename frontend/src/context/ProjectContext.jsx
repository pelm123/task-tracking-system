import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as projectsApi from '../api/projects';
import { registerProjectColors } from '../utils/projectColor';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(
    () => localStorage.getItem('currentProjectId') || null
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await projectsApi.listProjects();
    registerProjectColors(data); // before setProjects, so the re-render already sees the colors
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
    setProjects((prev) => {
      const next = [...prev, created];
      registerProjectColors(next);
      return next;
    });
    selectProject(created.id);
    return created;
  }

  async function deleteProject(id) {
    await projectsApi.deleteProject(id);
    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== id);
      if (currentProjectId === id) {
        selectProject(remaining[0]?.id || null);
      }
      return remaining;
    });
  }

  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  return (
    <ProjectContext.Provider
      value={{ projects, currentProjectId, currentProject, loading, selectProject, createProject, deleteProject, refresh }}
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
