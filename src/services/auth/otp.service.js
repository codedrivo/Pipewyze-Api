const ApiError = require('../../helpers/apiErrorConverter');
const Otp = require('../../models/otp.model');
const User = require('../../models/user.model');
const crypto = require('crypto');
const config = require('../../config/config');
const emailService = require('../email/email.service');

function generateSecureOTP() {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, digits.length);
    otp += digits[randomIndex];
  }
  return otp;
}

const createOtp = async ({ identifier, type }) => {
  // generate OTP
  const otp = generateSecureOTP();

  // remove old OTPs for same identifier & type
  await Otp.deleteMany({
    identifier,
    type,
  });

  // save OTP
  await Otp.create({
    otp,
    identifier,
    type,
    is_verified: false,
  });

  return otp;
};
const sendPhoneOTP = async (phone) => {
  try {
    const otp = await createOtp({
      identifier: phone,
      type: 'phone',
    });
    console.log(`[DEV OTP SMS] To ${phone}: Your verification code is ${otp}. It will expire in 5 minutes.`);
    return true;
  } catch (error) {
    throw new ApiError(error.message || 'Failed to send OTP', 500);
  }
};

const sendEmailOTP = async (userEmail, type, tempID) => {
  try {
    const otp = await createOtp({
      identifier: userEmail,
      type: type,
    });
    console.log(`[DEV OTP EMAIL] To ${userEmail}: Email Verification OTP is ${otp}`);
    await emailService.sendEmail(
      userEmail,
      'Email Verification',
      `Your verification code is ${otp}. It will expire in 5 minutes.`,
      `<p>Your verification code is: <b>${otp}</b>. It will expire in 5 minutes.</p>`
    );
    return true;
  } catch (e) {
    throw new ApiError(e.message, 500);
  }
};

// Send support email
const sendSupportEmail = async (userEmail, tempID, data) => {
  try {
    console.log(`[DEV SUPPORT EMAIL] To ${userEmail}: Support Request:`, data);
    await emailService.sendEmail(
      userEmail,
      'Lead Support Request',
      `Support request details:\nName: ${data.fullname}\nEmail: ${data.email}\nPhone: ${data.phone || 'N/A'}\nMessage: ${data.message}`
    );
    return true;
  } catch (e) {
    throw new ApiError(e.message, 500);
  }
};

const checkVerifyOtp = async (identifier, otp, type) => {
  const normalizedIdentifier = identifier.toLowerCase();
  const record = await Otp.findOne({
    identifier: normalizedIdentifier,
    otp,
    type,
    is_verified: false,
  });
  if (!record) throw new ApiError('Invalid or expired OTP', 400);
  record.is_verified = true;
  await record.save();
  return true;
};

const isVerifyOtp = async (identifier, otp, type) => {
  const normalizedIdentifier = identifier.toLowerCase();
  const record = await Otp.findOne({
    identifier: normalizedIdentifier,
    otp,
    type,
    is_verified: true,
  });
  if (!record)
    throw new ApiError(
      'Please go to the Forgot Password page and request a new code.',
      400,
    );
  await Otp.deleteOne({ _id: record._id });
  return true;
};

const generateOtp = async (user, type) => {
  await Otp.deleteMany({ identifier: user.email, type: 'email' });

  const otp = await Otp.create({
    otp: generateSecureOTP(),
    identifier: user.email,
    type: 'email',
    is_verified: false,
  });
  if (!otp) {
    throw new ApiError('Error In OTP generations', 500);
  }
  console.log(`[DEV OTP EMAIL] To ${user.email}: Type: ${type}, OTP: ${otp.otp}`);
  
  const isEmailVerify = type === 'emailVerify' || type === 'resend';
  const subject = isEmailVerify ? 'Email Verification' : 'Password Reset OTP';
  await emailService.sendEmail(
    user.email,
    subject,
    `Your OTP code is ${otp.otp}`,
    `<p>Your OTP code is: <b>${otp.otp}</b></p>`
  );
};

const getOtpIfVerified = async (email, otp) => {
  const otpindb = await Otp.findOne({ email, otp });
  if (!otpindb) {
    throw new ApiError('Unverified Or Invalid OTP', 400);
  }
  return Otp.deleteOne({ _id: otpindb._id });
};

const resendOtp = async (user) => {
  let otp = await Otp.findOne({ email: user.email });

  if (!otp) {
    otp = await Otp.create({ otp: generateSecureOTP(), email: user.email });
  }

  if (!otp) {
    throw new ApiError('Error In OTP generations', 500);
  }

  console.log(`[DEV OTP EMAIL] To ${user.email}: Resend OTP: ${otp.otp}`);
  await emailService.sendEmail(
    user.email,
    'Password Reset OTP',
    `Your password reset OTP code is ${otp.otp}`,
    `<p>Your password reset OTP code is: <b>${otp.otp}</b></p>`
  );
};

const verifyOtp = async (email, otp) => {
  const otpindb = await Otp.findOne({ identifier: email, otp });

  if (!otpindb) {
    throw new ApiError('Invalid OTP', 400);
  }

  const createdAt = otpindb.createdAt;

  const currentTime = new Date();

  const timeDifferenceInMilliseconds = currentTime - createdAt;
  const timeDifferenceInMinutes = timeDifferenceInMilliseconds / (1000 * 60);

  if (
    timeDifferenceInMinutes > Number(config.jwt.resetPasswordExpirationMinutes)
  ) {
    throw new ApiError('OTP expired', 400);
  }

  otpindb.is_verified = true;
  await otpindb.save();
  return;
};

module.exports = {
  generateOtp,
  getOtpIfVerified,
  resendOtp,
  verifyOtp,
  sendEmailOTP,
  checkVerifyOtp,
  sendPhoneOTP,
  isVerifyOtp,
  sendSupportEmail,
};
