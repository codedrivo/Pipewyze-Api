const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');
const morgan = require('./config/morgan');
const appRouter = require('./routes/index');
const config = require('./config/config');
const { authLimiter, otpLimiter } = require('./helpers/authLimiter');
const globalErrorHandler = require('./helpers/globalErrorHandler');
const ApiError = require('./helpers/apiErrorConverter');
const swaggerUi = require('swagger-ui-express');
const specs = require('../swagger'); // Path to your swagger.js file
const path = require('path');
// initialize express app
const app = express();
// log requests to console
app.use(morgan.successHandler);
app.use(morgan.errorHandler);

// only content type application/json allowed
// app.use(
//   express.json({
//     verify: (req, res, buf) => {
//       // Only capture raw body for stripe webhooks
//       if (req.originalUrl.includes('/webhook')) {
//         req.rawBody = buf;
//       }
//     },
//   }),
// );

app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.includes('/stripe/webhook')) {
        req.rawBody = buf;
      }
    },
  }),
);

// set security headers automatically
app.use(helmet());

// gzip compress response
app.use(compression());

// clean income request for any unwanted codes
app.use(xss());
app.use(mongoSanitize());

// enable cors
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5000',
      'http://localhost:4000',
      'http://localhost:6000',
      '*',
      'http://localhost:5174',
      'http://localhost:5000',
      'https://admin.pipewyze.com',
      'https://pipewyze.com',
    ],
  }),
);

// auth limiter in production mode
if (config.env === 'prod') {
  app.set('trust proxy', 2); // to prevent X-Forwarded-For header validation error
  app.use('/v1/auth/', authLimiter);
  app.use('/v1/auth/forgot-password', otpLimiter);
  app.use('/v1/auth/resend-otp', otpLimiter);
}

// api docs
if (config.env === 'dev') {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));
}

app.use('/', appRouter);
app.use('/v1', appRouter);

// 404 error
app.all('*', (req, res, next) => {
  next(new ApiError(`Can't find ${req.originalUrl} on the server!`, 404));
});

// handle all errors
app.use(globalErrorHandler);

module.exports = app;
