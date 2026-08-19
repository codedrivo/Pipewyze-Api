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

const createLicensedPlumber = Joi.object({
  fullName: Joi.string().required(),
  email: email.required(),
  phone: phone.optional().allow('', null),
  password: Joi.string().required().custom(password),
  yearsOfService: Joi.string().optional().allow(''),
  serviceLocations: Joi.array().items(Joi.string()).optional(),
  servicesOffered: Joi.array().items(Joi.string()).optional(),
  latitude: Joi.number().optional().allow(null, ''),
  longitude: Joi.number().optional().allow(null, ''),
  address: Joi.string().optional().allow('', null),
});

const updateLicensedPlumber = Joi.object({
  fullName: Joi.string().optional(),
  email: email.optional(),
  phone: phone.optional().allow('', null),
  yearsOfService: Joi.string().optional().allow(''),
  serviceLocations: Joi.array().items(Joi.string()).optional(),
  servicesOffered: Joi.array().items(Joi.string()).optional(),
  latitude: Joi.number().optional().allow(null, ''),
  longitude: Joi.number().optional().allow(null, ''),
  address: Joi.string().optional().allow('', null),
});

module.exports = {
  createLicensedPlumber,
  updateLicensedPlumber,
};
