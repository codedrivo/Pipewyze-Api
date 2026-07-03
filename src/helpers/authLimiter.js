const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skipSuccessfulRequests: true,
});

const otpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1,
  message: 'Wait 1 minute before requesting another otp',
  statusCode: 400,
  skipSuccessfulRequests: true,
});

module.exports = {
  authLimiter,
  otpLimiter,
};
