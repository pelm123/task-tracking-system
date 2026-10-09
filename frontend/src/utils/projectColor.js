// Deterministic hash-to-color shared across the app, so a given project is the
// same color on Home, Calendar, Dashboard and the Board.
export function colorForProject(projectId) {
  if (!projectId) return 'var(--color-text-muted)';
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360}, 60%, 55%)`;
}
