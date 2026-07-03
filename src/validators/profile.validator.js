const Joi = require('joi');

const password = (value, helpers) => {
  if (
    !value.match(
      /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
    )
  ) {
    return helpers.message(
      'Password must me 8 characters long with at least one capital letter, one small letter, one digit, one special character',
    );
  }
  return value;
};

const passchange = Joi.object({
  password_old: Joi.string().required(),
  password_new: Joi.string().required().custom(password),
});

const notificationToggle = Joi.object({
  notification: Joi.boolean().required(),
});

const immegrationRequest = Joi.object({
  immegration_purpose: Joi.array().required(),
  temporary_address: Joi.string().required(),
  permanent_address: Joi.string().required(),
  express_entry: Joi.string().required(),
  nominee_program: Joi.string().required(),
  family_sponsorship: Joi.string().required(),
});

const support = Joi.object({
  subject: Joi.string().required().messages({
    'any.required': 'Subject is required.',
  }),
  message: Joi.string().required().messages({
    'any.required': 'Message is required.',
  }),
});

const singleId = Joi.object({
  id: Joi.string().required(),
});

const updateProfile = Joi.object({
  firstName: Joi.string(),
  lastName: Joi.string(),
  phone: Joi.string(),
});

module.exports = {
  passchange,
  notificationToggle,
  immegrationRequest,
  support,
  singleId,
  updateProfile,
};
