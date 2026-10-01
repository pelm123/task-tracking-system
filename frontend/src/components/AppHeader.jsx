import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import NewProjectModal from './NewProjectModal';
import styles from './appHeader.module.css';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { projects, currentProjectId, currentProject, selectProject, createProject, deleteProject } = useProject();
  const [showNewProject, setShowNewProject] = useState(false);
  const canManageProjects = ['admin', 'pm'].includes(user?.role);

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={styles.brand}>Task Tracker</span>

        <select
          value={currentProjectId || ''}
          onChange={(e) => selectProject(e.target.value)}
          style={{ fontSize: 13 }}
        >
          {projects.length === 0 && <option value="">No projects yet</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.task_count})
            </option>
          ))}
        </select>

        {canManageProjects && (
          <>
            <button className={styles.iconBtn} onClick={() => setShowNewProject(true)}>
              + Project
            </button>
            {currentProject && (
              <button
                className={styles.iconBtn}
                style={{ borderColor: 'var(--priority-high)', color: 'var(--priority-high)' }}
                onClick={async () => {
                  if (
                    window.confirm(
                      `Delete "${currentProject.name}"? This permanently deletes ALL ${currentProject.task_count} task(s) in it. This cannot be undone.`
                    )
                  ) {
                    await deleteProject(currentProject.id);
                  }
                }}
              >
                Delete project
              </button>
            )}
          </>
        )}

        <nav className={styles.nav}>
          <NavLink
            to="/board"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Board
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Dashboard
          </NavLink>
          {['admin', 'pm'].includes(user?.role) && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              Admin
            </NavLink>
          )}
        </nav>
      </div>
      <div className={styles.right}>
        <NavLink to="/profile" className={styles.userLabel} style={{ textDecoration: 'none' }}>
          {user?.name} · {user?.role}
        </NavLink>
        <button className={styles.iconBtn} onClick={logout}>
          Log out
        </button>
      </div>

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={createProject} />
      )}
    </div>
  );
}
