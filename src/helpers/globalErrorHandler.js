const config = require('../config/config');
const ApiError = require('../helpers/apiErrorConverter');

const handleDevErrors = (res, error) => {
  const response = {
    status: error.status,
    message: error.responseMessage,
    stackTrace: error.stackTrace,
  };

  if (error.tokenExpired) {
    response.tokenExpired = error.tokenExpired;
  }
  return res.status(error.statusCode).send(response);
};

const handleProdErrors = (res, error) => {
  if (error.isOperational) {
    const response = {
      status: error.status,
      message: error.responseMessage,
    };

    if (error.tokenExpired) {
      response.tokenExpired = error.tokenExpired;
    }
    return res.status(error.statusCode).send(response);
  } else {
    return res
      .status(500)
      .send({ status: 'error', message: 'Something went wrong' });
  }
};

const CaseErrorHandler = (err) => {
  return new ApiError(`Invalid Value ${err.value} For Field ${err.path}`, 400);
};

const DuplicateKeyError = (err) => {
  const keys = Object.keys(err.keyValue);
  if (keys.length > 0) {
    const firstKey = keys[0];
    const firstKeysValue = err.keyValue[firstKey];
    return new ApiError(`${firstKeysValue} already exists`, 400);
  }
};

const ValidationErrorHandler = (err) => {
  const errors = Object.values(err.errors).map((val) => val.message);
  const errorMsg = errors.join('. ');
  const msg = `Invalid input data ${errorMsg}`;
  return new ApiError(msg, 400);
};

const HandleJoiError = (err) => {
  const errMsgs = err.error.details.map((item) =>
    item.message.replace(/['"]/g, ''),
  );
  return new ApiError(errMsgs[0], 400);
};

const JsonWebTokenErrorHandler = (error) => {
  return new ApiError(error.message, 401);
};

const globalErrorHandler = (error, req, res, next) => {
  console.log(error);
  if (error instanceof ApiError) {
    error.statusCode = error.statusCode || 500;
    error.status = error.status || 'error';
  } else {
    error.statusCode = error.statusCode || 500;
    error.status = error.status || 'error';
    error.responseMessage = error.responseMessage || 'Something went wrong';
    if (error.name === 'TokenExpiredError') {
      error.statusCode = 401;
      error.status = 'error';
      error.responseMessage = 'Token Expired';
      error.tokenExpired = true;
    }
  }
  if (error.name === 'CastError') error = CaseErrorHandler(error);
  if (error.code === 11000) error = DuplicateKeyError(error);
  if (error.name === 'ValidationError') error = ValidationErrorHandler(error);
  if (error.type && error.type === 'body') error = HandleJoiError(error);
  if (error.name === 'JsonWebTokenError')
    error = JsonWebTokenErrorHandler(error);
  /*if (error.name === 'TokenExpiredError')
    error = JsonWebTokenErrorHandler(error);*/

  if (config.env === 'dev') {
    res.locals.errorMessage = error.message;
    handleDevErrors(res, error);
  }

  if (config.env === 'prod') {
    res.locals.errorMessage = error.message;
    handleProdErrors(res, error);
  }
};

module.exports = globalErrorHandler;
