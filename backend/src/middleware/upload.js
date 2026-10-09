const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// make sure the uploads folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  },
});

// Any file type is accepted (ZIP archives, videos, documents, images, ...);
// the size is the only limit. Default 200 MB so a typical video or archive
// fits; override with UPLOAD_MAX_MB in the backend .env. If a reverse proxy
// (nginx etc.) sits in front, its client_max_body_size must be at least this.
const MAX_FILE_SIZE_MB = Number(process.env.UPLOAD_MAX_MB) || 200;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

module.exports = { upload, UPLOAD_DIR, MAX_FILE_SIZE_MB };
