// One-off fix for attachments uploaded before the encoding bug (in
// attachment.controller.js's uploadAttachment) was fixed. Those got their
// file_name stored as UTF-8 bytes misread as Latin-1 — e.g. Thai filenames
// came out as "à¸£à¸°à¸...". Re-decoding those same bytes as UTF-8 recovers the
// original text. Plain ASCII filenames (most English names) are byte-for-byte
// identical either way, so this is safe to run even on names that were never
// broken — it's a no-op for them.
//
// Run once from the backend/ folder after deploying the controller fix:
//   node scripts/fix-attachment-filenames.js
const pool = require('../src/config/db');

function fixFilenameEncoding(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

async function main() {
  const { rows } = await pool.query('SELECT id, file_name FROM attachments');
  let fixed = 0;

  for (const row of rows) {
    const corrected = fixFilenameEncoding(row.file_name);
    if (corrected !== row.file_name) {
      await pool.query('UPDATE attachments SET file_name = $1 WHERE id = $2', [corrected, row.id]);
      console.log(`Fixed: "${row.file_name}" -> "${corrected}"`);
      fixed++;
    }
  }

  console.log(`\nDone. ${fixed} of ${rows.length} attachment name(s) updated.`);
  await pool.end();
}

main().catch((err) => {
  console.error('Fix script failed:', err.message);
  process.exit(1);
});
