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

const subscribe = Joi.object({
  planId: Joi.string().required().messages({
    'any.required': 'planId is required',
  }),
  billingCycle: Joi.string().valid('monthly', 'yearly').default('monthly'),
  paymentMethodId: Joi.string().optional(),
});

module.exports = {
  attachCard,
  setDefaultCard,
  paymentMethodParams,
  subscribe,
};
