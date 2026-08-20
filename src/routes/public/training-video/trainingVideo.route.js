const router = require('express').Router();
const service = require('../../../services/admin/trainingVideo.service');
const catchAsync = require('../../../helpers/asyncErrorHandler');
const auth = require('../../../middlewares/auth.middleware');

router.get(
  '/',
  auth(),
  catchAsync(async (req, res) => {
    const { role } = req.user;
    const query = {};
    if (
      role === 'apprentice' ||
      role === 'licensed-plumber' ||
      role === 'home-owner'
    ) {
      query.targetAudience = role;
    } else {
      const { targetAudience } = req.query;
      if (targetAudience) {
        query.targetAudience = targetAudience;
      }
    }
    const videos = await service.getTrainingVideos(query);
    let videosWithSaved = videos;
    if (req.user) {
      const SavedResource = require('../../../models/savedResource.model');
      const savedResources = await SavedResource.find({
        userId: req.user._id,
        resourceType: 'TrainingVideo',
        resourceId: { $in: videos.map((v) => v._id) },
      });
      const savedResourceIds = new Set(
        savedResources.map((sr) => sr.resourceId.toString()),
      );
      videosWithSaved = videos.map((video) => {
        const videoJson = video.toJSON ? video.toJSON() : video;
        videoJson.isSaved = savedResourceIds.has(video._id.toString());
        return videoJson;
      });
    }
    res.status(200).json({
      status: 200,
      videos: videosWithSaved,
    });
  }),
);

router.get(
  '/:id',
  auth(),
  catchAsync(async (req, res) => {
    const video = await service.getTrainingVideoById(req.params.id);
    let videoJson = video.toJSON ? video.toJSON() : video;
    if (req.user) {
      const SavedResource = require('../../../models/savedResource.model');
      const isSaved = await SavedResource.exists({
        userId: req.user._id,
        resourceType: 'TrainingVideo',
        resourceId: video._id,
      });
      videoJson.isSaved = !!isSaved;
    }
    res.status(200).json({
      status: 200,
      video: videoJson,
    });
  }),
);

module.exports = router;
