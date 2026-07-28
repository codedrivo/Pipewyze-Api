const Joi = require('joi');

const createPlumbingCode = Joi.object({
  code: Joi.string().required(),
  title: Joi.string().required(),
  category: Joi.string().valid('MUPC', 'IPC').required(),
  description: Joi.string().required(),
  exception: Joi.string().allow('', null).optional(),
  plainLanguageInterpretation: Joi.string().required(),
});

const updatePlumbingCode = Joi.object({
  code: Joi.string().optional(),
  title: Joi.string().optional(),
  category: Joi.string().valid('MUPC', 'IPC').optional(),
  description: Joi.string().optional(),
  exception: Joi.string().allow('', null).optional(),
  plainLanguageInterpretation: Joi.string().optional(),
});

const singleId = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createPlumbingCode,
  updatePlumbingCode,
  singleId,
};
