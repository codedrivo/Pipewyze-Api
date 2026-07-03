const Joi = require('joi');

const paginationParams = Joi.object({
  page: Joi.number().required().min(1),
  limit: Joi.number().required().min(1),
});

module.exports = {
  paginationParams,
};
