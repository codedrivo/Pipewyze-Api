const Joi = require('joi');

const page = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
});
const singleId = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  page,
  singleId,
};
