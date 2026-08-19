const router = require('express').Router();
const AiVideoQuestion = require('../../../models/aiVideoQuestion.model');
const AiVideo = require('../../../models/aiVideo.model');
const catchAsync = require('../../../helpers/asyncErrorHandler');
const auth = require('../../../middlewares/auth.middleware');

router.get(
  '/',
  auth(),
  catchAsync(async (req, res) => {
    const { targetAudience } = req.query;

    const questions = await AiVideoQuestion.find()
      .sort({ createdAt: -1 })
      .lean();

    const videoQuery = {};
    if (targetAudience) {
      videoQuery.targetAudience = targetAudience;
    }
    const videos = await AiVideo.find(videoQuery)
      .sort({ createdAt: -1 })
      .lean();

    const questionsWithVideos = questions
      .map((q) => {
        const questionVideos = videos.filter(
          (v) => v.questionId.toString() === q._id.toString(),
        );
        return {
          id: q._id,
          ...q,
          videos: questionVideos,
        };
      })
      .filter((q) => q.videos.length > 0);

    res.status(200).json({
      status: 200,
      questions: questionsWithVideos,
    });
  }),
);

module.exports = router;
