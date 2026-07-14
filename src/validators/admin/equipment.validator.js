const Joi = require('joi');

const addEquipment = Joi.object({
  plumberId: Joi.string().required(),
  category: Joi.string()
    .valid(
      'Water Heaters',
      'Pressure Reducing Valves',
      'Shut-off Valves',
      'Water Softeners',
      'Whole-house Filters',
      'Toilets',
      'Faucets',
      'Showerheads',
    )
    .required(),
  brand: Joi.string().allow('').optional(),
  model: Joi.string().allow('').optional(),
  installationDate: Joi.date().iso().allow('').optional(),
  nextServiceDate: Joi.date().iso().allow('').optional(),
  image: Joi.string().allow('').optional(),
});

const updateEquipment = Joi.object({
  category: Joi.string()
    .valid(
      'Water Heaters',
      'Pressure Reducing Valves',
      'Shut-off Valves',
      'Water Softeners',
      'Whole-house Filters',
      'Toilets',
      'Faucets',
      'Showerheads',
    )
    .optional(),
  brand: Joi.string().allow('').optional(),
  model: Joi.string().allow('').optional(),
  installationDate: Joi.date().iso().allow('').optional(),
  nextServiceDate: Joi.date().iso().allow('').optional(),
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
