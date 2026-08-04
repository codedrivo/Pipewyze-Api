const Joi = require('joi');

const createEssentialTool = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  tag: Joi.string().allow('').optional(),
  recommendationLink: Joi.string().allow('').optional(),
  image: Joi.string().allow('').optional(),
  purpose: Joi.string().allow('').optional(),
  bestUsedFor: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow('')).optional(),
  howToUse: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow('')).optional(),
  safetyTips: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow('')).optional(),
  recommendedVideo: Joi.string().allow('').optional(),
});

const updateEssentialTool = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  tag: Joi.string().allow('').optional(),
  recommendationLink: Joi.string().allow('').optional(),
  image: Joi.string().allow('').optional(),
  purpose: Joi.string().allow('').optional(),
  bestUsedFor: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow('')).optional(),
  howToUse: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow('')).optional(),
  safetyTips: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow('')).optional(),
  recommendedVideo: Joi.string().allow('').optional(),
});

const singleId = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createEssentialTool,
  updateEssentialTool,
  singleId,
};
