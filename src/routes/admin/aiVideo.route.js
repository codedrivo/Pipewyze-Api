const router = require('express').Router();
const controller = require('../../controllers/admin/aiVideo.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/multer.middleware');
const validationSchema = require('../../validators/admin/aiVideo.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

// Question Endpoints
router
  .route('/questions')
  .post(
    validator.body(validationSchema.createQuestion),
    controller.createQuestion,
  )
  .get(controller.getQuestions);

router
  .route('/questions/:id')
  .get(validator.params(validationSchema.singleId), controller.getQuestionById)
  .patch(
    validator.params(validationSchema.singleId),
    validator.body(validationSchema.updateQuestion),
    controller.updateQuestion,
  )
  .delete(
    validator.params(validationSchema.singleId),
    controller.deleteQuestion,
  );

// Video Endpoints
router
  .route('/')
  .post(
    upload.single('thumbnail'),
    validator.body(validationSchema.createVideo),
    controller.createVideo,
  )
  .get(controller.getVideos);

router
  .route('/:id')
  .get(validator.params(validationSchema.singleId), controller.getVideoById)
  .patch(
    upload.single('thumbnail'),
    validator.params(validationSchema.singleId),
    validator.body(validationSchema.updateVideo),
    controller.updateVideo,
  )
  .delete(validator.params(validationSchema.singleId), controller.deleteVideo);

module.exports = router;
