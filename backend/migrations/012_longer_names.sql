-- Project names and task titles were capped at 150 / 200 characters, so a
-- longer one (common with full Thai project names) failed with
-- "value too long for type character varying". Raised to 500 each; the API
-- and the forms enforce the same limit with a clear message.
ALTER TABLE projects ALTER COLUMN name TYPE VARCHAR(500);
ALTER TABLE tasks ALTER COLUMN title TYPE VARCHAR(500);
