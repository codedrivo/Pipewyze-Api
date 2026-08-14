const router = require('express').Router();
const controller = require('../../controllers/admin/trendingVideo.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/multer.middleware');
const validationSchema = require('../../validators/admin/trendingVideo.validator');
const validator = require('express-joi-validation').createValidator({
  passError: true,
});

router.use(auth('admin'));

router
  .route('/')
  .post(
    upload.single('thumbnail'),
    validator.body(validationSchema.createTrendingVideo),
    controller.createTrendingVideo,
  )
  .get(controller.getTrendingVideos);

router
  .route('/:id')
  .get(
    validator.params(validationSchema.singleId),
    controller.getTrendingVideo,
  )
  .patch(
    upload.single('thumbnail'),
    validator.params(validationSchema.singleId),
    validator.body(validationSchema.updateTrendingVideo),
    controller.updateTrendingVideo,
  )
  .delete(
    validator.params(validationSchema.singleId),
    controller.deleteTrendingVideo,
  );

module.exports = router;
