import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import styles from './projectSwitcher.module.css';
import { colorForProject } from '../utils/projectColor';
import { t } from '../i18n';

const SEARCH_THRESHOLD = 6;

// Two modes:
//  - default (Board): picks the app-wide current project.
//  - controlled (Calendar): pass `value` / `onChange` and `allOption` to add an
//    "All projects" entry — the same dropdown, just driven by the page.
export default function ProjectSwitcher({
  canManageProjects,
  value,
  onChange,
  allOption,
  alignRight = false,
}) {
  const { projects, currentProjectId: ctxProjectId, currentProject: ctxProject, selectProject } = useProject();
  const controlled = typeof onChange === 'function';
  const currentProjectId = controlled ? value : ctxProjectId;
  const showingAll = controlled && allOption && value === allOption.value;
  const currentProject = controlled
    ? projects.find((p) => p.id === value) || null
    : ctxProject;
  const totalTasks = projects.reduce((sum, p) => sum + (Number(p.task_count) || 0), 0);
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
    if (controlled) onChange(id);
    else selectProject(id);
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
        {showingAll ? (
          <>
            <span className={styles.allDot} aria-hidden="true" />
            <span className={styles.triggerName}>{allOption.label}</span>
            <span className={styles.countBadge}>{totalTasks}</span>
          </>
        ) : currentProject ? (
          <>
            <span className={styles.dot} style={{ background: colorForProject(currentProject.id) }} />
            <span className={styles.triggerName}>{currentProject.name}</span>
            <span className={styles.countBadge}>{currentProject.task_count}</span>
          </>
        ) : (
          <span className={styles.triggerName}>{t('switcher.none')}</span>
        )}
        <span className={styles.chevron}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={`${styles.panel} ${alignRight ? styles.panelRight : ''}`}>
          {projects.length > SEARCH_THRESHOLD && (
            <div className={styles.searchWrap}>
              <input
                className={styles.searchInput}
                placeholder={t('switcher.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className={styles.list}>
            {allOption && !search.trim() && (
              <div
                className={`${styles.row} ${showingAll ? styles.rowActive : ''}`}
                onClick={() => handleSelect(allOption.value)}
              >
                <span className={styles.allDot} aria-hidden="true" />
                <span className={styles.rowName}>{allOption.label}</span>
                <span className={styles.countBadge}>{totalTasks}</span>
              </div>
            )}
            {filtered.length === 0 && <p className={styles.emptyText}>{t('switcher.noMatch')}</p>}
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
              {t('switcher.manage')}
            </Link>
          )}
        </div>
      )}

    </div>
  );
}
