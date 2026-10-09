-- Each project now stores its own color (previously derived from a hash of
-- its id, which could give two projects nearly the same hue). Existing
-- projects are backfilled from the palette in creation order, so the first
-- twelve all get different colors; new projects pick the first unused one.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color VARCHAR(7);

UPDATE projects p
SET color = (ARRAY[
  '#4C8DFF','#F0A93B','#3FBF7F','#E255A1','#8E7CFF','#25B7C9',
  '#B6CB3B','#D14DDB','#B58863','#7C93A8','#FF8FA3','#C4A7E7'
])[((r.rn - 1) % 12) + 1]
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn FROM projects
) r
WHERE r.id = p.id AND p.color IS NULL;
