const catchAsync = require('../../helpers/asyncErrorHandler');
const ApiError = require('../../helpers/apiErrorConverter');
const token = require('../../services/auth/token.service');
const service = require('../../services/admin/auth.service');
const userService = require('../../services/auth/auth.service');
const otp = require('../../services/auth/otp.service');

// Admin login
const adminLogin = catchAsync(async (req, res, next) => {
  const user = await service.loginUser(req.body.email, req.body.password);
  if (user.role !== 'admin') {
    throw new ApiError('User must be admin');
  }
  const tokens = await token.generateAuthTokens(user);
  res
    .status(200)
    .send({ status: 200, message: 'Login successful', tokens, user });
});

// Forgot password
const forgotPassword = catchAsync(async (req, res, next) => {
  const user = await service.findUserByEmail(req.body.email);
  if (!user) {
    throw new ApiError('User Not Found', 404);
  }
  await otp.sendEmailOTP(
    req.body.email,
    'email',
    'd-c60beffa1f45430eb5ed565009adfef6',
    'Password Reset',
  );
  res
    .status(200)
    .send({ status: 200, message: 'OTP Sent to your email address' });
});

// Reset Password
const reset = catchAsync(async (req, res, next) => {
  const user = await service.findUserByEmail(req.body.email);
  if (!user) {
    throw new ApiError('User Not Found', 404);
  }
  await otp.checkVerifyOtp(user.email, req.body.otp, 'email');
  await service.changePassword(user.email, req.body.password);
  res.status(200).send({ status: 200, message: 'Password reset Successfully' });
});

// Refresh Token
const refreshTokensAdmin = catchAsync(async (req, res, next) => {
  let data;
  try {
    data = await token.verifyToken(req.body.token, 'refresh');
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
  const user = await service.getUserById(data.sub);
  if (!user) {
    throw new ApiError('User not found', 404);
  }
  const tokens = await token.generateAuthTokens(user);
  await token.blacklistToken(req.body.token, 'refresh');
  res.status(200).send({ message: 'Token refresh succesfull', tokens });
});

// Resend Otp
const forgotPasswordResend = catchAsync(async (req, res, next) => {
  const user = await service.findUserByEmail(req.body.email);
  if (!user) {
    throw new ApiError('User Not Found', 404);
  }

  if (user.role != 'admin') {
    throw new ApiError('This email id is not belongs to an Admin', 404);
  }

  await otp.generateOtp(user, 'resend');
  res.status(200).send({ message: 'Otp Sent to the email address' });
});

// Otp verify
const verify = catchAsync(async (req, res, next) => {
  const user = await service.findUserByEmail(req.body.email);
  if (!user) {
    throw new ApiError('User Not Found', 404);
  }
  await otp.verifyOtp(user.email, req.body.otp);
  res.status(200).send({ message: 'Otp verified successfully' });
});

// Register Admin
const createAdmin = catchAsync(async (req, res, next) => {
  const adminData = {
    ...req.body,
    role: 'admin',
  };
  const user = await userService.createUser(adminData);
  const tokens = await token.generateAuthTokens(user);
  res.status(201).send({
    status: 201,
    message: 'Admin created successfully',
    data: {
      tokens,
      user,
    },
  });
});

module.exports = {
  adminLogin,
  forgotPassword,
  reset,
  refreshTokensAdmin,
  forgotPasswordResend,
  verify,
  createAdmin,
};
