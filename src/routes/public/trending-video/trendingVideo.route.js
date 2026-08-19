const router = require('express').Router();
const service = require('../../../services/admin/trendingVideo.service');
const catchAsync = require('../../../helpers/asyncErrorHandler');
const auth = require('../../../middlewares/auth.middleware');

router.get(
  '/',
  auth(),
  catchAsync(async (req, res) => {
    const { role } = req.user;
    const query = {};
    if (role === 'apprentice' || role === 'licensed-plumber') {
      query.targetAudience = role;
    } else {
      const { targetAudience } = req.query;
      if (targetAudience) {
        query.targetAudience = targetAudience;
      }
    }
    const videos = await service.getTrendingVideos(query);
    res.status(200).json({
      status: 200,
      videos,
    });
  }),
);

router.get(
  '/:id',
  auth(),
  catchAsync(async (req, res) => {
    const video = await service.getTrendingVideoById(req.params.id);
    res.status(200).json({
      status: 200,
      video,
    });
  }),
);

module.exports = router;
