const ApiError = require('../helpers/apiErrorConverter');
const tokenService = require('../services/auth/token.service');
const authService = require('../services/auth/auth.service');
const catchAsync = require('../helpers/asyncErrorHandler');

module.exports = function () {
  return catchAsync(async function (req, res, next) {
    const token = req.headers.authorization;
    if (token) {
      const access = token.split(' ')[1];
      const data = await tokenService.verifyToken(access, 'access');
      const user = await authService.getUserDataById(data.sub);
      req.user = user;
    }
    next();
  });
};
