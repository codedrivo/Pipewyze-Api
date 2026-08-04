const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const checklistItem = Joi.object({
  task: Joi.string().required(),
  frequency: Joi.string().required(),
});

const createMaintenanceGuide = Joi.object({
  title: Joi.string().required(),
  brandModel: Joi.string().allow('').optional(),
  expectedLife: Joi.string().allow('').optional(),
  difficulty: Joi.string().allow('').optional(),
  overview: Joi.string().allow('').optional(),
  checklist: Joi.alternatives().try(Joi.array().items(checklistItem), Joi.string()).optional(),
  requiredTools: Joi.alternatives().try(Joi.array().items(Joi.string().pattern(objectIdPattern)), Joi.string()).optional(),
  relatedCodes: Joi.alternatives().try(Joi.array().items(Joi.string().pattern(objectIdPattern)), Joi.string()).optional(),
  recommendedVideo: Joi.string().allow('').optional(),
  image: Joi.string().allow('').optional(),
});

const updateMaintenanceGuide = Joi.object({
  title: Joi.string().optional(),
  brandModel: Joi.string().allow('').optional(),
  expectedLife: Joi.string().allow('').optional(),
  difficulty: Joi.string().allow('').optional(),
  overview: Joi.string().allow('').optional(),
  checklist: Joi.alternatives().try(Joi.array().items(checklistItem), Joi.string()).optional(),
  requiredTools: Joi.alternatives().try(Joi.array().items(Joi.string().pattern(objectIdPattern)), Joi.string()).optional(),
  relatedCodes: Joi.alternatives().try(Joi.array().items(Joi.string().pattern(objectIdPattern)), Joi.string()).optional(),
  recommendedVideo: Joi.string().allow('').optional(),
  image: Joi.string().allow('').optional(),
});

const singleId = Joi.object({
  id: Joi.string().pattern(objectIdPattern).required(),
});

module.exports = {
  createMaintenanceGuide,
  updateMaintenanceGuide,
  singleId,
};
