const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const multer = require('multer');

const AppError = require('../utils/AppError');

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Only formats an officer can actually review. */
const ALLOWED = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

const ALLOWED_MIME_TYPES = Object.keys(ALLOWED);
const ALLOWED_EXTENSIONS = Object.values(ALLOWED).flat();

function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || './uploads');
}

function maxUploadBytes() {
  return Number(process.env.MAX_UPLOAD_SIZE_BYTES) || DEFAULT_MAX_BYTES;
}

/**
 * Filenames are generated, never taken from the client.
 *
 * A caller-supplied name could contain path separators, traversal sequences or
 * a second extension, so the original is kept only as metadata for display.
 */
function storedFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = uploadDir();
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, storedFilename(file.originalname));
  },
});

/**
 * Rejects a file before it is written.
 *
 * Both the declared MIME type and the extension must be allowed, and they must
 * agree -- a client can claim any Content-Type, so neither is trusted alone.
 */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    return cb(
      new AppError(422, 'Unsupported file type', [
        { field: 'file', message: 'Upload a PDF, JPEG or PNG file' },
      ])
    );
  }

  if (!ALLOWED[mime].includes(ext)) {
    return cb(
      new AppError(422, 'File extension does not match its content type', [
        { field: 'file', message: `A ${mime} file cannot have a ${ext || 'missing'} extension` },
      ])
    );
  }

  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxUploadBytes(),
    files: 1,
  },
});

/** Turns multer's own errors into the API's error shape. */
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.round(maxUploadBytes() / (1024 * 1024));
      return next(
        new AppError(413, `File is too large. The maximum is ${mb} MB.`, [
          { field: 'file', message: `Maximum ${mb} MB` },
        ])
      );
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(
        new AppError(422, 'Upload exactly one file in the "file" field')
      );
    }
    return next(new AppError(422, 'Upload failed'));
  }
  return next(err);
}

module.exports = {
  upload,
  handleUploadErrors,
  uploadDir,
  maxUploadBytes,
  storedFilename,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
};
