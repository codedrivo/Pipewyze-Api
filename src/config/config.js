const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const ApiError = require('../helpers/apiErrorConverter');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('prod', 'dev').required(),
    PORT: Joi.number().default(3000),
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number()
      .default(30)
      .description('minutes after which access tokens expire'),
    JWT_RESET_EXPIRATION_MINUTES: Joi.number()
      .default(30)
      .description('minutes after which password reset tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number()
      .default(30)
      .description('days after which refresh tokens expire'),
    JWT_ISS: Joi.string().description('Token issuer').required(),
    JWT_ALGO: Joi.string()
      .description('Token Algorithm for encryption')
      .required(),
    APPEMAIL: Joi.string().email().optional(),
    APPPASSWORD: Joi.string().optional(),
    EMAIL_FROM: Joi.string().email().optional(),
    EMAIL_USER: Joi.string().email().optional(),
    EMAIL_PASS: Joi.string().optional(),
    SMTP_HOST: Joi.string().optional(),
    SMTP_PORT: Joi.number().optional(),
    SMTP_SECURE: Joi.boolean().optional(),
    AWS_ACCESS_KEY_ID: Joi.string().optional(),
    AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
    AWS_REGION: Joi.string().optional(),
    S3_BUCKET_PATH: Joi.string().optional(),
    AWS_CLOUDFRONT_URL: Joi.string().optional(),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new ApiError(`Config validation error: ${error.message}`, 500);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  socketPort: envVars.SOCKETPORT,
  mongoose: {
    url: envVars.MONGODB_URL,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_EXPIRATION_MINUTES,
    issuer: envVars.JWT_ISS,
    algo: envVars.JWT_ALGO,
  },
  email: {
    from: envVars.EMAIL_FROM || envVars.EMAIL_USER || envVars.APPEMAIL,
    smtp: {
      host: envVars.SMTP_HOST || 'smtp.gmail.com',
      port: envVars.SMTP_PORT || 587,
      secure: envVars.SMTP_SECURE === 'true' || envVars.SMTP_SECURE === true || false,
      user: envVars.EMAIL_USER || envVars.APPEMAIL,
      pass: envVars.EMAIL_PASS || envVars.APPPASSWORD,
    },
  },
  s3: {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    region: envVars.AWS_REGION,
    S3_BUCKET_PATH: envVars.S3_BUCKET_PATH,
    cloudfrontUrl: envVars.AWS_CLOUDFRONT_URL,
  },
};
