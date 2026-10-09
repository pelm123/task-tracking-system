import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import styles from './projectSwitcher.module.css';
import { colorForProject } from '../utils/projectColor';

const SEARCH_THRESHOLD = 6;

export default function ProjectSwitcher({ canManageProjects }) {
  const { projects, currentProjectId, currentProject, selectProject } = useProject();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  function handleSelect(id) {
    selectProject(id);
    setOpen(false);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {currentProject ? (
          <>
            <span className={styles.dot} style={{ background: colorForProject(currentProject.id) }} />
            <span className={styles.triggerName}>{currentProject.name}</span>
            <span className={styles.countBadge}>{currentProject.task_count}</span>
          </>
        ) : (
          <span className={styles.triggerName}>No projects yet</span>
        )}
        <span className={styles.chevron}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={styles.panel}>
          {projects.length > SEARCH_THRESHOLD && (
            <div className={styles.searchWrap}>
              <input
                className={styles.searchInput}
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className={styles.list}>
            {filtered.length === 0 && <p className={styles.emptyText}>No matching projects</p>}
            {filtered.map((p) => (
              <div
                key={p.id}
                className={`${styles.row} ${p.id === currentProjectId ? styles.rowActive : ''}`}
                onClick={() => handleSelect(p.id)}
              >
                <span className={styles.dot} style={{ background: colorForProject(p.id) }} />
                <span className={styles.rowName} title={p.name}>
                  {p.name}
                </span>
                <span className={styles.countBadge}>{p.task_count}</span>
              </div>
            ))}
          </div>

          {canManageProjects && (
            <Link
              to="/home"
              className={styles.newProjectBtn}
              style={{ textDecoration: 'none', boxSizing: 'border-box' }}
              onClick={() => setOpen(false)}
            >
              Manage projects on Home →
            </Link>
          )}
        </div>
      )}

    </div>
  );
}
