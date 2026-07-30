const Joi = require('joi');

const addEquipment = Joi.object({
  plumberId: Joi.string().required(),
  category: Joi.string().required(),
  brand: Joi.string().required(),
  model: Joi.string().required(),
  serialNumber: Joi.string().required(),
  installationDate: Joi.date().iso().required(),
  nextServiceDate: Joi.date().iso().required(),
  image: Joi.string().allow('').optional(),
});

const updateEquipment = Joi.object({
  category: Joi.string().optional(),
  brand: Joi.string().optional(),
  model: Joi.string().optional(),
  serialNumber: Joi.string().optional(),
  installationDate: Joi.date().iso().optional(),
  nextServiceDate: Joi.date().iso().optional(),
  image: Joi.string().allow('').optional(),
});

const singleId = Joi.object({
  id: Joi.string().required(),
});

const singlePlumberId = Joi.object({
  plumberId: Joi.string().required(),
});

module.exports = {
  addEquipment,
  updateEquipment,
  singleId,
  singlePlumberId,
};
