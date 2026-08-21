const Joi = require('joi');

const createQuestion = Joi.object({
  question: Joi.string().required(),
});

const updateQuestion = Joi.object({
  question: Joi.string().required(),
});

const createVideo = Joi.object({
  question: Joi.string().required(),
  title: Joi.string().required(),
  videoUrl: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  thumbnail: Joi.string().allow('').optional(),
  targetAudience: Joi.string()
    .valid('apprentice', 'licensed-plumber', 'home-owner')
    .optional(),
});

const updateVideo = Joi.object({
  question: Joi.string().optional(),
  title: Joi.string().optional(),
  videoUrl: Joi.string().optional(),
  description: Joi.string().allow('').optional(),
  thumbnail: Joi.string().allow('').optional(),
  targetAudience: Joi.string()
    .valid('apprentice', 'licensed-plumber', 'home-owner')
    .optional(),
});

const singleId = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createQuestion,
  updateQuestion,
  createVideo,
  updateVideo,
  singleId,
};
