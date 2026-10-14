const Joi = require('joi');

const attachCard = Joi.object({
  paymentMethodId: Joi.string().required().messages({
    'any.required': 'paymentMethodId is required',
  }),
  setAsDefault: Joi.boolean().optional().default(true),
});

const setDefaultCard = Joi.object({
  paymentMethodId: Joi.string().required().messages({
    'any.required': 'paymentMethodId is required',
  }),
});

const paymentMethodParams = Joi.object({
  paymentMethodId: Joi.string().required().messages({
    'any.required': 'paymentMethodId is required',
  }),
});

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const subscribe = Joi.object({
  planId: Joi.string().pattern(objectIdPattern).required().messages({
    'string.pattern.base':
      'Invalid planId format. Must be a valid 24-character hex ID.',
    'any.required': 'planId is required',
  }),
  billingCycle: Joi.string().valid('monthly', 'yearly').default('monthly'),
  paymentMethodId: Joi.string().trim().optional(),
});

module.exports = {
  attachCard,
  setDefaultCard,
  paymentMethodParams,
  subscribe,
};
