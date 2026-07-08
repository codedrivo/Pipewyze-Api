const service = require('../../services/auth/auth.service');
const token = require('../../services/auth/token.service');
const otps = require('../../services/auth/otp.service');
const User = require('../../models/user.model');
const catchAsync = require('../../helpers/asyncErrorHandler');
const ApiError = require('../../helpers/apiErrorConverter');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const notifyAdmin = catchAsync(async (req, res) => {
  const bodyData = req.body;
  console.log(`[DEV NOTIFY ADMIN]:`, bodyData);
  res.status(201).send({
    message:
      'Your data has been sent to the admin. They will contact you soon.',
  });
});

// Register
const register = catchAsync(async (req, res, next) => {
  const user = await service.createUser(req.body);
  const tokens = await token.generateAuthTokens(user);
  res.status(201).send({
    message: 'Registration successful, please login',
    data: {
      tokens,
      user,
    },
  });
});

// Login
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  // Login service (password check etc)
  const user = await service.loginUser(email, password);

  const tokens = await token.generateAuthTokens(user);

  res.status(200).send({
    message: 'Login successful',
    data: {
      tokens,
      user,
    },
  });
});

// Forget password send otp
const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).send({
      message: 'No account found with this email address',
    });
  }
  await otps.sendEmailOTP(
    email,
    'email',
    'd-c60beffa1f45430eb5ed565009adfef6',
    'Password Reset',
  );
  res.status(200).send({
    message: 'OTP sent to your email address',
  });
});

// verify email send otp
const verifyEmailOTP = catchAsync(async (req, res) => {
  const user = await service.findUserByEmail(req.body.email);
  if (!user) {
    return res.status(404).send({
      message: 'No account found with this email address',
    });
  }
  await otps.sendEmailOTP(
    req.body.email,
    'email',
    'd-1c767f05cc6249708e590c9298915074',
  );
  res.status(200).send({ message: 'OTP Sent to your email address' });
});

// verify phone send otp
const verifyPhoneOTP = catchAsync(async (req, res) => {
  const user = await service.findUserByPhone(req.body.phone);
  if (!user) {
    return res.status(404).send({
      message: 'No account found with this Phone',
    });
  }
  await otps.sendPhoneOTP(req.body.phone, 'phone');
  res.status(200).send({ message: 'OTP Sent to your phone' });
});

// Otp verify
const verify = catchAsync(async (req, res, next) => {
  const { email, phone, otp } = req.body;
  let identifier;
  let type;
  if (email) {
    identifier = email;
    type = 'email';
  } else if (phone) {
    identifier = phone;
    type = 'phone';
  } else {
    throw new ApiError('Something is wrong', 400);
  }
  await otps.checkVerifyOtp(identifier, otp, type);

  if (type === 'email') {
    const user = await User.findOne({ email: identifier });

    if (!user) {
      throw new ApiError('User not found', 404);
    }

    await user.save();
  }
  res.status(200).send({
    message: 'OTP verified successfully',
  });
});

// Reset password
const reset = catchAsync(async (req, res, next) => {
  const { phone, email, otp, newPassword } = req.body;
  let identifier = email || phone;
  let type = email ? 'email' : 'phone';

  if (!identifier) {
    throw new ApiError('Email or phone is required', 400);
  }

  const user = email
    ? await service.findUserByEmail(email)
    : await service.findUserByPhone(phone);

  if (!user) {
    throw new ApiError('User Not Found', 404);
  }

  const isVerify = await otps.isVerifyOtp(identifier, otp, type);
  if (!isVerify) {
    throw new ApiError(
      'Please go to the Forgot Password page and request a new code.',
      404,
    );
  }
  await service.changePassword(user.email, newPassword);
  res.status(200).send({ message: 'Password reset successfully' });
});

// Refresh token
const refreshTokens = catchAsync(async (req, res, next) => {
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
  res.status(200).send({
    message: 'Token refresh succesfull',
    tokens: {
      access: tokens.access,
      refresh: tokens.refresh,
    },
  });
});

// Logout
const logout = catchAsync(async (req, res, next) => {
  await token.blacklistToken(req.body.access, 'access');
  await token.blacklistToken(req.body.refresh, 'refresh');
  res.status(200).send({ message: 'Logout successfull' });
});

// Resend Otp
const forgotPasswordResend = catchAsync(async (req, res, next) => {
  const user = await service.findUserByEmail(req.body.email);
  if (!user) {
    throw new ApiError('User Not Found', 404);
  }
  await otps.sendEmailOTP(
    user.email,
    'email',
    'd-c60beffa1f45430eb5ed565009adfef6',
  );
  res.status(200).send({ message: 'OTP Sent to the email address' });
});

module.exports = {
  login,
  forgotPassword,
  verify,
  reset,
  refreshTokens,
  logout,
  forgotPasswordResend,
  verifyEmailOTP,
  verifyPhoneOTP,
  notifyAdmin,
  register,
};
