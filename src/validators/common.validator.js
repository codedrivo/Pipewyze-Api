const Joi = require('joi');

const email = Joi.string()
  .trim()
  .lowercase()
  .email({ minDomainSegments: 2, tlds: { allow: true } })
  .pattern(/^[^\s@]+@[^\s@]+\.[a-zA-Z]{3,4}$/)
  .messages({
    'string.email':
      'Please enter a valid email address, for example name@gmail.com',
    'string.pattern.base':
      'Please enter a valid email address with a domain and 3-4 letter extension (e.g. .com)',
  });

const phone = Joi.string()
  .trim()
  .pattern(/^[0-9]{10}$/)
  .messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits.',
    'any.required': 'Phone number is required.',
  });

module.exports = {
  email,
  phone,
};
