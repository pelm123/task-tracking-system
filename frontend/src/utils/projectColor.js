// One color per project, stored on the project itself (projects.color) and
// chosen from a distinct palette when the project is created, so two projects
// never share nearly the same hue.
//
// Pages that only have a project_id (task rows, calendar chips, ...) look the
// color up through this registry. ProjectContext fills it every time the
// project list loads or changes, before the pages re-render.
let colorById = new Map();

export function registerProjectColors(projects) {
  colorById = new Map(projects.filter((p) => p.color).map((p) => [p.id, p.color]));
}

// Fallback for a project that has no stored color yet (e.g. before the
// migration is run): the old hash-derived hue.
function hashedColor(projectId) {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360}, 60%, 55%)`;
}

export function colorForProject(projectId) {
  if (!projectId) return 'var(--color-text-muted)';
  return colorById.get(projectId) || hashedColor(projectId);
}
