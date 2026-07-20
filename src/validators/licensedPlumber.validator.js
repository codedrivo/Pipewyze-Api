const Joi = require('joi');
const { email } = require('./common.validator');

const phone = (value, helpers) => {
  if (value && !/^[0-9]{10}$/.test(value)) {
    return helpers.message('Phone number must be exactly 10 digits');
  }
  return value;
};

const password = (value, helpers) => {
  if (!/^(?=.*[a-zA-Z])(?=.*[0-9]).{8,}$/.test(value)) {
    return helpers.message(
      'Password must be at least 8 characters and contain both letters and numbers',
    );
  }
  return value;
};

const createLicensedPlumber = Joi.object({
  fullName: Joi.string().required(),
  email: email.required(),
  phone: Joi.string().optional().custom(phone).allow('', null),
  password: Joi.string().required().custom(password),
  yearsOfService: Joi.string().optional().allow(''),
  serviceLocations: Joi.array().items(Joi.string()).optional(),
  servicesOffered: Joi.array().items(Joi.string()).optional(),
});

const updateLicensedPlumber = Joi.object({
  fullName: Joi.string().optional(),
  email: email.optional(),
  phone: Joi.string().optional().custom(phone).allow('', null),
  yearsOfService: Joi.string().optional().allow(''),
  serviceLocations: Joi.array().items(Joi.string()).optional(),
  servicesOffered: Joi.array().items(Joi.string()).optional(),
});

module.exports = {
  createLicensedPlumber,
  updateLicensedPlumber,
};
