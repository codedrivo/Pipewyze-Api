const jwt = require('jsonwebtoken');
const config = require('../../config/config');
const moment = require('moment');
const Token = require('../../models/token.model');
const ApiError = require('../../helpers/apiErrorConverter');

const makeToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, { algorithm: config.jwt.algo });
};

const generateAuthTokens = async (user) => {
  const accessToken = makeToken({
    sub: user._id,
    iat: moment().unix(),
    exp: moment().add(config.jwt.accessExpirationMinutes, 'minutes').unix(),
    aud: 'access',
    iss: config.jwt.issuer,
  });

  const refreshToken = makeToken({
    sub: user._id,
    iat: moment().unix(),
    exp: moment().add(config.jwt.refreshExpirationDays, 'days').unix(),
    aud: 'refresh',
    iss: config.jwt.issuer,
  });
  await Token.create({
    token: accessToken,
    type: 'access',
  });
  await Token.create({
    token: refreshToken,
    type: 'refresh',
  });

  return { access: accessToken, refresh: refreshToken };
};

const verifyToken = async (token, type) => {
  const tokenInDb = await Token.findOne({ token, type });
  if (!tokenInDb) {
    throw new ApiError('Your session has expired. Please log in again.', 401);
  }
  return jwt.verify(token, config.jwt.secret, {
    algorithm: config.jwt.algo,
    issuer: config.jwt.issuer,
    audience: type,
  });
};

const blacklistToken = async (token, type) => {
  return Token.deleteOne({ token, type });
};

module.exports = {
  generateAuthTokens,
  verifyToken,
  blacklistToken,
};
