const router = require('express').Router();
const controller = require('../../controllers/admin/essentialTool.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/multer.middleware');
const validationSchema = require('../../validators/admin/essentialTool.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router.route('/')
  .post(upload.single('image'), validator.body(validationSchema.createEssentialTool), controller.createEssentialTool)
  .get(controller.getEssentialTools);

router.route('/:id')
  .get(validator.params(validationSchema.singleId), controller.getEssentialTool)
  .patch(upload.single('image'), validator.params(validationSchema.singleId), validator.body(validationSchema.updateEssentialTool), controller.updateEssentialTool)
  .delete(validator.params(validationSchema.singleId), controller.deleteEssentialTool);

module.exports = router;
