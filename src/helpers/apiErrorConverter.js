class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;
    this.responseMessage = message;
    Error.captureStackTrace(this, this.constructor);
    this.stackTrace = this.stack;
  }
}

module.exports = ApiError;
