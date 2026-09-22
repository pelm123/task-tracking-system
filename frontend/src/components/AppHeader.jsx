import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import NewProjectModal from './NewProjectModal';
import styles from './appHeader.module.css';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { projects, currentProjectId, selectProject, createProject } = useProject();
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
          <button className={styles.iconBtn} onClick={() => setShowNewProject(true)}>
            + Project
          </button>
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
        <span className={styles.userLabel}>
          {user?.name} · {user?.role}
        </span>
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
