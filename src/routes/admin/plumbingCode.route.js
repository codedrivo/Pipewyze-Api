const router = require('express').Router();
const controller = require('../../controllers/admin/plumbingCode.controller');
const auth = require('../../middlewares/auth.middleware');
const validationSchema = require('../../validators/admin/plumbingCode.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router
  .route('/')
  .post(
    validator.body(validationSchema.createPlumbingCode),
    controller.createPlumbingCode,
  )
  .get(controller.getPlumbingCodes);

router
  .route('/:id')
  .get(validator.params(validationSchema.singleId), controller.getPlumbingCode)
  .patch(
    validator.params(validationSchema.singleId),
    validator.body(validationSchema.updatePlumbingCode),
    controller.updatePlumbingCode,
  )
  .delete(
    validator.params(validationSchema.singleId),
    controller.deletePlumbingCode,
  );

module.exports = router;
