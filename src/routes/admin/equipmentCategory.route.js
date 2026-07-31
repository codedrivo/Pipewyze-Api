const router = require('express').Router();
const controller = require('../../controllers/admin/equipmentCategory.controller');
const auth = require('../../middlewares/auth.middleware');
const Joi = require('joi');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

const categorySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('', null).optional(),
});

const categoryUpdateSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().allow('', null).optional(),
});

const paramIdSchema = Joi.object({
  id: Joi.string().required(),
});

router.get('/', auth(), controller.getCategories);
router.post(
  '/',
  auth('admin'),
  validator.body(categorySchema),
  controller.createCategory,
);
router.patch(
  '/:id',
  auth('admin'),
  validator.params(paramIdSchema),
  validator.body(categoryUpdateSchema),
  controller.updateCategory,
);
router.delete(
  '/:id',
  auth('admin'),
  validator.params(paramIdSchema),
  controller.deleteCategory,
);

module.exports = router;
