const multer = require('multer');

const memStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG/PNG images are allowed'), false);
  }
};

const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB

// Memory storage for face comparison
const uploadMemory = multer({ storage: memStorage, fileFilter, limits: { fileSize: maxSize } });

module.exports = { uploadMemory };
