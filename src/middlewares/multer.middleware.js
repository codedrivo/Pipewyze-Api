const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Local disk storage configuration
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB limit
  },
});

// Helper to patch req.file.location or req.files[fieldName][i].location for diskStorage
// so it is compatible with controllers expecting image URLs.
const patchFileLocation = (req) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  
  if (req.file && !req.file.location) {
    req.file.location = `${protocol}://${host}/uploads/${req.file.filename}`;
  }
  if (req.files) {
    Object.keys(req.files).forEach((key) => {
      req.files[key].forEach((file) => {
        if (!file.location) {
          file.location = `${protocol}://${host}/uploads/${file.filename}`;
        }
      });
    });
  }
};

const customSingle = (fieldName) => {
  const middleware = upload.single(fieldName);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return next(err);
      patchFileLocation(req);
      next();
    });
  };
};

const customFields = (fieldsArray) => {
  const middleware = upload.fields(fieldsArray);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return next(err);
      patchFileLocation(req);
      next();
    });
  };
};

module.exports = {
  single: customSingle,
  fields: customFields,
};
