const router = require('express').Router();
const controller = require('../../controllers/admin/equipment.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/multer.middleware');
const validationSchema = require('../../validators/admin/equipment.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router.get(
  '/plumber/:plumberId',
  validator.params(validationSchema.singlePlumberId),
  controller.getEquipment,
);

router.post(
  '/add',
  upload.single('image'),
  validator.body(validationSchema.addEquipment),
  controller.addEquipment,
);

router.patch(
  '/update/:id',
  upload.single('image'),
  validator.params(validationSchema.singleId),
  validator.body(validationSchema.updateEquipment),
  controller.updateEquipment,
);

router.delete(
  '/delete/:id',
  validator.params(validationSchema.singleId),
  controller.deleteEquipment,
);

module.exports = router;
