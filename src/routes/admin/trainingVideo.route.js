const router = require('express').Router();
const controller = require('../../controllers/admin/trainingVideo.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/multer.middleware');
const validationSchema = require('../../validators/admin/trainingVideo.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router
  .route('/')
  .post(
    upload.single('thumbnail'),
    validator.body(validationSchema.createTrainingVideo),
    controller.createTrainingVideo,
  )
  .get(controller.getTrainingVideos);

router
  .route('/:id')
  .get(validator.params(validationSchema.singleId), controller.getTrainingVideo)
  .patch(
    upload.single('thumbnail'),
    validator.params(validationSchema.singleId),
    validator.body(validationSchema.updateTrainingVideo),
    controller.updateTrainingVideo,
  )
  .delete(
    validator.params(validationSchema.singleId),
    controller.deleteTrainingVideo,
  );

module.exports = router;
