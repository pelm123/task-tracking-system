// Order for people pickers: by role (admin, then PM, then member), and A–Z by
// name inside each role. Case-insensitive, numbers in natural order, and Thai
// names sorted by Thai rules.
const ROLE_ORDER = { admin: 0, pm: 1, member: 2 };
const collator = new Intl.Collator(['en', 'th'], { sensitivity: 'base', numeric: true });

export function sortUsersByRole(users) {
  return [...users].sort(
    (a, b) =>
      (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3) || collator.compare(a.name || '', b.name || '')
  );
}
