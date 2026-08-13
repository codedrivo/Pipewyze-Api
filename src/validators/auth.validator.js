const Joi = require('joi');
const { email, phone } = require('./common.validator');
const password = (value, helpers) => {
  if (
    !value.match(
      /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
    )
  ) {
    return helpers.message(
      'Password must be 8 characters long with at least one capital letter, one small letter, one digit, one special character',
    );
  }
  return value;
};

const notifyAdmin = Joi.object({
  /* BASIC INFO */
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  dob: Joi.date().required(),
  gender: Joi.string().required(),
  maritalStatus: Joi.string().required(),
  /* CONTACT */
  email: email.required(),
  emailVerified: Joi.boolean().default(false),
  phone: phone.required(),
  phoneVerified: Joi.boolean().default(false),
  /* AUTH */
  password: Joi.string().required().custom(password),
  /* ADDRESS */
  address: Joi.string().required(),
  unit: Joi.string().allow('', null),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zipCode: Joi.string().required(),
  isTexas: Joi.boolean().required(),
});

const register = Joi.object({
  fullName: Joi.string().required(),
  email: email.required(),
  phone: phone.required(),
  password: Joi.string().required().custom(password),
  role: Joi.string()
    .valid('home-owner', 'apprentice', 'licensed-plumber')
    .default('home-owner'),
});

const login = Joi.object({
  email: email.required(),
  password: Joi.string().required(),
  role: Joi.string()
    .valid('home-owner', 'apprentice', 'licensed-plumber')
    .required(),
});

const adminLogin = Joi.object({
  email: email.required(),
  password: Joi.string().required(),
});

const forgot = Joi.object({
  email: email.required(),
});

const reset = Joi.object({
  email: email,
  phone: phone,
  otp: Joi.string().max(6).min(6).required(),
  newPassword: Joi.string().required().custom(password),
}).xor('email', 'phone');

const resetAdmin = Joi.object({
  email: email.required(),
  otp: Joi.string().max(6).min(6).required(),
  password: Joi.string().required().custom(password),
});

const verify = Joi.object({
  email,
  phone: phone,
  otp: Joi.string().length(6).required(),
})
  .xor('email', 'phone') // only one allowed
  .required();

const verifyCtg = Joi.object({
  email: email.required(),
  otp: Joi.string().max(6).min(6).required(),
});

const tokens = Joi.object({
  token: Joi.string().required(),
});

const logout = Joi.object({
  access: Joi.string().required(),
  refresh: Joi.string().required(),
});

// CTG RESET PASS
const ctgreset = Joi.object({
  email: email.required(),
  password: Joi.string().required().custom(password),
});

const phoneVerify = Joi.object({
  phone: Joi.string().required(),
});

module.exports = {
  login,
  adminLogin,
  forgot,
  reset,
  tokens,
  logout,
  verify,
  phoneVerify,
  notifyAdmin,
  resetAdmin,
  verifyCtg,
  ctgreset,
  register,
};
