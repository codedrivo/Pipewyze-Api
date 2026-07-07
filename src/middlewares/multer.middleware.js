const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const config = require('../config/config');

const s3 = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

const s3Storage = multerS3({
  s3: s3,
  bucket: config.s3.S3_BUCKET_PATH,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const extension = file.originalname.split('.').pop(); // Get the extension from the original file name
    const uniqueKey = 'PipeWyze/' + Date.now().toString() + '.' + extension; // Use a unique key with the extension
    cb(null, uniqueKey);
  },
});

// Custom storage engine wrapper to replace S3 URL with CloudFront URL from config
const customStorage = {
  _handleFile: function (req, file, cb) {
    s3Storage._handleFile(req, file, function (err, info) {
      if (err) return cb(err);

      // Override the location with CloudFront URL if configured
      if (info && info.key && config.s3.cloudfrontUrl) {
        const baseUrl = config.s3.cloudfrontUrl.replace(/\/$/, '');
        info.location = `${baseUrl}/${info.key}`;
      }

      cb(null, info);
    });
  },
  _removeFile: function (req, file, cb) {
    s3Storage._removeFile(req, file, cb);
  },
};

const upload = multer({
  storage: s3Storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit to accommodate high-res mobile photos
  },
});

const customSingle = (fieldName) => {
  const middleware = upload.single(fieldName);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  };
};

const customFields = (fieldsArray) => {
  const middleware = upload.fields(fieldsArray);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  };
};

module.exports = {
  single: customSingle,
  fields: customFields,
};
