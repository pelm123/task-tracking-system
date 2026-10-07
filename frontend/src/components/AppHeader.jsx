import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import NewProjectModal from './NewProjectModal';
import NotificationBell from './NotificationBell';
import styles from './appHeader.module.css';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { projects, currentProjectId, currentProject, selectProject, createProject, deleteProject } = useProject();
  const [showNewProject, setShowNewProject] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const canManageProjects = ['admin', 'pm'].includes(user?.role);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleDeleteProject() {
    setMenuOpen(false);
    if (
      window.confirm(
        `Delete "${currentProject.name}"? This permanently deletes ALL ${currentProject.task_count} task(s) in it. This cannot be undone.`
      )
    ) {
      await deleteProject(currentProject.id);
    }
  }

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={styles.brand}>Task Tracker</span>

        <div className={styles.projectPicker}>
          <select value={currentProjectId || ''} onChange={(e) => selectProject(e.target.value)}>
            {projects.length === 0 && <option value="">No projects yet</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.task_count})
              </option>
            ))}
          </select>

          {canManageProjects && (
            <div className={styles.menuWrap} ref={menuRef}>
              <button
                className={styles.menuTrigger}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Project actions"
              >
                ⋮
              </button>
              {menuOpen && (
                <div className={styles.menuDropdown}>
                  <button
                    className={styles.menuItem}
                    onClick={() => {
                      setMenuOpen(false);
                      setShowNewProject(true);
                    }}
                  >
                    + New project
                  </button>
                  {currentProject && (
                    <button
                      className={`${styles.menuItem} ${styles.menuItemDanger}`}
                      onClick={handleDeleteProject}
                    >
                      Delete "{currentProject.name}"
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className={styles.nav}>
          <NavLink
            to="/board"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Board
          </NavLink>
          <NavLink
            to="/calendar"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Calendar
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Dashboard
          </NavLink>
          {['admin', 'pm'].includes(user?.role) && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
            >
              Admin
            </NavLink>
          )}
        </nav>
      </div>

      <div className={styles.right}>
        <NotificationBell />
        <NavLink to="/profile" className={styles.userLabel} style={{ textDecoration: 'none' }}>
          {user?.name} · {user?.role}
        </NavLink>
        <button className="btn btn-ghost" onClick={logout}>
          Log out
        </button>
      </div>

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={createProject} />
      )}
    </div>
  );
}
