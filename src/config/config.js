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
    from: envVars.EMAIL_FROM || envVars.APPEMAIL,
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: envVars.APPEMAIL,
      pass: envVars.APPPASSWORD,
    },
  },
};
