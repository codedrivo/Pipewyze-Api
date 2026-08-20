const Joi = require('joi');

const createTrainingVideo = Joi.object({
  title: Joi.string().required(),
  videoUrl: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  thumbnail: Joi.string().allow('').optional(),
  targetAudience: Joi.string()
    .valid('apprentice', 'licensed-plumber', 'home-owner')
    .optional(),
  isAiVideo: Joi.boolean().optional(),
});

const updateTrainingVideo = Joi.object({
  title: Joi.string().optional(),
  videoUrl: Joi.string().optional(),
  description: Joi.string().allow('').optional(),
  thumbnail: Joi.string().allow('').optional(),
  targetAudience: Joi.string()
    .valid('apprentice', 'licensed-plumber', 'home-owner')
    .optional(),
  isAiVideo: Joi.boolean().optional(),
});

const singleId = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createTrainingVideo,
  updateTrainingVideo,
  singleId,
};
