const router = require('express').Router();
const controller = require('../../controllers/admin/plumbingCodeCategory.controller');
const auth = require('../../middlewares/auth.middleware');
const Joi = require('joi');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

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

router
  .route('/')
  .get(controller.getCategories)
  .post(validator.body(categorySchema), controller.createCategory);

router
  .route('/:id')
  .patch(validator.params(paramIdSchema), validator.body(categoryUpdateSchema), controller.updateCategory)
  .delete(validator.params(paramIdSchema), controller.deleteCategory);

module.exports = router;
