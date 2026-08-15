const Joi = require('joi');

const createFaq = Joi.object({
  question: Joi.string().required(),
  answer: Joi.string().required(),
});

const updateFaq = Joi.object({
  question: Joi.string().optional(),
  answer: Joi.string().optional(),
});

const singleId = Joi.object({
  id: Joi.string().required(),
});

const pagination = Joi.object({
  limit: Joi.string().optional(),
  page: Joi.string().required(),
});

module.exports = {
  createFaq,
  updateFaq,
  singleId,
  pagination,
};
