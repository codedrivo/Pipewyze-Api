const Joi = require('joi');
const { email } = require('./common.validator');

const contactForm = Joi.object({
  firstName: Joi.string()
    .trim()
    .regex(/^[A-Za-z]+$/)
    .required()
    .messages({
      'any.required': 'First name is required',
      'string.empty': 'First name is required',
      'string.pattern.base': 'Only alphabets are allowed in first name',
    }),
  lastName: Joi.string()
    .trim()
    .regex(/^[A-Za-z]+$/)
    .required()
    .messages({
      'any.required': 'Last name is required',
      'string.empty': 'Last name is required',
      'string.pattern.base': 'Only alphabets are allowed in last name',
    }),
  email: email.required().messages({
    'any.required': 'Email is required',
    'string.empty': 'Email is required',
  }),
  phone: Joi.string().trim().required().messages({
    'any.required': 'Phone number is required',
    'string.empty': 'Phone number is required',
  }),
  message: Joi.string().trim().required().messages({
    'any.required': 'Message is required',
    'string.empty': 'Message is required',
  }),
});

const singleId = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  contactForm,
  singleId,
};
