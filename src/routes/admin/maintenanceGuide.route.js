const router = require('express').Router();
const controller = require('../../controllers/admin/maintenanceGuide.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/multer.middleware');
const validationSchema = require('../../validators/admin/maintenanceGuide.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router
  .route('/')
  .post(
    upload.single('image'),
    validator.body(validationSchema.createMaintenanceGuide),
    controller.createMaintenanceGuide,
  )
  .get(controller.getMaintenanceGuides);

router
  .route('/:id')
  .get(validator.params(validationSchema.singleId), controller.getMaintenanceGuide)
  .patch(
    upload.single('image'),
    validator.params(validationSchema.singleId),
    validator.body(validationSchema.updateMaintenanceGuide),
    controller.updateMaintenanceGuide,
  )
  .delete(validator.params(validationSchema.singleId), controller.deleteMaintenanceGuide);

module.exports = router;
