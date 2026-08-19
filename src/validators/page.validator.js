const Joi = require('joi');
const { email } = require('./common.validator');

const contactForm = Joi.object({
  firstName: Joi.string()
    .trim()
    .regex(/^[A-Za-z]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'First name can only contain letters',
    }),
  lastName: Joi.string()
    .trim()
    .regex(/^[A-Za-z]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Last name can only contain letters',
    }),
  fullName: Joi.string()
    .trim()
    .regex(/^[A-Za-z\s]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Full name can only contain letters and spaces',
    }),
  email: email.required().messages({
    'any.required': 'Email is required',
    'string.empty': 'Email is required',
    'string.email': 'Please enter a valid email address',
  }),
  phone: Joi.string()
    .trim()
    .regex(/^\d{10}$/)
    .required()
    .messages({
      'any.required': 'Phone number is required',
      'string.empty': 'Phone number is required',
      'string.pattern.base': 'Phone number must be exactly 10 digits',
    }),
  message: Joi.string().trim().required().messages({
    'any.required': 'Message is required',
    'string.empty': 'Message is required',
  }),
}).or('firstName', 'fullName');

const singleId = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  contactForm,
  singleId,
};
