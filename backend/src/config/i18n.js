// Server-side translations (Thai / English).
//
// Used for text the SERVER writes on someone's behalf: in-app notifications,
// LINE messages, the "sent back" comment, and API error messages. Interface
// text lives in the frontend dictionaries (frontend/src/i18n).

const TZ = 'Asia/Bangkok';
const LANGS = ['th', 'en'];
const DEFAULT_LANG = 'th';

// Thai dates are forced onto the Gregorian calendar so the year reads 2026,
// not 2569 — the same choice the frontend makes.
const LOCALES = { en: 'en-US', th: 'th-TH-u-ca-gregory' };

function normalizeLang(value) {
  return LANGS.includes(value) ? value : DEFAULT_LANG;
}

// Picks a language from an Accept-Language header ("th,en;q=0.9" → "th").
function langFromHeader(header) {
  if (!header || typeof header !== 'string') return DEFAULT_LANG;
  const first = header.split(',')[0].trim().toLowerCase();
  if (first.startsWith('en')) return 'en';
  if (first.startsWith('th')) return 'th';
  return DEFAULT_LANG;
}

const DICT = {
  en: {
    someone: 'Someone',
    noDueDate: 'no due date',
    status: { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' },
    priority: { low: 'Low', medium: 'Medium', high: 'High' },
    n: {
      assigned: '{actor} assigned you to "{title}" ({priority} priority, due {due}) in {project}',
      updated: '{actor} updated "{title}" ({changes})',
      moved: '{actor} moved "{title}" from {from} → {to}',
      approved: '{actor} approved "{title}" — moved to {done}',
      denied: '{actor} returned "{title}" to {todo} ({why}) — "{reason}"',
      deniedWhyReopened: 'reopened',
      deniedWhyDenied: 'approval denied',
      comment: '{actor} commented on "{title}": "{snippet}"',
      dueSoon: '"{title}" is due {due} ({priority} priority)',
      overdue: '"{title}" is overdue — it was due {due} ({priority} priority)',
      changeTitle: 'title → "{value}"',
      changeDescription: 'description updated',
      changePriority: 'priority → {value}',
      changeDue: 'due date → {value}',
      changeReminder: 'reminder time updated',
    },
    commentReopened: 'Reopened — returned to To Do: {reason}',
    commentDenied: 'Approval denied — returned to To Do: {reason}',
    lineLinked: "Linked! You'll now get Task Tracker notifications here, {name}.",
  },
  th: {
    someone: 'ใครบางคน',
    noDueDate: 'ไม่มีกำหนดส่ง',
    status: { todo: 'ที่ต้องทำ', in_progress: 'กำลังทำ', review: 'รอตรวจ', done: 'เสร็จแล้ว' },
    priority: { low: 'ต่ำ', medium: 'ปานกลาง', high: 'สูง' },
    n: {
      assigned: '{actor} มอบหมายงาน "{title}" ให้คุณ (ความสำคัญ{priority}, กำหนดส่ง {due}) ในโปรเจกต์ {project}',
      updated: '{actor} แก้ไขงาน "{title}" ({changes})',
      moved: '{actor} ย้ายงาน "{title}" จาก {from} → {to}',
      approved: '{actor} อนุมัติงาน "{title}" — ย้ายไปสถานะ{done}',
      denied: '{actor} ส่งงาน "{title}" กลับไปสถานะ{todo} ({why}) — "{reason}"',
      deniedWhyReopened: 'เปิดงานอีกครั้ง',
      deniedWhyDenied: 'ไม่อนุมัติ',
      comment: '{actor} แสดงความคิดเห็นในงาน "{title}": "{snippet}"',
      dueSoon: 'งาน "{title}" ใกล้ถึงกำหนดส่ง {due} (ความสำคัญ{priority})',
      overdue: 'งาน "{title}" เลยกำหนดส่งแล้ว — กำหนดส่งคือ {due} (ความสำคัญ{priority})',
      changeTitle: 'ชื่องาน → "{value}"',
      changeDescription: 'แก้ไขรายละเอียด',
      changePriority: 'ความสำคัญ → {value}',
      changeDue: 'กำหนดส่ง → {value}',
      changeReminder: 'แก้ไขเวลาแจ้งเตือน',
    },
    commentReopened: 'เปิดงานอีกครั้ง — ส่งกลับไปสถานะที่ต้องทำ: {reason}',
    commentDenied: 'ไม่อนุมัติ — ส่งกลับไปสถานะที่ต้องทำ: {reason}',
    lineLinked: 'เชื่อมต่อสำเร็จ! คุณจะได้รับการแจ้งเตือนจากระบบติดตามงานที่นี่ {name}',
  },
};

function lookup(lang, path) {
  let cur = DICT[normalizeLang(lang)];
  for (const part of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function fill(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (m, key) =>
    params && params[key] !== undefined && params[key] !== null ? String(params[key]) : m
  );
}

// tr('th', 'n.moved', { actor, title, from, to })
function tr(lang, path, params) {
  const template = lookup(lang, path) ?? lookup('en', path) ?? path;
  return fill(template, params);
}

function statusLabel(lang, status) {
  return lookup(lang, `status.${status}`) ?? status;
}

function priorityLabel(lang, priority) {
  return lookup(lang, `priority.${priority}`) ?? priority;
}

// Due dates are pinned to Bangkok time. Without an explicit timeZone Node
// renders in the SERVER's zone (often UTC), which once made a 6:00 PM due
// date show up as 11:00 AM in notifications.
function formatDueDate(lang, dueDate) {
  if (!dueDate) return tr(lang, 'noDueDate');
  return new Date(dueDate).toLocaleString(LOCALES[normalizeLang(lang)], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  });
}

// A "language bundle" bound to one language, so call sites read naturally:
//   const L = forLang(user.language);  L.tr('n.comment', {...}); L.due(date)
function forLang(lang) {
  const l = normalizeLang(lang);
  return {
    lang: l,
    tr: (path, params) => tr(l, path, params),
    status: (s) => statusLabel(l, s),
    priority: (p) => priorityLabel(l, p),
    due: (d) => formatDueDate(l, d),
  };
}

// One entry of a task edit, e.g. { k: 'priority', v: 'high' }, as a short
// phrase in the reader's language. `L` is a bundle from forLang().
function describeChange(L, change) {
  switch (change.k) {
    case 'title':
      return L.tr('n.changeTitle', { value: change.v });
    case 'description':
      return L.tr('n.changeDescription');
    case 'priority':
      return L.tr('n.changePriority', { value: L.priority(change.v) });
    case 'due':
      return L.tr('n.changeDue', { value: L.due(change.v) });
    case 'reminder':
      return L.tr('n.changeReminder');
    default:
      return '';
  }
}

// ── API error / status messages ───────────────────────────────
// Controllers keep writing English messages; the localize middleware swaps
// them for Thai when the request asks for Thai. Exact matches first, then
// patterns for messages that carry numbers or names.
const TH_MESSAGES = {
  'Internal server error': 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
  'Task not found': 'ไม่พบงานนี้',
  'User not found': 'ไม่พบผู้ใช้',
  'Project not found': 'ไม่พบโปรเจกต์',
  'Attachment not found': 'ไม่พบไฟล์แนบ',
  'Notification not found': 'ไม่พบการแจ้งเตือน',
  'File missing from disk': 'ไม่พบไฟล์ในระบบจัดเก็บ',
  'taskIds must be a non-empty array': 'ต้องระบุงานอย่างน้อยหนึ่งงาน',
  'newPassword must be at least 6 characters': 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร',
  'name is required': 'กรุณากรอกชื่อ',
  'content is required': 'กรุณากรอกข้อความ',
  'title is required': 'กรุณากรอกชื่องาน',
  'project_id is required': 'กรุณาเลือกโปรเจกต์',
  'name, email, and password are required': 'กรุณากรอกชื่อ อีเมล และรหัสผ่าน',
  'email and password are required': 'กรุณากรอกอีเมลและรหัสผ่าน',
  'currentPassword and newPassword are required': 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่',
  'role must be "admin", "pm", or "member"': 'บทบาทต้องเป็น admin, pm หรือ member',
  'color must be a hex value like #4C8DFF': 'สีต้องเป็นค่าเลขฐานสิบหก เช่น #4C8DFF',
  'from and to must both be dates in YYYY-MM-DD format.': 'ต้องระบุวันที่เริ่มและสิ้นสุดในรูปแบบ YYYY-MM-DD',
  'The end date cannot be before the start date.': 'วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่ม',
  'Please choose a range of 5 years or less.': 'กรุณาเลือกช่วงเวลาไม่เกิน 5 ปี',
  'Invalid email or password': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'Email already registered': 'อีเมลนี้ถูกใช้สมัครแล้ว',
  'Current password is incorrect': 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
  'Password updated': 'เปลี่ยนรหัสผ่านแล้ว',
  'Account created. Please wait for an admin to approve it before logging in.':
    'สร้างบัญชีแล้ว กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าสู่ระบบ',
  'Your account is waiting for an admin to approve it. You can log in once it has been approved.':
    'บัญชีของคุณกำลังรอผู้ดูแลระบบอนุมัติ คุณจะเข้าสู่ระบบได้เมื่อได้รับอนุมัติแล้ว',
  'Missing or malformed Authorization header': 'ไม่พบข้อมูลยืนยันตัวตน หรือรูปแบบไม่ถูกต้อง',
  'Invalid or expired token': 'การเข้าสู่ระบบไม่ถูกต้องหรือหมดอายุ',
  'Insufficient permissions': 'คุณไม่มีสิทธิ์ทำรายการนี้',
  'There must always be at least one admin.': 'ต้องมีผู้ดูแลระบบอย่างน้อยหนึ่งคนเสมอ',
  "You can't delete your own account": 'คุณไม่สามารถลบบัญชีของตัวเองได้',
  "You can't change your own role": 'คุณไม่สามารถเปลี่ยนบทบาทของตัวเองได้',
  'You can only move tasks you are assigned to.': 'คุณย้ายได้เฉพาะงานที่ได้รับมอบหมาย',
  'You can only delete tasks you created.': 'คุณลบได้เฉพาะงานที่คุณสร้างเอง',
  'You can only upload files to tasks you are assigned to.': 'คุณอัปโหลดไฟล์ได้เฉพาะงานที่ได้รับมอบหมาย',
  'You can only reschedule tasks you are assigned to.': 'คุณเลื่อนกำหนดส่งได้เฉพาะงานที่ได้รับมอบหมาย',
  'You can only edit tasks you are assigned to.': 'คุณแก้ไขได้เฉพาะงานที่ได้รับมอบหมาย',
  'You can only delete files you uploaded, or files on tasks you are assigned to.':
    'คุณลบได้เฉพาะไฟล์ที่คุณอัปโหลด หรือไฟล์ในงานที่ได้รับมอบหมาย',
  'You can only comment on tasks you are assigned to.': 'คุณแสดงความคิดเห็นได้เฉพาะงานที่ได้รับมอบหมาย',
  'You can only change the reminder time on tasks you are assigned to.':
    'คุณเปลี่ยนเวลาแจ้งเตือนได้เฉพาะงานที่ได้รับมอบหมาย',
  'You can only change assignees on tasks you are already assigned to.':
    'คุณเปลี่ยนผู้รับผิดชอบได้เฉพาะงานที่คุณได้รับมอบหมายอยู่แล้ว',
  'You can only assign a task to yourself or others once a PM/admin has assigned you to it.':
    'คุณจะมอบหมายงานให้ตัวเองหรือผู้อื่นได้ก็ต่อเมื่อ PM/ผู้ดูแลระบบมอบหมายงานนั้นให้คุณแล้ว',
  'You can only add team members to help with a task.': 'คุณเพิ่มได้เฉพาะสมาชิกทีมเพื่อช่วยทำงาน',
  'Only a PM or admin can remove someone from a task.': 'เฉพาะ PM หรือผู้ดูแลระบบเท่านั้นที่เอาผู้รับผิดชอบออกจากงานได้',
  'Only a PM or admin can remove assignees from a task.': 'เฉพาะ PM หรือผู้ดูแลระบบเท่านั้นที่เอาผู้รับผิดชอบออกจากงานได้',
  'Only a PM or admin can move tasks to Done.': 'เฉพาะ PM หรือผู้ดูแลระบบเท่านั้นที่ย้ายงานไปสถานะเสร็จแล้วได้',
  'Only a PM or admin can move a task to Done. Move it to Review and ask your PM to approve it.':
    'เฉพาะ PM หรือผู้ดูแลระบบเท่านั้นที่ย้ายงานไปสถานะเสร็จแล้วได้ ให้ย้ายไปรอตรวจแล้วขอให้ PM อนุมัติ',
  'Members can only accept tasks or submit them for review.': 'สมาชิกทำได้เพียงรับงานหรือส่งงานให้ตรวจเท่านั้น',
  'Members can accept a To Do task, or move an In Progress task back to To Do or on to Review.':
    'สมาชิกรับงานที่ต้องทำได้ หรือย้ายงานที่กำลังทำกลับไปที่ต้องทำ หรือส่งไปรอตรวจได้',
  'Only To Do tasks can be accepted. Deselect the others and try again.':
    'รับได้เฉพาะงานที่อยู่ในสถานะที่ต้องทำ ยกเลิกการเลือกงานอื่นแล้วลองอีกครั้ง',
  'Only In Progress tasks can be sent back to To Do or submitted for review. Deselect the others and try again.':
    'ส่งกลับหรือส่งตรวจได้เฉพาะงานที่กำลังทำ ยกเลิกการเลือกงานอื่นแล้วลองอีกครั้ง',
  'Done tasks have to be reopened one at a time with a comment. Deselect them and try again.':
    'งานที่เสร็จแล้วต้องเปิดใหม่ทีละงานพร้อมความคิดเห็น ยกเลิกการเลือกแล้วลองอีกครั้ง',
  'A Done task has to be reopened with a comment explaining why. Use "Reopen" instead.':
    'งานที่เสร็จแล้วต้องเปิดใหม่พร้อมความคิดเห็นอธิบายเหตุผล โปรดใช้ปุ่ม "เปิดงานอีกครั้ง"',
  'Only a task in Review or Done can be sent back to To Do.': 'ส่งกลับไปที่ต้องทำได้เฉพาะงานที่อยู่ในสถานะรอตรวจหรือเสร็จแล้ว',
  'Only a task currently in Review can be approved.': 'อนุมัติได้เฉพาะงานที่อยู่ในสถานะรอตรวจ',
  'A comment explaining why the task is being sent back is required.': 'กรุณาระบุเหตุผลที่ส่งงานกลับ',
  'Comment not found or not yours to edit': 'ไม่พบความคิดเห็น หรือคุณไม่ใช่เจ้าของจึงแก้ไขไม่ได้',
  'Comment not found or not yours to delete': 'ไม่พบความคิดเห็น หรือคุณไม่ใช่เจ้าของจึงลบไม่ได้',
  'All notifications marked as read': 'ทำเครื่องหมายอ่านการแจ้งเตือนทั้งหมดแล้ว',
  'No file uploaded (expected field name "file")': 'ไม่พบไฟล์ที่อัปโหลด',
  'Could not upload that file.': 'อัปโหลดไฟล์นี้ไม่ได้',
  'This file type cannot be previewed.': 'ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ได้',
  'Only people assigned to this task (and PMs/admins) can open or download its files.':
    'เฉพาะผู้ที่ได้รับมอบหมายงานนี้ (และ PM/ผู้ดูแลระบบ) เท่านั้นที่เปิดหรือดาวน์โหลดไฟล์ได้',
  'Each preference value must be true or false': 'ค่าการตั้งค่าแต่ละรายการต้องเป็น true หรือ false',
  'language must be "th" or "en"': 'ภาษาต้องเป็น th หรือ en',
};

const TH_PATTERNS = [
  [/^status must be one of (.+)$/, (m) => `สถานะต้องเป็นหนึ่งใน: ${m[1]}`],
  [/^priority must be one of (.+)$/, (m) => `ความสำคัญต้องเป็นหนึ่งใน: ${m[1]}`],
  [
    /^reminder_hours_before must be a whole number of hours between (\d+) and (\d+)$/,
    (m) => `เวลาแจ้งเตือนล่วงหน้าต้องเป็นจำนวนเต็มของชั่วโมง ระหว่าง ${m[1]} ถึง ${m[2]}`,
  ],
  [
    /^Title is too long \((\d+) characters\)\. The limit is (\d+)\.$/,
    (m) => `ชื่องานยาวเกินไป (${m[1]} ตัวอักษร) จำกัดไม่เกิน ${m[2]} ตัวอักษร`,
  ],
  [
    /^Project name is too long \((\d+) characters\)\. The limit is (\d+)\.$/,
    (m) => `ชื่อโปรเจกต์ยาวเกินไป (${m[1]} ตัวอักษร) จำกัดไม่เกิน ${m[2]} ตัวอักษร`,
  ],
  [/^File is too large\. The limit is (\d+) MB\.$/, (m) => `ไฟล์ใหญ่เกินไป จำกัดไม่เกิน ${m[1]} MB`],
  [/^Unknown notification type: (.+)$/, (m) => `ไม่รู้จักประเภทการแจ้งเตือน: ${m[1]}`],
];

// Returns the Thai text for an English API message, or the original when
// there is no translation (so an unmapped message degrades to English).
function translateMessage(lang, message) {
  if (normalizeLang(lang) !== 'th' || typeof message !== 'string') return message;
  if (TH_MESSAGES[message]) return TH_MESSAGES[message];
  for (const [re, build] of TH_PATTERNS) {
    const m = message.match(re);
    if (m) return build(m);
  }
  return message;
}

module.exports = {
  LANGS,
  DEFAULT_LANG,
  normalizeLang,
  langFromHeader,
  tr,
  forLang,
  statusLabel,
  priorityLabel,
  formatDueDate,
  translateMessage,
  describeChange,
};
