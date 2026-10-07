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

module.exports = {
  attachCard,
  setDefaultCard,
  paymentMethodParams,
};
