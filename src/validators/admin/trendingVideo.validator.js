const Joi = require('joi');

const createTrendingVideo = Joi.object({
  title: Joi.string().required(),
  videoUrl: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  thumbnail: Joi.string().allow('').optional(),
  targetAudience: Joi.string().valid('apprentice', 'licensed-plumber').optional(),
});

const updateTrendingVideo = Joi.object({
  title: Joi.string().optional(),
  videoUrl: Joi.string().optional(),
  description: Joi.string().allow('').optional(),
  thumbnail: Joi.string().allow('').optional(),
  targetAudience: Joi.string().valid('apprentice', 'licensed-plumber').optional(),
});

const singleId = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createTrendingVideo,
  updateTrendingVideo,
  singleId,
};
